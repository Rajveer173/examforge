import { prisma } from '../config/database.js';

/**
 * Live, role-scoped snapshots of platform data for the assistant. Each one is
 * read fresh from the database on every question, so answers like "how many
 * assignments are pending" or "how many students graduate this year" reflect
 * the current state, not a cached report.
 *
 * Scope is decided here, in code, by the caller's role:
 * - student: that student's own tests, assignments and coding problems;
 * - teacher: aggregates over content they created, plus student and placement totals;
 * - admin: platform-wide aggregates including accounts by role.
 * Snapshots hold counts and titles only: never emails, passwords or other users' marks.
 */

const DAY = 24 * 60 * 60 * 1000;
const round = (v: number, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp;
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') : null);
const countBy = <T>(xs: T[], key: (x: T) => string | number | null | undefined) => {
  const out: Record<string, number> = {};
  for (const x of xs) {
    const k = String(key(x) ?? 'unknown');
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
};
const grouped = (rows: { _count: { _all: number } }[], key: (r: any) => unknown) =>
  Object.fromEntries(rows.map((r) => [String(key(r) ?? 'unknown'), r._count._all]));

/* -------------------------------------------------------------- student */

export async function studentWorkload(studentId: string) {
  const now = new Date();
  const enrolled = await prisma.enrollment.findMany({ where: { userId: studentId }, select: { courseId: true } });
  const courseIds = enrolled.map((e) => e.courseId);
  const inMyCourses = { OR: [{ courseId: null }, { courseId: { in: courseIds } }] };

  const [testAssignments, assignments, problems] = await Promise.all([
    prisma.testAssignment.findMany({
      where: {
        test: { status: 'PUBLISHED' },
        OR: [{ studentId }, { class: { students: { some: { studentId } } } }],
      },
      select: {
        dueAt: true,
        test: {
          select: {
            id: true,
            title: true,
            examMode: true,
            durationMinutes: true,
            totalMarks: true,
            maxAttempts: true,
            startAt: true,
            endAt: true,
            course: { select: { name: true } },
            testQuestions: { select: { question: { select: { type: true } } } },
            attempts: { where: { studentId }, select: { status: true, percentage: true, passed: true } },
          },
        },
      },
    }),
    prisma.assignment.findMany({
      where: inMyCourses,
      select: {
        title: true,
        dueAt: true,
        maxMarks: true,
        course: { select: { name: true } },
        submissions: { where: { studentId }, select: { submittedAt: true, marks: true } },
      },
      orderBy: { dueAt: 'asc' },
    }),
    prisma.codingProblem.findMany({
      where: inMyCourses,
      select: {
        title: true,
        difficulty: true,
        course: { select: { name: true } },
        submissions: { where: { userId: studentId }, select: { status: true } },
      },
    }),
  ]);

  // One test can be assigned both directly and through a class.
  const tests = new Map<string, (typeof testAssignments)[number]['test'] & { dueAt: Date | null }>();
  for (const a of testAssignments) {
    const prev = tests.get(a.test.id);
    const due = a.dueAt ?? a.test.endAt;
    if (!prev || (due && (!prev.dueAt || due < prev.dueAt))) tests.set(a.test.id, { ...a.test, dueAt: due });
  }

  const testRows = [...tests.values()].map((t) => {
    const submitted = t.attempts.filter((a) => a.status !== 'IN_PROGRESS');
    const inProgress = t.attempts.some((a) => a.status === 'IN_PROGRESS');
    const closed = (t.endAt && t.endAt < now) || (t.dueAt && t.dueAt < now);
    const notOpenYet = t.startAt && t.startAt > now;
    const state = submitted.length
      ? 'completed'
      : inProgress
        ? 'in_progress'
        : closed
          ? 'missed'
          : notOpenYet
            ? 'upcoming'
            : 'pending';
    return {
      title: t.title,
      course: t.course?.name ?? null,
      mode: t.examMode,
      state,
      opensAt: iso(t.startAt),
      dueAt: iso(t.dueAt),
      durationMinutes: t.durationMinutes,
      totalMarks: Number(t.totalMarks),
      attemptsUsed: t.attempts.length,
      maxAttempts: t.maxAttempts,
      bestPercentage: submitted.length ? Math.max(...submitted.map((a) => Number(a.percentage ?? 0))) : null,
      questionTypes: countBy(t.testQuestions, (q) => q.question.type),
    };
  });

  const assignmentRows = assignments.map((a) => {
    const sub = a.submissions[0];
    return {
      title: a.title,
      course: a.course?.name ?? null,
      dueAt: iso(a.dueAt),
      maxMarks: Number(a.maxMarks),
      state: sub ? (sub.marks != null ? 'graded' : 'submitted') : a.dueAt && a.dueAt < now ? 'overdue' : 'pending',
      marks: sub?.marks != null ? Number(sub.marks) : null,
    };
  });

  const codingRows = problems.map((p) => ({
    title: p.title,
    course: p.course?.name ?? null,
    difficulty: p.difficulty,
    state: p.submissions.some((s) => s.status === 'ACCEPTED')
      ? 'solved'
      : p.submissions.length
        ? 'attempted'
        : 'not_started',
    submissions: p.submissions.length,
  }));
  const openCoding = codingRows.filter((c) => c.state !== 'solved');
  const pendingTests = testRows.filter((t) => t.state === 'pending' || t.state === 'in_progress' || t.state === 'upcoming');

  return {
    generatedAt: iso(now),
    summary: {
      testsAssigned: testRows.length,
      testsByState: countBy(testRows, (t) => t.state),
      assignmentsTotal: assignmentRows.length,
      assignmentsByState: countBy(assignmentRows, (a) => a.state),
      codingProblemsTotal: codingRows.length,
      codingByState: countBy(codingRows, (c) => c.state),
      openCodingByDifficulty: countBy(openCoding, (c) => c.difficulty),
      questionTypesInPendingTests: pendingTests.reduce<Record<string, number>>((acc, t) => {
        for (const [k, v] of Object.entries(t.questionTypes)) acc[k] = (acc[k] ?? 0) + v;
        return acc;
      }, {}),
    },
    tests: testRows.sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9')),
    assignments: assignmentRows,
    codingProblems: codingRows,
  };
}

/* ---------------------------------------------------------------- staff */

export async function staffSnapshot(viewer: { id: string; admin: boolean }) {
  const now = new Date();
  const year = now.getFullYear();
  const mine = viewer.admin ? {} : { createdById: viewer.id };
  const myTests = viewer.admin ? {} : { test: { createdById: viewer.id } };

  const [
    usersByRole,
    blocked,
    newUsers7d,
    activeToday,
    studentTotal,
    gradYears,
    branches,
    profiles,
    batches,
    courses,
    enrollments,
    testsByStatus,
    attemptsByStatus,
    passStats,
    passedCount,
    attemptsToday,
    questionsByType,
    questionsByDifficulty,
    codingByDifficulty,
    codeSubs,
    acceptedSubs,
    assignmentTotal,
    assignmentSubs,
    ungraded,
    drivesByStatus,
    applicationsByStatus,
    placedStudents,
    flaggedSessions,
  ] = await Promise.all([
    viewer.admin ? prisma.user.groupBy({ by: ['role'], _count: { _all: true } }) : Promise.resolve(null),
    viewer.admin ? prisma.user.count({ where: { OR: [{ isBlocked: true }, { isActive: false }] } }) : Promise.resolve(null),
    viewer.admin ? prisma.user.count({ where: { createdAt: { gte: new Date(+now - 7 * DAY) } } }) : Promise.resolve(null),
    viewer.admin ? prisma.user.count({ where: { lastLoginAt: { gte: new Date(+now - DAY) } } }) : Promise.resolve(null),
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.placementProfile.groupBy({ by: ['graduationYear'], _count: { _all: true } }),
    prisma.placementProfile.groupBy({ by: ['branch'], _count: { _all: true } }),
    prisma.placementProfile.aggregate({ _count: { _all: true }, _avg: { cgpa: true } }),
    prisma.batch.findMany({ select: { name: true, startYear: true, endYear: true, _count: { select: { students: true } } } }),
    prisma.course.count(),
    prisma.enrollment.count(),
    prisma.test.groupBy({ by: ['status'], where: mine, _count: { _all: true } }),
    prisma.attempt.groupBy({ by: ['status'], where: myTests, _count: { _all: true } }),
    prisma.attempt.aggregate({ where: { ...myTests, status: { not: 'IN_PROGRESS' } }, _avg: { percentage: true }, _count: { _all: true } }),
    prisma.attempt.count({ where: { ...myTests, passed: true } }),
    prisma.attempt.count({ where: { ...myTests, startedAt: { gte: new Date(+now - DAY) } } }),
    prisma.question.groupBy({ by: ['type'], where: mine, _count: { _all: true } }),
    prisma.question.groupBy({ by: ['difficulty'], where: mine, _count: { _all: true } }),
    prisma.codingProblem.groupBy({ by: ['difficulty'], where: mine, _count: { _all: true } }),
    prisma.codeSubmission.count({ where: viewer.admin ? {} : { problem: { createdById: viewer.id } } }),
    prisma.codeSubmission.count({ where: { status: 'ACCEPTED', ...(viewer.admin ? {} : { problem: { createdById: viewer.id } }) } }),
    prisma.assignment.count({ where: mine }),
    prisma.assignmentSubmission.count({ where: viewer.admin ? {} : { assignment: { createdById: viewer.id } } }),
    prisma.assignmentSubmission.count({ where: { marks: null, ...(viewer.admin ? {} : { assignment: { createdById: viewer.id } }) } }),
    prisma.placementDrive.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.placementApplication.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.placementApplication.findMany({ where: { status: 'SELECTED' }, distinct: ['studentId'], select: { studentId: true } }),
    prisma.proctoringSession.count({ where: { ...myTests, suspicionScore: { gte: 50 } } }),
  ]);

  const years = grouped(gradYears, (r) => r.graduationYear);
  const known = gradYears.filter((r) => r.graduationYear != null);
  const sumWhere = (pred: (y: number) => boolean) =>
    known.filter((r) => pred(r.graduationYear!)).reduce((n, r) => n + r._count._all, 0);
  const submitted = passStats._count._all;

  return {
    generatedAt: iso(now),
    scope: viewer.admin ? 'whole platform' : 'content you created (tests, questions, assignments, coding problems); student and placement totals are platform-wide',
    ...(viewer.admin && {
      accounts: {
        byRole: grouped(usersByRole!, (r) => r.role),
        total: usersByRole!.reduce((n, r) => n + r._count._all, 0),
        blockedOrInactive: blocked,
        newInLast7Days: newUsers7d,
        loggedInLast24h: activeToday,
      },
    }),
    students: {
      total: studentTotal,
      withPlacementProfile: profiles._count._all,
      averageCgpa: profiles._avg.cgpa != null ? round(profiles._avg.cgpa, 2) : null,
      byGraduationYear: years,
      graduated: sumWhere((y) => y < year),
      graduatingThisYear: sumWhere((y) => y === year),
      graduatingLater: sumWhere((y) => y > year),
      graduationYearUnknown: studentTotal - known.reduce((n, r) => n + r._count._all, 0),
      note: 'graduation data comes from student placement profiles; students without a profile have no recorded graduation year',
      byBranch: grouped(branches, (r) => r.branch),
      batches: batches.map((b) => ({ name: b.name, startYear: b.startYear, endYear: b.endYear, students: b._count.students })),
    },
    courses: { total: courses, enrollments },
    tests: {
      byStatus: grouped(testsByStatus, (r) => r.status),
      attemptsByStatus: grouped(attemptsByStatus, (r) => r.status),
      submittedAttempts: submitted,
      passed: passedCount,
      passRatePercent: submitted ? round((passedCount / submitted) * 100) : null,
      averagePercentage: passStats._avg.percentage != null ? round(Number(passStats._avg.percentage)) : null,
      attemptsStartedLast24h: attemptsToday,
      flaggedProctoringSessions: flaggedSessions,
    },
    questionBank: {
      byType: grouped(questionsByType, (r) => r.type),
      byDifficulty: grouped(questionsByDifficulty, (r) => r.difficulty),
    },
    coding: {
      problemsByDifficulty: grouped(codingByDifficulty, (r) => r.difficulty),
      submissions: codeSubs,
      accepted: acceptedSubs,
    },
    assignments: { total: assignmentTotal, submissions: assignmentSubs, awaitingGrading: ungraded },
    placements: {
      drivesByStatus: grouped(drivesByStatus, (r) => r.status),
      applicationsByStatus: grouped(applicationsByStatus, (r) => r.status),
      studentsPlaced: placedStudents.length,
    },
  };
}
