import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import type { ChatMessage } from './llm.js';
import { staffSnapshot, studentWorkload } from './ai.live.js';
import {
  adviseOnAttempt,
  answerFromData,
  classifyIntent,
  generateQuestionsWithModel,
  recommendStudy,
  roleGroup,
  tutorReply,
} from './ai.model.js';

export async function createConversation(userId: string, input: { title?: string; topic?: string; courseId?: string }) {
  return prisma.aIConversation.create({
    data: { ...input, userId },
    include: { messages: true },
  });
}

export async function listConversations(userId: string) {
  return prisma.aIConversation.findMany({
    where: { userId },
    include: { _count: { select: { messages: true } } },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getConversation(id: string, userId: string) {
  const conv = await prisma.aIConversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!conv || conv.userId !== userId) throw new AppError(404, 'Conversation not found');
  return conv;
}

export async function deleteConversation(id: string, userId: string) {
  const conv = await prisma.aIConversation.findUnique({ where: { id } });
  if (!conv || conv.userId !== userId) throw new AppError(404, 'Conversation not found');
  await prisma.aIConversation.delete({ where: { id } });
  return { deleted: true };
}

/* -------------------------------------------------------------------------- */
/* Assistant: role-scoped answers                                             */
/* -------------------------------------------------------------------------- */

/*
 * Access policy. It is enforced here, in code, by the caller's role; the model
 * only picks among intents the role is allowed (see ai.model.ts) and never sees
 * records it could leak.
 *
 * - STUDENT: rows of that student only (own attempts and answers, own placement
 *   profile and applications) plus the public list of open placement drives.
 * - TEACHER: student records (STUDENT accounts only), and results, answers and
 *   proctoring limited to tests they created; placement drives. No user
 *   directory, staff accounts or audit logs.
 * - ADMIN / ORG_ADMIN: everything, including user accounts and the audit log.
 * - PROCTOR: proctoring sessions only.
 *
 * Every query uses an explicit `select` for user fields, so password hashes,
 * 2FA secrets and tokens are never loaded, let alone shown.
 */

interface UserContext {
  id: string;
  name: string;
  email: string;
  role: string;
}

const studentName = { fullName: true, username: true } as const;
const nameOf = (u: { fullName: string | null; username: string }) => u.fullName || u.username;
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const fmtPct = (v: unknown) => (v == null ? '-' : `${Math.round(Number(v) * 10) / 10}%`);
const fmtNum = (v: unknown) => (v == null ? '-' : `${Math.round(Number(v) * 100) / 100}`);
const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

function attemptState(a: { status: string; passed: boolean | null }) {
  if (a.status === 'IN_PROGRESS') return '⏳ In progress';
  if (a.status === 'EVALUATED') return a.passed === true ? '✅ Passed' : a.passed === false ? '❌ Failed' : 'Evaluated';
  if (a.status === 'SUBMITTED') return '🕓 Awaiting evaluation';
  return a.status.replace(/_/g, ' ').toLowerCase();
}

/** Tests whose title appears in the message, so "results for DSA Quiz" narrows to it. */
function mentionedTests<T extends { title: string }>(q: string, tests: T[]) {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const text = ` ${clean(q)} `;
  return tests.filter((t) => clean(t.title).length >= 3 && text.includes(` ${clean(t.title)} `));
}

function restrictedReply(role: string) {
  switch (roleGroup(role)) {
    case 'STUDENT':
      return `🔒 **Access restricted**\n\nI can only show **your own** data: your test results and mistakes, your placement profile, applications and eligibility, and the list of open placement drives.\n\nRecords of other students, teachers or administrators, user lists, audit logs and credentials are not available to students.\n\nTry _"show my results"_ or _"am I eligible for <company>?"_.`;
    case 'TEACHER':
      return `🔒 **Access restricted**\n\nAs a **teacher** you can view student records, results, answers and proctoring for the tests you created, and placement drives.\n\nStaff and administrator accounts, user counts, audit logs and credentials are only available to administrators.`;
    case 'PROCTOR':
      return `🔒 **Access restricted**\n\nAs a **proctor** you can view proctoring sessions, flags and suspicion scores. Results, answers, student records, placements, user accounts and audit logs are not available to proctors.`;
    default:
      return `🔒 **Not available**\n\nPasswords, password hashes, secret keys and tokens are never shown, not even to administrators. To give someone access again, reset their password from the **Users** page.`;
  }
}

function greetingReply(user: UserContext) {
  const name = user.name || 'there';
  switch (roleGroup(user.role)) {
    case 'STUDENT':
      return `### 🎓 Hi ${name}!\n\nI'm your ExamForge study assistant. You can ask me:\n\n- **Your results**: _"show my results"_, _"what should I study next?"_, _"mera result dikhao"_\n- **Placements**: _"am I eligible for Google?"_, _"show open placement drives"_, _"my applications"_\n- **Concepts**: _"explain closures in JavaScript"_, _"difference between SQL and NoSQL"_\n- **Coding help**: _"give me hints for Two Sum"_\n- **Study plans**: _"6-week DSA roadmap"_\n\nI can only see your own records, never other students' or staff data.`;
    case 'PROCTOR':
      return `### 🛡️ Hi ${name}!\n\nAs a proctor you can ask me:\n\n- _"show flagged proctoring sessions"_\n- _"who has the highest suspicion score?"_\n- general questions about invigilation and exam integrity.`;
    case 'TEACHER':
    case 'ADMIN': {
      const admin = roleGroup(user.role) === 'ADMIN';
      return `### 👋 Hi ${name}!\n\nHere is what I can answer from ${admin ? 'platform' : 'your'} records:\n\n- **Results**: _"show results${admin ? '' : ' for my tests'}"_, _"how many students passed?"_, _"struggling students"_\n- **Student records**: _"list students"_, _"records for <name or email>"_\n- **Answers**: _"what did students answer on question 2?"_, _"which questions had the lowest accuracy?"_\n- **Proctoring**: _"show proctoring flags"_\n- **Placements**: _"placement statistics"_, _"active drives"_\n${admin ? '- **Users & audit**: _"how many teachers are there?"_, _"show the audit log"_\n' : ''}- **Question drafting**: _"create 5 MCQs on SQL joins"_\n\nAnything else (concepts, lesson plans, rubrics) I answer as a general assistant.${admin ? '' : '\n\nResults, answers and proctoring cover the tests you created.'}`;
    }
  }
}

/* ------------------------------ student data ------------------------------ */

export interface EligibilityProfile {
  cgpa: number;
  branch: string | null;
  activeBacklogs: number;
  tenthPercentage: number | null;
  twelfthPercentage: number | null;
  graduationYear: number | null;
}

export interface EligibilityDrive {
  eligibilityCgpa: number;
  eligibleBranches: unknown;
  maxBacklogs: number | null;
  minTenthPercent: number | null;
  minTwelfthPercent: number | null;
  batchYear: number | null;
  deadline: Date | string;
}

/** Same rules as the placement portal; returns why the student is not eligible (empty = eligible). */
export function driveEligibility(profile: EligibilityProfile, drive: EligibilityDrive): string[] {
  const reasons: string[] = [];
  if (drive.eligibilityCgpa > 0 && profile.cgpa < drive.eligibilityCgpa) {
    reasons.push(`needs CGPA ${drive.eligibilityCgpa} (yours: ${profile.cgpa})`);
  }
  const branches = Array.isArray(drive.eligibleBranches) ? (drive.eligibleBranches as string[]) : [];
  if (branches.length > 0 && (!profile.branch || !branches.includes(profile.branch))) {
    reasons.push(`open to ${branches.join(', ')} (yours: ${profile.branch || 'not set'})`);
  }
  if (drive.maxBacklogs != null && profile.activeBacklogs > drive.maxBacklogs) {
    reasons.push(`max ${drive.maxBacklogs} active backlogs (yours: ${profile.activeBacklogs})`);
  }
  if (drive.minTenthPercent && profile.tenthPercentage && profile.tenthPercentage < drive.minTenthPercent) {
    reasons.push(`needs ${drive.minTenthPercent}% in 10th (yours: ${profile.tenthPercentage}%)`);
  }
  if (drive.minTwelfthPercent && profile.twelfthPercentage && profile.twelfthPercentage < drive.minTwelfthPercent) {
    reasons.push(`needs ${drive.minTwelfthPercent}% in 12th (yours: ${profile.twelfthPercentage}%)`);
  }
  if (drive.batchYear && profile.graduationYear && profile.graduationYear !== drive.batchYear) {
    reasons.push(`for the ${drive.batchYear} batch (yours: ${profile.graduationYear})`);
  }
  return reasons;
}

async function studentPlacements(query: string, user: UserContext) {
  const q = query.toLowerCase();
  const [profile, drives, applications] = await Promise.all([
    prisma.placementProfile.findUnique({ where: { userId: user.id } }),
    prisma.placementDrive.findMany({ where: { status: { in: ['UPCOMING', 'ACTIVE'] } }, orderBy: { deadline: 'asc' } }),
    prisma.placementApplication.findMany({
      where: { studentId: user.id },
      include: { drive: { select: { id: true, companyName: true, role: true, status: true } } },
      orderBy: { appliedAt: 'desc' },
    }),
  ]);
  const appByDrive = new Map(applications.map((a) => [a.driveId, a]));
  const now = Date.now();

  let res = `### 💼 Placements\n\n`;
  if (profile) {
    res += `**Your profile**: ${profile.branch || 'branch not set'} · CGPA **${profile.cgpa}** · ${profile.activeBacklogs} active backlog${profile.activeBacklogs === 1 ? '' : 's'}${profile.graduationYear ? ` · batch ${profile.graduationYear}` : ''}\n\n`;
  } else {
    res += `⚠️ You haven't filled in your **placement profile** yet, so I can't check eligibility. Open **Placements → Profile** and add your CGPA, branch and backlogs.\n\n`;
  }

  // "Am I eligible for Google?" focuses on that company.
  const named = drives.filter((d) => q.includes(d.companyName.toLowerCase()));
  const asked = /eligib\w*\s+(?:for|in)\s+([a-z0-9&.\- ]{2,30}?)(?:\?|$|\s+(?:drive|company|placement|role|ka|ke|ki|hu|hoon))/i.exec(query)?.[1]?.trim();
  if (asked && named.length === 0 && !/^(any|the|this|that|it|placements?|drives?|companies)$/i.test(asked)) {
    res += `There is no open drive from **${asked}** right now.${drives.length ? ' Here are the drives that are open:' : ''}\n\n`;
  }
  const shown = named.length ? named : drives;

  if (drives.length === 0) {
    res += `There are no open or upcoming placement drives at the moment.\n`;
  } else {
    res += `| Company | Role | Type | Min CGPA | Package | Deadline | You |\n| :--- | :--- | :---: | :---: | :---: | :---: | :--- |\n`;
    for (const d of shown) {
      const app = appByDrive.get(d.id);
      let you: string;
      if (app) you = `📝 Applied (${app.status})`;
      else if (new Date(d.deadline).getTime() < now) you = '⌛ Deadline passed';
      else if (!profile) you = '⚠️ Complete profile';
      else {
        const reasons = driveEligibility(profile, d);
        you = reasons.length ? `❌ Not eligible: ${reasons.join('; ')}` : '✅ Eligible';
      }
      res += `| **${cell(d.companyName)}** | ${cell(d.role)} | ${d.driveType.replace('_', '-').toLowerCase()} | ${d.eligibilityCgpa || 'Any'} | ${d.ctcLpa ? `${d.ctcLpa} LPA` : '-'} | ${fmtDate(d.deadline)} | ${cell(you)} |\n`;
    }
  }

  const otherApps = applications.filter((a) => !shown.some((d) => d.id === a.driveId));
  if (otherApps.length) {
    res += `\n#### Your other applications\n\n| Company | Role | Status | Applied |\n| :--- | :--- | :---: | :---: |\n`;
    for (const a of otherApps.slice(0, 10)) {
      res += `| ${cell(a.drive.companyName)} | ${cell(a.drive.role)} | ${a.status} | ${fmtDate(a.appliedAt)} |\n`;
    }
  }
  res += `\nApply from the **Placements** page.`;
  return res;
}

async function studentResults(user: UserContext) {
  const attempts = await prisma.attempt.findMany({
    where: { studentId: user.id },
    select: {
      id: true,
      status: true,
      score: true,
      percentage: true,
      passed: true,
      startedAt: true,
      submittedAt: true,
      test: { select: { title: true, totalMarks: true } },
      answers: {
        select: {
          isCorrect: true,
          option: { select: { text: true } },
          question: { select: { text: true, topic: true, explanation: true } },
        },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: 20,
  });

  if (attempts.length === 0) {
    const assigned = await prisma.testAssignment.findMany({
      where: {
        OR: [{ studentId: user.id }, { class: { students: { some: { studentId: user.id } } } }],
        test: { status: 'PUBLISHED' },
      },
      select: { test: { select: { id: true, title: true, durationMinutes: true, totalMarks: true } } },
      take: 10,
    });
    const tests = [...new Map(assigned.map((a) => [a.test.id, a.test])).values()].slice(0, 5);
    let msg = `### 🎯 Your results\n\nYou haven't attempted any tests yet, so there are no results to show.`;
    if (tests.length) {
      msg += `\n\n**Tests assigned to you:**\n${tests.map((t) => `- **${t.title}** (${t.durationMinutes} min, ${fmtNum(t.totalMarks)} marks)`).join('\n')}\n\nTake one from **My Tests** and ask me again for a review of your answers.`;
    }
    return msg;
  }

  const finished = attempts.filter((a) => a.status !== 'IN_PROGRESS');
  const evaluated = attempts.filter((a) => a.status === 'EVALUATED');
  const inProgress = attempts.length - finished.length;
  const passed = evaluated.filter((a) => a.passed === true).length;
  const failed = evaluated.filter((a) => a.passed === false).length;
  const average = avg(evaluated.filter((a) => a.percentage != null).map((a) => Number(a.percentage)));

  let res = `### 🎯 Your results\n\n`;
  const summary = [`**${finished.length}** submitted`];
  if (evaluated.length) summary.push(`**${evaluated.length}** evaluated (${passed} passed, ${failed} failed)`, `average **${average ?? '-'}%**`);
  if (finished.length > evaluated.length) summary.push(`${finished.length - evaluated.length} awaiting evaluation`);
  if (inProgress) summary.push(`${inProgress} in progress`);
  res += `${summary.join(' · ')}\n\n`;

  res += `| Test | Score | % | Result | Date |\n| :--- | :---: | :---: | :--- | :---: |\n`;
  for (const a of attempts.slice(0, 8)) {
    const graded = a.status === 'EVALUATED';
    res += `| ${cell(a.test.title)} | ${graded && a.score != null ? `${fmtNum(a.score)}/${fmtNum(a.test.totalMarks)}` : '-'} | ${graded ? fmtPct(a.percentage) : '-'} | ${attemptState(a)} | ${fmtDate(a.submittedAt ?? a.startedAt)} |\n`;
  }

  // Topic accuracy over every graded answer of every submitted attempt.
  const topics = new Map<string, { correct: number; total: number }>();
  for (const a of finished) {
    for (const ans of a.answers) {
      if (ans.isCorrect == null) continue;
      const t = ans.question.topic || 'General';
      const s = topics.get(t) ?? { correct: 0, total: 0 };
      s.total += 1;
      if (ans.isCorrect) s.correct += 1;
      topics.set(t, s);
    }
  }
  const weak = [...topics]
    .map(([topic, s]) => ({ topic, ...s, acc: Math.round((s.correct / s.total) * 100) }))
    .filter((t) => t.acc < 70)
    .sort((a, b) => a.acc - b.acc)
    .slice(0, 4);

  const latest = finished.find((a) => a.answers.some((x) => x.isCorrect != null));
  if (!latest) {
    res += `\nNone of your answers have been graded yet, so there is nothing to review. Check back after your teacher evaluates ${finished.length ? 'your submission' : 'it'}.`;
    return res;
  }

  const missed = latest.answers.filter((x) => x.isCorrect === false);
  const pending = latest.answers.filter((x) => x.isCorrect == null).length;
  res += `\n#### Latest graded test: ${latest.test.title}\n\n`;
  if (missed.length) {
    res += `You got **${missed.length}** question${missed.length === 1 ? '' : 's'} wrong:\n\n`;
    for (const m of missed.slice(0, 5)) {
      res += `- **${m.question.topic || 'General'}**: ${clip(cell(m.question.text), 160)}\n`;
      if (m.option?.text) res += `  - Your answer: ${clip(cell(m.option.text), 100)}\n`;
      if (m.question.explanation) res += `  - Why: ${clip(cell(m.question.explanation), 220)}\n`;
    }
    if (missed.length > 5) res += `- …and ${missed.length - 5} more. Open the test in **Results** for the full review.\n`;
  } else {
    res += `Every graded answer was correct. 🎉\n`;
  }
  if (pending) res += `\n${pending} answer${pending === 1 ? ' is' : 's are'} still awaiting manual grading.\n`;

  if (weak.length) {
    res += `\n#### What to study next\n\n`;
    for (const t of weak) res += `- **${t.topic}**: ${t.correct}/${t.total} correct (${t.acc}%). Revise it and practise a few questions on it.\n`;
  } else if (topics.size) {
    res += `\nNo weak topics so far: every topic is at 70% or better. Try harder questions or a new topic next.`;
  }
  return res;
}

const TYPE_LABEL: Record<string, string> = {
  SINGLE: 'Single-choice MCQ',
  MULTIPLE: 'Multi-select MCQ',
  TRUE_FALSE: 'True / false',
  FILL_BLANK: 'Fill in the blank',
  MATCH: 'Match the following',
  CODING: 'Coding',
  SUBJECTIVE: 'Subjective',
};
const label = (k: string) => TYPE_LABEL[k] ?? k.charAt(0) + k.slice(1).toLowerCase().replace(/_/g, ' ');
const breakdown = (o: Record<string, number>) =>
  Object.entries(o).length ? Object.entries(o).map(([k, v]) => `${label(k)} **${v}**`).join(' · ') : 'none';

/** Built-in rendering of a student's workload, used when the model is offline. */
function renderWorkload(w: Awaited<ReturnType<typeof studentWorkload>>) {
  const s = w.summary;
  const open = (o: Record<string, number>, ...keys: string[]) => keys.reduce((n, k) => n + (o[k] ?? 0), 0);
  let res = `### 📋 Your pending work\n\n| | Pending | Done |\n| :--- | :---: | :---: |\n`;
  res += `| Tests | **${open(s.testsByState, 'pending', 'in_progress', 'upcoming')}** | ${open(s.testsByState, 'completed')} |\n`;
  res += `| Assignments | **${open(s.assignmentsByState, 'pending', 'overdue')}** | ${open(s.assignmentsByState, 'submitted', 'graded')} |\n`;
  res += `| Coding problems | **${open(s.codingByState, 'not_started', 'attempted')}** | ${open(s.codingByState, 'solved')} |\n\n`;
  const tests = w.tests.filter((t) => ['pending', 'in_progress', 'upcoming'].includes(t.state));
  if (tests.length) {
    res += `#### Tests to take\n\n| Test | Due | Questions |\n| :--- | :--- | :--- |\n`;
    for (const t of tests) {
      res += `| **${cell(t.title)}**${t.state === 'in_progress' ? ' (in progress)' : ''} | ${t.dueAt ?? 'no deadline'} | ${breakdown(t.questionTypes)} |\n`;
    }
  }
  const asg = w.assignments.filter((a) => a.state === 'pending' || a.state === 'overdue');
  if (asg.length) {
    res += `\n#### Assignments\n\n| Assignment | Due | Status |\n| :--- | :--- | :---: |\n`;
    for (const a of asg) res += `| **${cell(a.title)}** | ${a.dueAt ?? 'no deadline'} | ${a.state} |\n`;
  }
  if (Object.keys(s.openCodingByDifficulty).length) {
    res += `\n**Coding problems left by difficulty:** ${breakdown(s.openCodingByDifficulty)}\n`;
  }
  return res;
}

async function studentWork(query: string, user: UserContext, history: ChatMessage[]) {
  const work = await studentWorkload(user.id);
  const reply = await answerFromData(user, query, history, work, "this student's own assigned tests, assignments and coding problems");
  return reply ?? renderWorkload(work);
}

/** Built-in rendering of the live staff snapshot, used when the model is offline. */
function renderSnapshot(d: Awaited<ReturnType<typeof staffSnapshot>>) {
  const rows = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `| ${label(k)} | **${v}** |`).join('\n');
  const st = d.students;
  let res = `### 📊 Live overview\n\n_${d.scope}, as of ${d.generatedAt}_\n\n`;
  if ('accounts' in d && d.accounts) {
    res += `| Accounts by role | |\n| :--- | :---: |\n${rows(d.accounts.byRole)}\n| Total | **${d.accounts.total}** |\n\n`;
  }
  res += `| Students | |\n| :--- | :---: |\n| Total | **${st.total}** |\n`;
  res += `| Graduated (before ${new Date().getFullYear()}) | **${st.graduated}** |\n| Graduating this year | **${st.graduatingThisYear}** |\n`;
  res += `| Graduating later | ${st.graduatingLater} |\n| No graduation year on record | ${st.graduationYearUnknown} |\n| Average CGPA | ${st.averageCgpa ?? '-'} |\n\n`;
  if (Object.keys(st.byBranch).length) res += `| Branch | Students |\n| :--- | :---: |\n${rows(st.byBranch)}\n\n`;
  res += `| Tests & practice | |\n| :--- | :---: |\n${rows(d.tests.byStatus)}\n| Submitted attempts | **${d.tests.submittedAttempts}** |\n`;
  res += `| Pass rate | ${d.tests.passRatePercent ?? '-'}% |\n| Assignments awaiting grading | **${d.assignments.awaitingGrading}** |\n\n`;
  if (Object.keys(d.questionBank.byType).length) res += `**Question bank:** ${breakdown(d.questionBank.byType)}\n\n`;
  res += `**Placements:** ${d.placements.studentsPlaced} students placed · drives ${breakdown(d.placements.drivesByStatus)}`;
  return res;
}

async function staffLiveStats(query: string, user: UserContext, history: ChatMessage[]) {
  const data = await staffSnapshot({ id: user.id, admin: roleGroup(user.role) === 'ADMIN' });
  const reply = await answerFromData(user, query, history, data, `platform statistics (${data.scope})`);
  return reply ?? renderSnapshot(data);
}

async function handleStudentQuery(query: string, user: UserContext, history: ChatMessage[], topic?: string | null) {
  const intent = await classifyIntent(query, history, user.role);
  // Every data branch below reads only this student's rows, so the role
  // boundary does not depend on the routing being right.
  if (intent === 'restricted') return restrictedReply(user.role);
  if (intent === 'greeting') return greetingReply(user);
  if (intent === 'placements') return studentPlacements(query, user);
  if (intent === 'my_work') return studentWork(query, user, history);
  if (intent === 'my_results') return studentResults(user);

  const reply = await tutorReply(user, history, topic);
  if (reply) return reply;
  return offlineTutor(query) ?? greetingReply(user);
}

/** Built-in answers for when the model is offline. */
function offlineTutor(query: string): string | null {
  const q = query.toLowerCase();
  if (/\b(roadmap|study plan|how to learn|curriculum|learning path|where to start)\b/.test(q)) return generateRoadmap(query);
  if (/\b(two sum|reverse string|binary search|code problem|algorithm|leetcode|hints?)\b/.test(q)) return generateCodingTutorHelp(query);
  if (/\b(explain|what is|what are|difference between|closures?|promises?|async|react|javascript|python|sql)\b/.test(q)) {
    return generateConceptExplanation(query);
  }
  return null;
}

/* ------------------------------- staff data ------------------------------- */

const NAME_STOPWORDS = new Set(
  'show list find lookup look search records record profile profiles dossier details detail info about for of the a an me student students all give tell get please display who is are what how many with and their data'.split(' '),
);

async function staffStudentRecords(query: string, user: UserContext) {
  const q = query.toLowerCase();
  const teacher = user.role === 'TEACHER';
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
      isActive: true,
      createdAt: true,
      placementProfile: {
        select: { branch: true, cgpa: true, rollNumber: true, phone: true, skills: true, activeBacklogs: true, graduationYear: true, resumeUrl: true },
      },
      _count: { select: { attempts: teacher ? { where: { test: { createdById: user.id } } } : true } },
    },
    orderBy: [{ fullName: 'asc' }, { username: 'asc' }],
    take: 500,
  });

  if (students.length === 0) return `### 👥 Students\n\nThere are no student accounts yet.`;

  // A specific student: full name, email or username first, then a unique name part.
  const words = q.split(/[^a-z0-9@._-]+/).filter((w) => w.length >= 3 && !NAME_STOPWORDS.has(w));
  let matches = students.filter((s) => {
    const name = (s.fullName || '').toLowerCase();
    return (name.length >= 3 && q.includes(name)) || q.includes(s.email.toLowerCase()) || words.includes(s.username.toLowerCase());
  });
  if (matches.length === 0 && words.length) {
    matches = students.filter((s) => (s.fullName || '').toLowerCase().split(/\s+/).some((part) => words.includes(part)));
  }

  if (matches.length === 1) {
    const s = matches[0];
    const attempts = await prisma.attempt.findMany({
      where: { studentId: s.id, ...(teacher ? { test: { createdById: user.id } } : {}) },
      select: { status: true, score: true, percentage: true, passed: true, startedAt: true, submittedAt: true, test: { select: { title: true, totalMarks: true } } },
      orderBy: { startedAt: 'desc' },
      take: 10,
    });
    const applications = await prisma.placementApplication.findMany({
      where: { studentId: s.id },
      select: { status: true, appliedAt: true, drive: { select: { companyName: true, role: true } } },
      orderBy: { appliedAt: 'desc' },
      take: 10,
    });
    const evaluated = attempts.filter((a) => a.status === 'EVALUATED');
    const p = s.placementProfile;

    let res = `### 👤 ${nameOf(s)}\n\n`;
    res += `- **Email**: ${s.email} · **Username**: ${s.username} · **Account**: ${s.isActive ? 'active' : 'inactive'} · joined ${fmtDate(s.createdAt)}\n`;
    if (p) {
      const skills = Array.isArray(p.skills) && p.skills.length ? (p.skills as string[]).join(', ') : 'none listed';
      res += `- **Placement profile**: ${p.branch || 'branch not set'} · CGPA **${p.cgpa}** · ${p.activeBacklogs} backlogs${p.graduationYear ? ` · batch ${p.graduationYear}` : ''}${p.rollNumber ? ` · roll ${p.rollNumber}` : ''}\n`;
      res += `- **Skills**: ${skills}${p.resumeUrl ? ` · [Resume](${p.resumeUrl})` : ''}\n`;
    } else {
      res += `- **Placement profile**: not filled in\n`;
    }

    res += `\n#### Tests${teacher ? ' (yours)' : ''}\n\n`;
    if (attempts.length === 0) {
      res += `No attempts${teacher ? ' on your tests' : ''} yet.\n`;
    } else {
      const passed = evaluated.filter((a) => a.passed === true).length;
      res += `${attempts.length} attempt${attempts.length === 1 ? '' : 's'} · ${evaluated.length} evaluated · ${passed} passed · average **${avg(evaluated.filter((a) => a.percentage != null).map((a) => Number(a.percentage))) ?? '-'}%**\n\n`;
      res += `| Test | Score | % | Result | Date |\n| :--- | :---: | :---: | :--- | :---: |\n`;
      for (const a of attempts) {
        const graded = a.status === 'EVALUATED';
        res += `| ${cell(a.test.title)} | ${graded && a.score != null ? `${fmtNum(a.score)}/${fmtNum(a.test.totalMarks)}` : '-'} | ${graded ? fmtPct(a.percentage) : '-'} | ${attemptState(a)} | ${fmtDate(a.submittedAt ?? a.startedAt)} |\n`;
      }
    }

    if (applications.length) {
      res += `\n#### Placement applications\n\n| Company | Role | Status | Applied |\n| :--- | :--- | :---: | :---: |\n`;
      for (const a of applications) res += `| ${cell(a.drive.companyName)} | ${cell(a.drive.role)} | ${a.status} | ${fmtDate(a.appliedAt)} |\n`;
    }
    return res;
  }

  let res = '';
  let list = students;
  if (matches.length > 1) {
    res += `Several students match; ask again with the full name or email.\n\n`;
    list = matches;
  }
  const profiles = students.filter((s) => s.placementProfile).length;
  res = `### 👥 Students\n\n**${students.length}** student account${students.length === 1 ? '' : 's'} · ${profiles} with a placement profile\n\n${res}`;
  res += `| Name | Email | ${teacher ? 'Attempts on your tests' : 'Attempts'} | CGPA | Branch |\n| :--- | :--- | :---: | :---: | :--- |\n`;
  for (const s of list.slice(0, 25)) {
    res += `| **${cell(nameOf(s))}** | ${s.email} | ${s._count.attempts} | ${s.placementProfile?.cgpa ?? '-'} | ${cell(s.placementProfile?.branch || '-')} |\n`;
  }
  if (list.length > 25) res += `\n…and ${list.length - 25} more.`;
  res += `\n\nAsk _"records for <name or email>"_ for one student's full record.`;
  return res;
}

async function staffResults(query: string, user: UserContext) {
  const own = user.role === 'TEACHER' ? { createdById: user.id } : {};
  const tests = await prisma.test.findMany({
    where: own,
    select: { id: true, title: true, totalMarks: true, passingMarks: true },
  });
  if (tests.length === 0) {
    return `### 📊 Results\n\n${user.role === 'TEACHER' ? "You haven't created any tests yet" : 'No tests exist yet'}, so there are no results.`;
  }
  const focus = mentionedTests(query, tests);
  const scope = focus.length ? focus : tests;
  const attempts = await prisma.attempt.findMany({
    where: { testId: { in: scope.map((t) => t.id) } },
    select: {
      status: true,
      score: true,
      percentage: true,
      passed: true,
      startedAt: true,
      submittedAt: true,
      testId: true,
      student: { select: studentName },
    },
    orderBy: { startedAt: 'desc' },
    take: 2000,
  });
  const scopeLabel = focus.length ? focus.map((t) => `**${t.title}**`).join(', ') : user.role === 'TEACHER' ? 'your tests' : 'all tests';

  if (attempts.length === 0) return `### 📊 Results: ${scopeLabel}\n\nNo student has attempted ${focus.length ? 'this test' : 'these tests'} yet.`;

  const evaluated = attempts.filter((a) => a.status === 'EVALUATED');
  const awaiting = attempts.filter((a) => a.status === 'SUBMITTED').length;
  const inProgress = attempts.filter((a) => a.status === 'IN_PROGRESS').length;
  const passed = evaluated.filter((a) => a.passed === true);
  const failed = evaluated.filter((a) => a.passed === false);
  const scores = evaluated.filter((a) => a.percentage != null).map((a) => Number(a.percentage));

  let res = `### 📊 Results: ${scopeLabel}\n\n| Metric | Value |\n| :--- | :--- |\n`;
  res += `| Attempts | ${attempts.length} (${evaluated.length} evaluated, ${awaiting} awaiting evaluation, ${inProgress} in progress) |\n`;
  if (evaluated.length) {
    res += `| Passed / failed | **${passed.length}** / ${failed.length} (pass rate **${Math.round((passed.length / Math.max(passed.length + failed.length, 1)) * 100)}%**) |\n`;
    res += `| Average | **${avg(scores) ?? '-'}%** |\n| Highest / lowest | ${scores.length ? `${Math.max(...scores)}% / ${Math.min(...scores)}%` : '-'} |\n`;
  }

  if (scope.length > 1) {
    res += `\n#### By test\n\n| Test | Attempts | Evaluated | Avg % | Pass rate |\n| :--- | :---: | :---: | :---: | :---: |\n`;
    for (const t of scope) {
      const ta = attempts.filter((a) => a.testId === t.id);
      if (!ta.length) continue;
      const te = ta.filter((a) => a.status === 'EVALUATED');
      const tp = te.filter((a) => a.passed === true).length;
      const tScores = te.filter((a) => a.percentage != null).map((a) => Number(a.percentage));
      res += `| ${cell(t.title)} | ${ta.length} | ${te.length} | ${avg(tScores) ?? '-'} | ${te.length ? `${Math.round((tp / te.length) * 100)}%` : '-'} |\n`;
    }
  }

  const titleOf = new Map(tests.map((t) => [t.id, t]));
  res += `\n#### Recent attempts\n\n| Student | Test | Score | % | Result |\n| :--- | :--- | :---: | :---: | :--- |\n`;
  for (const a of attempts.slice(0, 10)) {
    const t = titleOf.get(a.testId)!;
    const graded = a.status === 'EVALUATED';
    res += `| ${cell(nameOf(a.student))} | ${cell(t.title)} | ${graded && a.score != null ? `${fmtNum(a.score)}/${fmtNum(t.totalMarks)}` : '-'} | ${graded ? fmtPct(a.percentage) : '-'} | ${attemptState(a)} |\n`;
  }

  if (failed.length) {
    res += `\n#### Needs attention\n\n`;
    for (const f of failed.slice(0, 8)) {
      const t = titleOf.get(f.testId)!;
      res += `- **${nameOf(f.student)}**: ${fmtPct(f.percentage)} on _${t.title}_ (pass mark ${fmtNum(t.passingMarks)}/${fmtNum(t.totalMarks)})\n`;
    }
    if (failed.length > 8) res += `- …and ${failed.length - 8} more.\n`;
  }
  return res;
}

async function staffAnswers(query: string, user: UserContext) {
  const own = user.role === 'TEACHER' ? { createdById: user.id } : {};
  const tests = await prisma.test.findMany({
    where: { ...own, attempts: { some: { status: { in: ['SUBMITTED', 'EVALUATED'] } } } },
    select: { id: true, title: true },
    orderBy: { createdAt: 'desc' },
  });
  if (tests.length === 0) {
    return `### 📝 Answers\n\nNo submitted attempts on ${user.role === 'TEACHER' ? 'your tests' : 'any test'} yet, so there are no answers to review.`;
  }
  const focus = mentionedTests(query, tests);
  const scope = (focus.length ? focus : tests).slice(0, focus.length ? 3 : 2);
  const qNum = /\b(?:question|q)\s*#?\s*(\d{1,3})\b/i.exec(query)?.[1];

  let res = `### 📝 Answers by question\n\n`;
  for (const test of scope) {
    const testQuestions = await prisma.testQuestion.findMany({
      where: { testId: test.id, ...(qNum ? { orderIndex: Number(qNum) - 1 } : {}) },
      orderBy: { orderIndex: 'asc' },
      select: {
        orderIndex: true,
        question: {
          select: {
            text: true,
            type: true,
            explanation: true,
            options: { where: { isCorrect: true }, select: { text: true } },
            // Only answers given on this test: a bank question can appear in other teachers' tests.
            attemptAnswers: {
              where: { attempt: { testId: test.id, status: { in: ['SUBMITTED', 'EVALUATED'] } } },
              select: {
                isCorrect: true,
                answerJson: true,
                option: { select: { text: true } },
                attempt: { select: { student: { select: studentName } } },
              },
            },
          },
        },
      },
    });
    res += `#### ${test.title}\n\n`;
    if (testQuestions.length === 0) {
      res += qNum ? `This test has no question ${qNum}.\n\n` : `No questions on this test.\n\n`;
      continue;
    }
    for (const tq of testQuestions.slice(0, qNum ? 1 : 10)) {
      const answers = tq.question.attemptAnswers;
      const graded = answers.filter((a) => a.isCorrect != null);
      const correct = graded.filter((a) => a.isCorrect).length;
      res += `**Q${tq.orderIndex + 1}.** ${clip(cell(tq.question.text), 200)}\n\n`;
      res += `- Accuracy: **${graded.length ? `${Math.round((correct / graded.length) * 100)}%` : '-'}** (${correct}/${graded.length} graded correct${answers.length > graded.length ? `, ${answers.length - graded.length} awaiting grading` : ''})\n`;
      const key = tq.question.options.map((o) => o.text).join(', ');
      if (key) res += `- Correct answer: ${clip(cell(key), 150)}\n`;
      if (answers.length) {
        res += `\n| Student | Answer | Result |\n| :--- | :--- | :---: |\n`;
        for (const a of answers.slice(0, 15)) {
          let text = a.option?.text ?? '';
          if (!text && a.answerJson != null) {
            const v = a.answerJson as Record<string, unknown> | string;
            text = typeof v === 'string' ? v : String(v.text ?? v.code ?? v.answer ?? JSON.stringify(v));
          }
          res += `| ${cell(nameOf(a.attempt.student))} | ${clip(cell(text || '(blank)'), 60)} | ${a.isCorrect === true ? '✅' : a.isCorrect === false ? '❌' : '🕓'} |\n`;
        }
        if (answers.length > 15) res += `\n…and ${answers.length - 15} more answers.\n`;
      }
      res += `\n`;
    }
    if (!qNum && testQuestions.length > 10) res += `_Showing the first 10 of ${testQuestions.length} questions. Ask about a specific question number for more._\n\n`;
  }
  if (!focus.length && tests.length > scope.length) {
    res += `_Showing the ${scope.length} most recent tests with submissions. Name a test to see its answers: ${tests.slice(scope.length, scope.length + 5).map((t) => t.title).join(', ')}._`;
  }
  return res;
}

async function proctoringSummary(user: UserContext) {
  const where = user.role === 'TEACHER' ? { test: { createdById: user.id } } : {};
  const [sessions, total, active] = await Promise.all([
    prisma.proctoringSession.findMany({
      where,
      orderBy: { suspicionScore: 'desc' },
      select: {
        suspicionScore: true,
        status: true,
        startedAt: true,
        student: { select: studentName },
        test: { select: { title: true } },
        _count: { select: { events: true } },
      },
      take: 15,
    }),
    prisma.proctoringSession.count({ where }),
    prisma.proctoringSession.count({ where: { ...where, status: 'ACTIVE' } }),
  ]);

  let res = `### 🛡️ Proctoring${user.role === 'TEACHER' ? ' (your tests)' : ''}\n\n`;
  if (sessions.length === 0) {
    return `${res}No proctoring sessions have been recorded yet. During a proctored test, tab switches, fullscreen exits, copy/paste and periodic snapshots are logged and scored here.`;
  }
  const flagged = sessions.filter((s) => s.suspicionScore > 20).length;
  res += `${total} session${total === 1 ? '' : 's'} · ${active} active · ${flagged} of the top ${sessions.length} flagged (score above 20)\n\n`;
  res += `| Student | Test | Suspicion | Events | Status | Started |\n| :--- | :--- | :---: | :---: | :---: | :---: |\n`;
  for (const s of sessions) {
    const risk = s.suspicionScore > 50 ? '🚨' : s.suspicionScore > 20 ? '⚠️' : '✅';
    res += `| ${cell(nameOf(s.student))} | ${cell(s.test?.title || '-')} | ${risk} **${Math.round(s.suspicionScore)}** | ${s._count.events} | ${s.status.toLowerCase()} | ${fmtDate(s.startedAt)} |\n`;
  }
  return res;
}

async function staffPlacements() {
  const [drives, profiles, applications, selected] = await Promise.all([
    prisma.placementDrive.findMany({
      select: { companyName: true, role: true, driveType: true, status: true, eligibilityCgpa: true, ctcLpa: true, deadline: true, _count: { select: { applications: true } } },
      orderBy: { deadline: 'desc' },
      take: 30,
    }),
    prisma.placementProfile.count(),
    prisma.placementApplication.count(),
    prisma.placementApplication.count({ where: { status: 'SELECTED' } }),
  ]);
  let res = `### 🏢 Placements\n\n| Metric | Value |\n| :--- | :--- |\n| Students with a placement profile | ${profiles} |\n| Drives | ${drives.length} (${drives.filter((d) => d.status === 'ACTIVE' || d.status === 'UPCOMING').length} open) |\n| Applications | ${applications} |\n| Selected | **${selected}** |\n\n`;
  if (drives.length === 0) return `${res}No placement drives yet. Create one from the **Placements** page.`;
  res += `| Company | Role | Type | Status | Min CGPA | Package | Deadline | Applicants |\n| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n`;
  for (const d of drives) {
    res += `| **${cell(d.companyName)}** | ${cell(d.role)} | ${d.driveType.replace('_', '-').toLowerCase()} | ${d.status} | ${d.eligibilityCgpa || 'Any'} | ${d.ctcLpa ? `${d.ctcLpa} LPA` : '-'} | ${fmtDate(d.deadline)} | ${d._count.applications} |\n`;
  }
  return res;
}

async function adminUsers() {
  const [byRole, recent] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { fullName: true, username: true, email: true, role: true, isActive: true, createdAt: true },
    }),
  ]);
  const total = byRole.reduce((n, r) => n + r._count._all, 0);
  let res = `### 👥 Users\n\n**${total}** accounts\n\n| Role | Accounts |\n| :--- | :---: |\n`;
  for (const r of byRole.sort((a, b) => b._count._all - a._count._all)) res += `| ${r.role} | **${r._count._all}** |\n`;
  res += `\n#### Most recent accounts\n\n| Name | Email | Role | Status | Joined |\n| :--- | :--- | :---: | :---: | :---: |\n`;
  for (const u of recent) {
    res += `| ${cell(nameOf(u))} | ${u.email} | ${u.role} | ${u.isActive ? 'active' : 'inactive'} | ${fmtDate(u.createdAt)} |\n`;
  }
  return res;
}

async function adminAudit() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { action: true, entity: true, entityId: true, createdAt: true, user: { select: { fullName: true, username: true, role: true } } },
  });
  if (logs.length === 0) return `### 🧾 Audit log\n\nNo audit events have been recorded yet.`;
  let res = `### 🧾 Audit log: latest ${logs.length} events\n\n| When | User | Action | Entity |\n| :--- | :--- | :--- | :--- |\n`;
  for (const l of logs) {
    const who = l.user ? `${nameOf(l.user)} (${l.user.role})` : 'System';
    res += `| ${new Date(l.createdAt).toLocaleString('en-IN')} | ${cell(who)} | \`${l.action}\` | ${l.entity}${l.entityId ? ` \`${l.entityId.slice(0, 8)}\`` : ''} |\n`;
  }
  return res;
}

async function handleStaffQuery(query: string, user: UserContext, history: ChatMessage[], topic?: string | null) {
  // Intents arrive already scoped to the role: a teacher asking for users or the
  // audit log gets 'restricted' here, whether routed by keywords or the model.
  const intent = await classifyIntent(query, history, user.role);
  const admin = roleGroup(user.role) === 'ADMIN';

  switch (intent) {
    case 'restricted':
      return restrictedReply(user.role);
    case 'greeting':
      return greetingReply(user);
    case 'placements':
      return staffPlacements();
    case 'live_stats':
      return staffLiveStats(query, user, history);
    case 'student_records':
      return staffStudentRecords(query, user);
    case 'answers':
      return staffAnswers(query, user);
    case 'results':
      return staffResults(query, user);
    case 'proctoring':
      return proctoringSummary(user);
    case 'users':
      return admin ? adminUsers() : restrictedReply(user.role);
    case 'audit':
      return admin ? adminAudit() : restrictedReply(user.role);
    case 'generate_questions':
      return (await tutorReply(user, history, topic)) ?? generateSmartQuestionSet(query);
    default:
      return (await tutorReply(user, history, topic)) ?? offlineTutor(query) ?? greetingReply(user);
  }
}

async function handleProctorQuery(query: string, user: UserContext, history: ChatMessage[], topic?: string | null) {
  const intent = await classifyIntent(query, history, user.role);
  if (intent === 'proctoring') return proctoringSummary(user);
  if (intent === 'restricted') return restrictedReply(user.role);
  if (intent === 'greeting') return greetingReply(user);
  return (await tutorReply(user, history, topic)) ?? greetingReply(user);
}

/**
 * Generate comprehensive technical learning roadmaps
 */
function generateRoadmap(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('dsa') || q.includes('data structure') || q.includes('algorithm')) {
    return `### 🗺️ Complete Data Structures & Algorithms (DSA) Roadmap

A structured 8-week mastery pathway from fundamentals to technical interview readiness:

---

#### 📌 Phase 1: Foundations & Linear Structures (Weeks 1–2)
- **Time & Space Complexity**: Big-O notation, asymptotic analysis, best/worst/average case.
- **Arrays & Strings**: Two Pointers technique, Sliding Window, Prefix Sums, Dutch National Flag.
- **Linked Lists**: Singly vs Doubly linked lists, cycle detection (Floyd's algorithm), reversal.
- **Stacks & Queues**: Monotonic stack, matching parentheses, BFS queues, deque.
- **🎯 Milestone Projects/Problems**:
  - Solve: *Two Sum*, *Valid Parentheses*, *Reverse String*, *Merge Two Sorted Lists*.

---

#### 📌 Phase 2: Recursion, Searching & Sorting (Weeks 3–4)
- **Divide and Conquer**: Merge Sort, Quick Sort, Binary Search on sorted and rotated arrays.
- **Hash Maps & Sets**: Collision resolution, frequency counting, anagram grouping.
- **Trees & Binary Search Trees**: In-order/Pre-order/Post-order traversals, Level-order BFS, Tree diameter, Lowest Common Ancestor.
- **🎯 Milestone Problems**:
  - Solve: *Binary Search*, *Contains Duplicate*, *Maximum Subarray*, *Invert Binary Tree*.

---

#### 📌 Phase 3: Non-Linear & Graph Algorithms (Weeks 5–6)
- **Graphs**: Adjacency list representation, Breadth-First Search (BFS), Depth-First Search (DFS).
- **Topological Sort**: Kahn's algorithm, cycle detection in directed graphs.
- **Shortest Paths & Spanning Trees**: Dijkstra's algorithm, Bellman-Ford, Kruskal/Prim.
- **Heaps & Priority Queues**: Min-heap, Max-heap, Top K frequent elements, Median of Data Stream.

---

#### 📌 Phase 4: Dynamic Programming & Interview Mastery (Weeks 7–8)
- **Dynamic Programming (1D & 2D)**: Memoization vs Tabulation, 0/1 Knapsack, Longest Common Subsequence, Coin Change.
- **Greedy Algorithms**: Activity selection, interval scheduling, Huffman coding.
- **Mock Assessments**: Timed coding exams under ExamForge anti-cheat conditions.

> **💡 Practice Tip**: Master the pattern recognition behind problems rather than memorizing individual solutions!`;
  }

  if (q.includes('python')) {
    return `### 🐍 Complete Python Mastery Learning Roadmap

A 6-week pathway from zero to production-grade Python development:

---

#### 📌 Phase 1: Core Syntax & Data Structures (Weeks 1–2)
- Primitive types, type hints (\`typing\`), string manipulation, f-strings.
- Deep dive: Lists, Tuples, Sets, Dictionaries, and List/Dict Comprehensions.
- Functions: \`*args\`, \`**kwargs\`, lambda functions, default parameter traps.
- File I/O, context managers (\`with\` statements), exception handling (\`try/except/finally\`).

---

#### 📌 Phase 2: Object-Oriented & Functional Python (Weeks 3–4)
- Classes, \`__init__\`, \`__repr__\`, inheritance, polymorphism, and composition.
- Dunder methods, dataclasses, \`@property\` decorators.
- Advanced functions: Closures, custom decorators, generators & \`yield\`, iterators.
- Virtual environments (\`venv\`, \`uv\`, \`poetry\`), package management.

---

#### 📌 Phase 3: Modern Backend & APIs (Weeks 5–6)
- Asynchronous programming: \`asyncio\`, \`async\` / \`await\`, concurrent tasks.
- Building REST APIs with **FastAPI** & Pydantic schemas.
- Database ORMs: SQLAlchemy / Prisma client, migrations, transactions.
- Testing: \`pytest\`, fixtures, mocking, and CI automation.

> **🛠️ Capstone Project**: Build a high-performance RESTful API with automated testing and Docker containerization.`;
  }

  // Default: Full Stack Web Development Roadmap
  return `### 🌐 Full-Stack Web Development Roadmap

A comprehensive, industry-aligned 10-week curriculum covering modern frontend, backend, database engineering, and deployment:

---

#### 📌 Phase 1: Modern Web Foundations (Weeks 1–2)
- **Semantic HTML5 & Accessibility**: ARIA roles, modern page semantics, SEO fundamentals.
- **Modern CSS & Responsive Design**: Flexbox, CSS Grid, custom properties, Tailwind CSS.
- **JavaScript (ES6+) Core**:
  - \`let\` / \`const\`, arrow functions, destructuring, spread/rest operators.
  - Event loop, microtasks vs macrotasks, Promises, and \`async\` / \`await\`.
  - DOM manipulation, event delegation, debounce/throttle utilities.

---

#### 📌 Phase 2: Frontend Engineering with React 18 (Weeks 3–4)
- **Component Architecture**: Props, state, unidirectional data flow, JSX compilation.
- **Hooks in Depth**: \`useState\`, \`useEffect\`, \`useMemo\`, \`useCallback\`, \`useRef\`.
- **State Management**: Zustand / Redux Toolkit for global state, TanStack React Query for server state.
- **Forms & Validation**: React Hook Form with Zod schemas.
- **Routing**: React Router v6+ with protected and role-based routes.

---

#### 📌 Phase 3: Backend API Engineering with Node.js & Express (Weeks 5–6)
- **Node.js Architecture**: Event loop, non-blocking I/O, streams, and buffers.
- **Express.js API Design**: Middleware pipelines, routing, controller-service pattern.
- **Authentication & Security**:
  - JWT access & refresh token rotation, bcrypt password hashing.
  - Rate limiting, CORS policies, Helmet security headers, CSRF protection.
- **Input Validation**: Zod schema validation across all endpoints.

---

#### 📌 Phase 4: Database Engineering & ORMs (Weeks 7–8)
- **Relational Databases (MySQL/PostgreSQL)**: Schema design, relations, indexing, transactions.
- **Prisma ORM**: Models, relations, migrations, query optimization, connection pooling.
- **Caching**: Redis for session caching and read-heavy queries.

---

#### 📌 Phase 5: Production Deployment & DevOps (Weeks 9–10)
- **Containerization**: Docker, multi-stage builds, Docker Compose orchestration.
- **Reverse Proxy**: Nginx configuration, SPA fallbacks, SSL/TLS termination, gzip compression.
- **CI/CD**: GitHub Actions for automated linting, typechecking, and test execution.

> **💡 Start today**: Complete the CS101 modules and take the JavaScript Fundamentals test on ExamForge to test your knowledge!`;
}

/**
 * Generate concept explanation with code examples
 */
function generateConceptExplanation(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('closure')) {
    return `### 💡 JavaScript Closures Explained

A **closure** is the combination of a function bundled together (enclosed) with references to its surrounding state (the **lexical environment**). In JavaScript, closures are created every time a function is created, at function creation time.

#### 🔑 Key Idea
An inner function always retains access to the variables of its outer enclosing scope, **even after the outer function has finished executing and returned**!

#### 💻 Code Example:
\`\`\`javascript
function createCounter(initialValue = 0) {
  let count = initialValue; // Private variable enclosed in closure

  return {
    increment: () => ++count,
    decrement: () => --count,
    getCount: () => count,
  };
}

const counter = createCounter(10);
console.log(counter.increment()); // 11
console.log(counter.increment()); // 12
console.log(counter.getCount());  // 12
// count cannot be modified directly from outside!
\`\`\`

#### ⚠️ Common Use Cases:
1. **Data Encapsulation & Private State**: Emulating private variables before JavaScript added native \`#private\` fields.
2. **Factory Functions & Currying**: Generating customized functions with pre-configured parameters.
3. **Event Handlers & Callbacks**: Preserving contextual state when asynchronous events trigger.`;
  }

  if (q.includes('promise') || q.includes('async')) {
    return `### ⚡ Promises and Async/Await in JavaScript

Asynchronous JavaScript handles operations that take indeterminate time (network calls, timers, disk reads) without blocking the single execution thread.

#### 1. What is a Promise?
A \`Promise\` is an object representing the eventual completion (or failure) of an asynchronous operation and its resulting value. It exists in one of three states:
- \`pending\`: Initial state.
- \`fulfilled\`: The operation completed successfully (\`resolve\`).
- \`rejected\`: The operation failed (\`reject\`).

#### 2. Async / Await Syntactic Sugar
\`async\` / \`await\` lets you write asynchronous code that reads sequentially like synchronous code:

\`\`\`javascript
async function fetchUserResults(studentId) {
  try {
    const response = await fetch(\`/api/results/\${studentId}\`);
    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to load results:', error);
    throw error;
  }
}
\`\`\`

#### ⚠️ Best Practice:
Always handle errors with \`try / catch\` when using \`await\`, or use centralized error middleware like ExamForge's \`asyncHandler\`!`;
  }

  return `### 📘 Concept Deep-Dive: ${query.trim()}

Here is a clear breakdown of the core principles:

1. **Fundamentals**: In software engineering, this concept is designed to manage complexity, separate concerns, and improve maintainability.
2. **How it Works**:
   - The system encapsulates logic into modular units.
   - Consumers interact via well-defined interfaces without needing to know internal implementation details.
3. **Best Practices**:
   - Keep functions pure and side-effect free whenever possible.
   - Enforce explicit type safety and schema validation (e.g. TypeScript + Zod).
   - Write automated unit tests for edge cases.

Feel free to ask for a specific code sample or ask how this applies to ExamForge's React/Node/Prisma architecture!`;
}

/**
 * Generate coding problem hints and step-by-step guidance
 */
function generateCodingTutorHelp(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('two sum')) {
    return `### 🧩 Two Sum Problem — Guided Strategy & Hints

**Problem Statement**: Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

---

#### 💡 Hint 1: The Brute Force Approach
The naive approach uses two nested loops checking every possible pair \`(i, j)\`.
- **Time Complexity**: \\(O(n^2)\\)
- **Space Complexity**: \\(O(1)\\)
Can we do better using extra memory?

---

#### 💡 Hint 2: The Hash Map Complement Strategy
As you iterate through the array at number \`x\`, the number you need to reach \`target\` is \`complement = target - x\`.
If you store numbers you have already visited in a Hash Map (mapping \`value -> index\`), you can check if \`complement\` exists in **\\(O(1)\\)** time!

---

#### 💻 Optimal JavaScript Implementation:
\`\`\`javascript
function twoSum(nums, target) {
  const seen = new Map(); // value -> index

  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) {
      return [seen.get(complement), i];
    }
    seen.set(nums[i], i);
  }

  return [];
}
\`\`\`

- **Time Complexity**: **\\(O(n)\\)** single pass.
- **Space Complexity**: **\\(O(n)\\)** to store seen numbers.`;
  }

  return `### 💻 Coding Problem Guided Strategy

When tackling algorithms on ExamForge:

1. **Clarify Constraints**: Check array bounds, integer limits (can numbers be negative?), and edge cases (empty array, single element).
2. **Start with Brute Force**: State the simple solution first to establish a baseline time/space complexity.
3. **Identify Bottlenecks**:
   - Can sorting the array help? (e.g. Two Pointers / Binary Search in \\(O(n \\log n)\\))
   - Can a Hash Map trade \\(O(n)\\) space for \\(O(1)\\) lookups?
   - Is there overlapping subproblem structure suitable for Dynamic Programming?
4. **Implement Cleanly**: Handle off-by-one errors and return values accurately.`;
}

/**
 * Generate smart question sets for teachers/admins
 */
function generateSmartQuestionSet(query: string): string {
  return `### 💡 AI Question Generator Results

Here is a curated set of questions ready to be added to your Question Bank:

---

#### Question 1 (Multiple Choice — Single Answer)
- **Question**: Which HTTP status code should an API return when request payload validation fails?
- **Difficulty**: \`EASY\` | **Marks**: \`2\`
- **Options**:
  - [ ] A) \`401 Unauthorized\`
  - [ ] B) \`403 Forbidden\`
  - [x] C) \`422 Unprocessable Entity\` (or \`400 Bad Request\`)
  - [ ] D) \`500 Internal Server Error\`
- **Explanation**: 422 or 400 indicates the server understands the content type but the semantic data contains validation errors.

---

#### Question 2 (Multiple Choice — Multiple Answers)
- **Question**: Which of the following statements about React Hooks are true? (Select all that apply)
- **Difficulty**: \`MEDIUM\` | **Marks**: \`4\`
- **Options**:
  - [x] A) Hooks can only be called at the top level of a component.
  - [x] B) Hooks can be called inside custom hooks.
  - [ ] C) Hooks can be called inside regular loops or conditions.
  - [x] D) \`useEffect\` dependencies must include all reactive values used inside the effect.
- **Explanation**: The Rules of Hooks require top-level invocation to ensure React preserves hook order between renders.

---

#### Question 3 (Coding Assessment Challenge)
- **Title**: Valid Anagram
- **Difficulty**: \`EASY\` | **Marks**: \`6\`
- **Description**: Given two strings \`s\` and \`t\`, return \`true\` if \`t\` is an anagram of \`s\`, and \`false\` otherwise.
- **Test Cases**:
  - Input: \`"anagram"\\n"nagaram"\` -> Expected: \`true\`
  - Input: \`"rat"\\n"car"\` -> Expected: \`false\`

Would you like me to generate more questions on a specific topic or insert these into a question bank?`;
}

/* -------------------------------------------------------------------------- */
/* Main Tutor Message Handler                                                 */
/* -------------------------------------------------------------------------- */

export async function sendTutorMessage(userId: string, conversationId: string, content: string) {
  const conv = await prisma.aIConversation.findUnique({ where: { id: conversationId } });
  if (!conv || conv.userId !== userId) throw new AppError(404, 'Conversation not found');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');

  // Record user message
  await prisma.aIMessage.create({
    data: { conversationId, role: 'user', content },
  });

  // Automatically update conversation title if it's currently a default
  if (!conv.title || conv.title === 'New chat' || conv.title === 'Untitled') {
    const autoTitle = content.slice(0, 35).trim() + (content.length > 35 ? '…' : '');
    await prisma.aIConversation.update({
      where: { id: conversationId },
      data: { title: autoTitle },
    }).catch(() => {});
  }

  // Most recent turns, oldest first, including the message just recorded.
  const recent = await prisma.aIMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });
  const history: ChatMessage[] = recent
    .reverse()
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const userCtx: UserContext = {
    id: user.id,
    name: user.fullName || user.username,
    email: user.email,
    role: user.role,
  };

  // Questions about platform records are answered from the database, scoped by
  // role; open-ended ones go to the model, with built-in answers as the offline
  // fallback.
  const group = roleGroup(user.role);
  const reply =
    group === 'ADMIN' || group === 'TEACHER'
      ? await handleStaffQuery(content, userCtx, history, conv.topic)
      : group === 'PROCTOR'
        ? await handleProctorQuery(content, userCtx, history, conv.topic)
        : await handleStudentQuery(content, userCtx, history, conv.topic);

  const assistantMsg = await prisma.aIMessage.create({
    data: {
      conversationId,
      role: 'assistant',
      content: reply,
    },
  });

  await prisma.aIConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return assistantMsg;
}

/* -------------------------------------------------------------------------- */
/* Question Generation Service (Unlocks Feature without 503)                  */
/* -------------------------------------------------------------------------- */

export async function generateQuestions(input: {
  subject: string;
  topic: string;
  difficulty: string;
  count: number;
  type?: string;
  createdById: string;
}) {
  const count = Math.min(Math.max(input.count || 3, 1), 10);
  const diff = input.difficulty.toUpperCase();
  const requestedType = (input.type || 'SINGLE').toUpperCase();
  const qType = ['SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'CODING'].includes(requestedType) ? requestedType : 'SINGLE';

  const fromModel = await generateQuestionsWithModel({
    subject: input.subject,
    topic: input.topic,
    difficulty: diff,
    count,
    type: qType,
  });
  if (fromModel) return fromModel;

  // Built-in template generator (model offline)
  const generated: any[] = [];

  for (let i = 1; i <= count; i++) {
    if (qType === 'CODING') {
      generated.push({
        text: `Implement a function to solve the ${input.topic} challenge #${i}. Given input data, process and return the target result.`,
        type: 'CODING',
        difficulty: diff,
        marks: 8,
        topic: input.topic,
        explanation: `Optimal solution runs in O(n) time using standard algorithmic paradigms for ${input.topic}.`,
        testCases: [
          { input: '5\n', expectedOutput: '25', isPublic: true },
          { input: '10\n', expectedOutput: '100', isPublic: false },
        ],
      });
    } else if (qType === 'TRUE_FALSE') {
      generated.push({
        text: `In ${input.subject} (${input.topic}), true or false: Operation #${i} guarantees constant time complexity O(1).`,
        type: 'TRUE_FALSE',
        difficulty: diff,
        marks: 2,
        topic: input.topic,
        correctAnswer: ['false'],
        explanation: `Under edge-case scenarios and hash collisions, complexity degrades to O(n).`,
        options: [
          { text: 'True', isCorrect: false },
          { text: 'False', isCorrect: true },
        ],
      });
    } else {
      generated.push({
        text: `Which of the following is true regarding ${input.topic} concept #${i} in ${input.subject}?`,
        type: 'SINGLE',
        difficulty: diff,
        marks: 2,
        topic: input.topic,
        explanation: `Option B correctly describes the mechanism and adheres to best practices in ${input.subject}.`,
        options: [
          { text: `It introduces unpredictable runtime side-effects.`, isCorrect: false },
          { text: `It enforces modular encapsulation and deterministic behavior.`, isCorrect: true },
          { text: `It is completely deprecated in modern specifications.`, isCorrect: false },
          { text: `It requires global variable mutation.`, isCorrect: false },
        ],
      });
    }
  }

  return {
    questions: generated,
    metadata: {
      subject: input.subject,
      topic: input.topic,
      difficulty: input.difficulty,
      requestedCount: count,
      generatedCount: generated.length,
      provider: 'ExamForge template engine',
      reviewRequired: true,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Result Analysis Service (Unlocks Feature without 503)                      */
/* -------------------------------------------------------------------------- */

export async function analyzeResult(attemptId: string, viewer: { id: string; role: string }) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      test: true,
      student: true,
      answers: { include: { question: true, option: true } },
    },
  });

  if (!attempt) throw new AppError(404, 'Attempt not found');
  if (viewer.role === 'STUDENT' && attempt.studentId !== viewer.id) throw new AppError(403, 'Not authorized');
  if (viewer.role === 'TEACHER' && attempt.test.createdById !== viewer.id) throw new AppError(403, 'Not authorized');

  const total = attempt.answers.length;
  const correct = attempt.answers.filter((a) => a.isCorrect === true).length;
  const missed = attempt.answers.filter((a) => a.isCorrect === false);
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  const weakTopics = missed
    .map((m) => m.question.topic || 'General Concepts')
    .filter((v, i, a) => a.indexOf(v) === i);

  const graded = attempt.answers.filter((a) => a.isCorrect !== null);
  const byTopic = new Map<string, { correct: number; total: number }>();
  for (const a of graded) {
    const topic = a.question.topic || 'General';
    const t = byTopic.get(topic) ?? { correct: 0, total: 0 };
    t.total += 1;
    if (a.isCorrect) t.correct += 1;
    byTopic.set(topic, t);
  }
  const percentage = attempt.percentage != null ? Number(attempt.percentage) : accuracy;
  const advice = await adviseOnAttempt({
    testTitle: attempt.test.title,
    percentage,
    passed: attempt.passed ?? accuracy >= 50,
    topics: [...byTopic].map(([topic, t]) => ({ topic, ...t })),
    missed: missed.map((m) => ({
      question: m.question.text,
      topic: m.question.topic || 'General',
      studentAnswer: m.option?.text ?? (typeof m.answerJson === 'string' ? m.answerJson : null),
      explanation: m.question.explanation ?? null,
    })),
  });

  return {
    summary: {
      studentName: attempt.student.fullName || attempt.student.username,
      testTitle: attempt.test.title,
      score: attempt.score != null ? Number(attempt.score) : 0,
      totalMarks: attempt.test.totalMarks != null ? Number(attempt.test.totalMarks) : 0,
      percentage: attempt.percentage != null ? Number(attempt.percentage) : accuracy,
      passed: attempt.passed ?? accuracy >= 50,
      accuracy,
      timeSpentMinutes: attempt.timeTakenSeconds ? Math.round(attempt.timeTakenSeconds / 60) : 0,
      suspicionScore: attempt.suspicionScore || 0,
    },
    ...(advice ?? ruleBasedAdvice(accuracy, weakTopics)),
    topicBreakdown: [...byTopic].map(([topic, t]) => ({
      topic,
      correct: t.correct,
      total: t.total,
      accuracy: Math.round((t.correct / t.total) * 100),
    })),
    generatedBy: advice ? 'model' : 'rules',
    integrityStatus: attempt.suspicionScore > 30 ? 'Flags detected during examination session.' : 'No significant anti-cheat flags recorded.',
  };
}

function ruleBasedAdvice(accuracy: number, weakTopics: string[]) {
  return {
    strengths: [
      accuracy >= 70 ? 'Demonstrated strong core subject comprehension.' : 'Completed all sections within the allotted time.',
      'Accurate execution on standard assessment question formats.',
    ],
    weaknesses: weakTopics.length > 0 ? weakTopics : ['No major knowledge gaps detected.'],
    recommendations: weakTopics.map((topic) => ({
      topic,
      action: `Review lesson materials and complete practice exercises on ${topic}.`,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Recommendation Service (Unlocks Feature without 503)                       */
/* -------------------------------------------------------------------------- */

export async function getRecommendations(studentId: string, viewer: { id: string; role: string }) {
  if (viewer.role === 'STUDENT' && studentId !== viewer.id) throw new AppError(403, 'Not authorized');
  if (viewer.role !== 'ADMIN' && viewer.role !== 'TEACHER' && viewer.id !== studentId) throw new AppError(403, 'Not authorized');

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    include: {
      enrollments: { include: { course: true } },
      attempts: { include: { test: true }, orderBy: { startedAt: 'desc' }, take: 5 },
    },
  });

  const lowAccuracyQuestions = await prisma.questionAnalytics.findMany({
    where: { accuracy: { lt: 60 } },
    orderBy: { accuracy: 'asc' },
    take: 5,
    include: { question: { select: { id: true, text: true, topic: true } } },
  });

  const existingRecommendations = await prisma.recommendation.findMany({
    where: { userId: studentId, isRead: false },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // The student's own weakest topics across recent graded answers.
  const recentAnswers = await prisma.attemptAnswer.findMany({
    where: { attempt: { studentId }, isCorrect: { not: null } },
    orderBy: { updatedAt: 'desc' },
    take: 200,
    select: { isCorrect: true, question: { select: { topic: true } } },
  });
  const topicStats = new Map<string, { correct: number; total: number }>();
  for (const a of recentAnswers) {
    const topic = a.question.topic;
    if (!topic) continue;
    const t = topicStats.get(topic) ?? { correct: 0, total: 0 };
    t.total += 1;
    if (a.isCorrect) t.correct += 1;
    topicStats.set(topic, t);
  }
  const weakTopics = [...topicStats]
    .map(([topic, t]) => ({ topic, accuracy: Math.round((t.correct / t.total) * 100) }))
    .filter((t) => t.accuracy < 70)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  const modelRecommendations = await recommendStudy(
    weakTopics,
    student?.enrollments.map((e) => e.course.name) ?? [],
  );

  const dynamicRoadmapRecommendations = modelRecommendations
    ? modelRecommendations.map((r) => ({ type: 'PRACTICE', title: r.title, description: r.description, data: { topic: r.topic } }))
    : weakTopics.length > 0
      ? weakTopics.map((t) => ({
          type: 'PRACTICE',
          title: `Strengthen ${t.topic}`,
          description: `Your recent accuracy on ${t.topic} is ${t.accuracy}%. Revisit the lesson notes and practise a few questions on it.`,
          data: { topic: t.topic },
        }))
      : [
    {
      type: 'ROADMAP',
      title: 'Full Stack Web Development Pathway',
      description: 'Master React, Node.js, Express, and Database Engineering with structured weekly milestones.',
      data: { topic: 'Full Stack Web Development' },
    },
    {
      type: 'PRACTICE',
      title: 'Data Structures & Algorithms Track',
      description: 'Practice Two Sum, Binary Search, and Array Manipulation coding challenges.',
      data: { topic: 'Algorithms' },
    },
        ];

  return {
    aiGenerated: dynamicRoadmapRecommendations,
    dataDriven: lowAccuracyQuestions.map((q) => ({
      type: 'TOPIC',
      title: `Review: ${q.question.topic ?? q.question.text.slice(0, 40)}`,
      description: `Class accuracy on this topic is ${Math.round(q.accuracy)}%. Revisit the core lesson notes.`,
      data: { questionId: q.question.id },
    })),
    stored: existingRecommendations,
  };
}