import { env } from '../config/env.js';
import { chat, chatJson, llmEnabled, type ChatMessage } from './llm.js';

/**
 * Model-backed pieces of the AI features. Each function returns null when the
 * model is unavailable or its output fails validation, and the caller falls
 * back to the built-in engine.
 */

const HISTORY_LIMIT = 12;
const MESSAGE_CHAR_LIMIT = 2000;

/* -------------------------------------------------------------------------- */
/* Tutor chat                                                                 */
/* -------------------------------------------------------------------------- */

export interface TutorUser {
  name: string;
  role: string;
}

function tutorSystemPrompt(user: TutorUser, topic?: string | null) {
  const staff = user.role !== 'STUDENT';
  return [
    'You are the AI assistant inside ExamForge, an online exam and learning platform used by a university.',
    `You are talking to ${user.name}, whose role is ${user.role}.`,
    topic ? `This conversation is about: ${topic}.` : '',
    '',
    'How to answer:',
    '- Be accurate. If you are not sure of a fact, say so instead of guessing.',
    '- Be concise: answer the question directly, then add only the detail that helps. Stay under about 300 words unless asked for more.',
    '- Format with Markdown: short paragraphs, bullet lists, and fenced code blocks with a language tag for any code.',
    '- You cannot see marks, results, placement data or other records in this reply. If the user asks about their own data, tell them to ask, for example, "show my results" or "placement drives", which the platform answers from its records.',
    staff
      ? '- The user is staff. Help with teaching: explaining topics, drafting questions and rubrics, planning lessons. Draft questions must have one clearly correct answer.'
      : '- The user is a student. For practice or assignment problems, guide with hints and the key idea before giving a full solution, unless they ask for the full solution. Never help with cheating during a live exam.',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export async function tutorReply(user: TutorUser, history: ChatMessage[], topic?: string | null) {
  if (!llmEnabled()) return null;
  const recent = history.slice(-HISTORY_LIMIT).map((m) => ({
    role: m.role,
    content: m.content.length > MESSAGE_CHAR_LIMIT ? `${m.content.slice(0, MESSAGE_CHAR_LIMIT)}…` : m.content,
  }));
  return chat([{ role: 'system', content: tutorSystemPrompt(user, topic) }, ...recent], {
    temperature: 0.4,
    maxTokens: 900,
  });
}

/* -------------------------------------------------------------------------- */
/* Question generation                                                        */
/* -------------------------------------------------------------------------- */

export interface GeneratedQuestion {
  text: string;
  type: string;
  difficulty: string;
  marks: number;
  topic: string;
  explanation: string;
  options?: { text: string; isCorrect: boolean }[];
  correctAnswer?: string[];
  testCases?: { input: string; expectedOutput: string; isPublic: boolean }[];
  /** True when an independent pass of the model reached the same answer key. */
  verified: boolean;
}

interface GenerateInput {
  subject: string;
  topic: string;
  difficulty: string;
  count: number;
  type: string;
}

const EXAMINER_PROMPT = [
  'You are a careful university examiner writing exam questions.',
  'Rules:',
  '- Only test well-established textbook knowledge that you are certain of.',
  '- Each question must have an unambiguous answer key.',
  '- Wrong answers must be plausible to a weak student but definitely incorrect, and all answers must be different from each other.',
  '- Answers are short plain phrases, never JSON, and never "all of the above" or "none of the above".',
  '- Questions must not depend on each other and must cover different aspects of the topic.',
  '- The explanation is one or two sentences on why the key is correct.',
].join('\n');

const MARKS: Record<string, number> = { SINGLE: 2, MULTIPLE: 3, TRUE_FALSE: 1, CODING: 10 };
const MAX_ROUNDS = 3;
const GENERATION_BUDGET_MS = 70_000;

const shuffle = <T>(items: T[]) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function brief(input: GenerateInput, n: number, avoid: string[]) {
  return [
    `Subject: ${input.subject}`,
    `Topic: ${input.topic}`,
    `Difficulty: ${input.difficulty}`,
    `Write ${n} questions.`,
    avoid.length ? `Do not repeat these existing questions:\n${avoid.map((q) => `- ${q}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const stringArray = (min: number, max: number) => ({
  type: 'array',
  minItems: min,
  maxItems: max,
  items: { type: 'string' },
});

const questionList = (n: number, item: Record<string, unknown>) => ({
  type: 'object',
  properties: { questions: { type: 'array', minItems: n, maxItems: n, items: item } },
  required: ['questions'],
  additionalProperties: false,
});

/** Ask the model the question cold and return the option letters it picks. */
async function solve(question: string, options: string[], multi: boolean): Promise<string[] | null> {
  const letters = LETTERS.slice(0, options.length);
  const answer = await chatJson<{ reasoning: string; answer: string[] }>(
    [
      {
        role: 'system',
        content: `You are checking an exam question. Reason briefly (at most three sentences), then give ${
          multi ? 'every option letter that is correct' : 'the single correct option letter'
        }. If the question is ambiguous or no option is correct, answer ["X"].`,
      },
      { role: 'user', content: `${question}\n${options.map((o, i) => `${letters[i]}) ${o}`).join('\n')}` },
    ],
    {
      name: 'check',
      schema: {
        type: 'object',
        properties: {
          reasoning: { type: 'string' },
          answer: { type: 'array', minItems: 1, items: { type: 'string', enum: [...letters, 'X'] } },
        },
        required: ['reasoning', 'answer'],
        additionalProperties: false,
      },
    },
    { temperature: 0, maxTokens: 300 },
  );
  return answer?.answer ?? null;
}

async function verifyChoice(text: string, options: { text: string; isCorrect: boolean }[], multi: boolean) {
  const picked = await solve(text, options.map((o) => o.text), multi);
  if (!picked) return false;
  const expected = options.map((o, i) => (o.isCorrect ? LETTERS[i] : null)).filter(Boolean);
  return picked.length === expected.length && expected.every((l) => picked.includes(l as string));
}

// Small models sometimes leak structure into the text: inline "A) ... B) ..."
// option lists, JSON fragments, or "all of the above" style answers.
const LEAKED_STRUCTURE = /[{}[\]]|of the above|[A-F]\)|\(\s*[A-F]\s*\)/i;

function wellFormed(question: string, answers: string[]) {
  const seen = new Set(answers.map(norm));
  return (
    question.trim().length >= 15 &&
    !LEAKED_STRUCTURE.test(question) &&
    seen.size === answers.length &&
    answers.every((a) => norm(a) && !LEAKED_STRUCTURE.test(a) && a.length <= 200)
  );
}

async function generateChoiceBatch(input: GenerateInput, n: number, avoid: string[], multi: boolean) {
  const item = {
    type: 'object',
    properties: {
      question: { type: 'string' },
      correct_answers: multi ? stringArray(2, 3) : stringArray(1, 1),
      wrong_answers: multi ? stringArray(2, 3) : stringArray(3, 3),
      explanation: { type: 'string' },
    },
    required: ['question', 'correct_answers', 'wrong_answers', 'explanation'],
    additionalProperties: false,
  };
  const kind = multi
    ? 'multiple-correct questions: each has 2 or 3 correct answers and enough wrong answers for 5 options in total. Phrase each question so it is clear several options can be correct (e.g. "Which of the following ... ? Select all that apply.").'
    : 'single-correct multiple-choice questions: each has exactly one correct answer and three wrong answers.';
  const out = await chatJson<{
    questions: { question: string; correct_answers: string[]; wrong_answers: string[]; explanation: string }[];
  }>(
    [
      { role: 'system', content: EXAMINER_PROMPT },
      { role: 'user', content: `${brief(input, n, avoid)}\nThese are ${kind}` },
    ],
    { name: 'questions', schema: questionList(n, item) },
    { temperature: 0.5, maxTokens: 220 * n + 200 },
  );
  if (!out) return [];

  const candidates = out.questions.filter((q) => q.question && wellFormed(q.question, [...q.correct_answers, ...q.wrong_answers]));
  const checked = await Promise.all(
    candidates.map(async (q) => {
      const options = shuffle([
        ...q.correct_answers.map((text) => ({ text: text.trim(), isCorrect: true })),
        ...q.wrong_answers.map((text) => ({ text: text.trim(), isCorrect: false })),
      ]);
      if (!(await verifyChoice(q.question, options, multi))) return null;
      return {
        text: q.question.trim(),
        type: multi ? 'MULTIPLE' : 'SINGLE',
        difficulty: input.difficulty,
        marks: MARKS[multi ? 'MULTIPLE' : 'SINGLE'],
        topic: input.topic,
        explanation: q.explanation.trim(),
        options,
        verified: true,
      } satisfies GeneratedQuestion;
    }),
  );
  return checked.filter((q): q is NonNullable<typeof q> => q !== null);
}

async function generateTrueFalseBatch(input: GenerateInput, n: number, avoid: string[]) {
  const item = {
    type: 'object',
    properties: { statement: { type: 'string' }, is_true: { type: 'boolean' }, explanation: { type: 'string' } },
    required: ['statement', 'is_true', 'explanation'],
    additionalProperties: false,
  };
  const out = await chatJson<{ questions: { statement: string; is_true: boolean; explanation: string }[] }>(
    [
      { role: 'system', content: EXAMINER_PROMPT },
      {
        role: 'user',
        content: `${brief(input, n, avoid)}\nThese are true/false statements. Make roughly half of them false; a false statement should contain one specific, clear error.`,
      },
    ],
    { name: 'questions', schema: questionList(n, item) },
    { temperature: 0.5, maxTokens: 120 * n + 200 },
  );
  if (!out) return [];

  const checked = await Promise.all(
    out.questions
      .filter((q) => q.statement && wellFormed(q.statement, []))
      .map(async (q) => {
        const options = [
          { text: 'True', isCorrect: q.is_true },
          { text: 'False', isCorrect: !q.is_true },
        ];
        const text = `True or false: ${q.statement.trim().replace(/^true or false:\s*/i, '')}`;
        if (!(await verifyChoice(text, options, false))) return null;
        return {
          text,
          type: 'TRUE_FALSE',
          difficulty: input.difficulty,
          marks: MARKS.TRUE_FALSE,
          topic: input.topic,
          explanation: q.explanation.trim(),
          options,
          correctAnswer: [q.is_true ? 'true' : 'false'],
          verified: true,
        } satisfies GeneratedQuestion;
      }),
  );
  return checked.filter((q): q is NonNullable<typeof q> => q !== null);
}

async function generateCodingBatch(input: GenerateInput, n: number, avoid: string[]) {
  const testCase = {
    type: 'object',
    properties: { input: { type: 'string' }, expected_output: { type: 'string' } },
    required: ['input', 'expected_output'],
    additionalProperties: false,
  };
  const item = {
    type: 'object',
    properties: {
      statement: { type: 'string' },
      input_format: { type: 'string' },
      output_format: { type: 'string' },
      test_cases: { type: 'array', minItems: 3, maxItems: 4, items: testCase },
      approach: { type: 'string' },
    },
    required: ['statement', 'input_format', 'output_format', 'test_cases', 'approach'],
    additionalProperties: false,
  };
  const out = await chatJson<{
    questions: {
      statement: string;
      input_format: string;
      output_format: string;
      test_cases: { input: string; expected_output: string }[];
      approach: string;
    }[];
  }>(
    [
      { role: 'system', content: EXAMINER_PROMPT },
      {
        role: 'user',
        content: `${brief(input, n, avoid)}\nThese are programming problems that read from standard input and write to standard output. Keep each problem small and precisely specified. Test case inputs and outputs are the exact stdin and stdout text; work each expected output out carefully. "approach" describes the intended solution and its time complexity.`,
      },
    ],
    { name: 'questions', schema: questionList(n, item) },
    { temperature: 0.4, maxTokens: 450 * n + 200 },
  );
  if (!out) return [];

  return out.questions
    .filter((q) => q.statement?.trim() && q.test_cases?.length)
    .map(
      (q): GeneratedQuestion => ({
        text: `${q.statement.trim()}\n\nInput format: ${q.input_format.trim()}\nOutput format: ${q.output_format.trim()}`,
        type: 'CODING',
        difficulty: input.difficulty,
        marks: MARKS.CODING,
        topic: input.topic,
        explanation: q.approach.trim(),
        testCases: q.test_cases.map((t, i) => ({
          input: t.input,
          expectedOutput: t.expected_output,
          isPublic: i === 0,
        })),
        // Expected outputs are not executed, so a teacher has to check them.
        verified: false,
      }),
    );
}

/**
 * Generates questions with the model and keeps only those whose answer key an
 * independent solving pass agrees with. Rejected questions are replaced over a
 * few rounds; if the budget runs out, fewer than `count` may be returned.
 */
export async function generateQuestionsWithModel(input: GenerateInput) {
  if (!llmEnabled()) return null;
  const started = Date.now();
  const accepted: GeneratedQuestion[] = [];
  const seen = new Set<string>();
  let attempted = 0;
  let modelAnswered = false;

  for (let round = 0; round < MAX_ROUNDS && accepted.length < input.count; round++) {
    if (Date.now() - started > GENERATION_BUDGET_MS) break;
    const missing = input.count - accepted.length;
    // Ask for a little more than needed, since some questions fail verification.
    const n = Math.min(input.type === 'CODING' ? missing : missing + Math.ceil(missing / 3), 8);
    const avoid = accepted.map((q) => q.text.slice(0, 120));

    const batch =
      input.type === 'CODING'
        ? await generateCodingBatch(input, n, avoid)
        : input.type === 'TRUE_FALSE'
          ? await generateTrueFalseBatch(input, n, avoid)
          : await generateChoiceBatch(input, n, avoid, input.type === 'MULTIPLE');
    if (!llmEnabled()) break;
    modelAnswered = true;
    attempted += n;

    for (const q of batch) {
      const key = norm(q.text);
      if (seen.has(key) || accepted.length >= input.count) continue;
      seen.add(key);
      accepted.push(q);
    }
  }

  if (!modelAnswered) return null;
  return {
    questions: accepted,
    metadata: {
      subject: input.subject,
      topic: input.topic,
      difficulty: input.difficulty,
      requestedCount: input.count,
      generatedCount: accepted.length,
      rejectedCount: Math.max(attempted - accepted.length, 0),
      provider: env.LLM_MODEL,
      reviewRequired: accepted.some((q) => !q.verified),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Result analysis                                                            */
/* -------------------------------------------------------------------------- */

export interface AttemptFacts {
  testTitle: string;
  percentage: number;
  passed: boolean;
  topics: { topic: string; correct: number; total: number }[];
  missed: { question: string; topic: string; studentAnswer: string | null; explanation: string | null }[];
}

export interface AttemptAdvice {
  strengths: string[];
  weaknesses: string[];
  recommendations: { topic: string; action: string }[];
}

export async function adviseOnAttempt(facts: AttemptFacts): Promise<AttemptAdvice | null> {
  if (!llmEnabled()) return null;
  const topicLines = facts.topics.map((t) => `- ${t.topic}: ${t.correct}/${t.total} correct`).join('\n');
  const missedLines = facts.missed
    .slice(0, 8)
    .map(
      (m) =>
        `- [${m.topic}] ${m.question.slice(0, 300)}${m.studentAnswer ? ` | student answered: ${m.studentAnswer.slice(0, 120)}` : ''}${
          m.explanation ? ` | explanation: ${m.explanation.slice(0, 200)}` : ''
        }`,
    )
    .join('\n');

  const advice = await chatJson<AttemptAdvice>(
    [
      {
        role: 'system',
        content:
          'You are a supportive academic coach reviewing one exam attempt. Base every statement only on the data given; do not invent scores, topics or questions. Write to the student in the second person. Each strength and weakness is one specific sentence. Each recommendation names a topic from the data and gives one concrete study action.',
      },
      {
        role: 'user',
        content: `Test: ${facts.testTitle}\nScore: ${facts.percentage}% (${facts.passed ? 'passed' : 'not passed'})\n\nAccuracy by topic:\n${
          topicLines || '- no graded questions'
        }\n\nQuestions answered incorrectly:\n${missedLines || '- none'}`,
      },
    ],
    {
      name: 'advice',
      schema: {
        type: 'object',
        properties: {
          strengths: stringArray(1, 3),
          weaknesses: stringArray(1, 3),
          recommendations: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: {
              type: 'object',
              properties: { topic: { type: 'string' }, action: { type: 'string' } },
              required: ['topic', 'action'],
              additionalProperties: false,
            },
          },
        },
        required: ['strengths', 'weaknesses', 'recommendations'],
        additionalProperties: false,
      },
    },
    { temperature: 0.3, maxTokens: 700 },
  );
  if (!advice?.strengths?.length || !advice.recommendations?.length) return null;
  return advice;
}

/* -------------------------------------------------------------------------- */
/* Study recommendations                                                      */
/* -------------------------------------------------------------------------- */

export async function recommendStudy(weakTopics: { topic: string; accuracy: number }[], courses: string[]) {
  if (!llmEnabled() || weakTopics.length === 0) return null;
  const out = await chatJson<{ items: { title: string; description: string; topic: string }[] }>(
    [
      {
        role: 'system',
        content:
          'You recommend what a student should study next, based only on their weakest topics. Each recommendation has a short title (under 8 words), a one-sentence concrete description of what to practise, and the topic it addresses, copied exactly from the list.',
      },
      {
        role: 'user',
        content: `Weakest topics (accuracy on recent tests):\n${weakTopics
          .map((t) => `- ${t.topic}: ${t.accuracy}%`)
          .join('\n')}${courses.length ? `\n\nEnrolled courses: ${courses.join(', ')}` : ''}`,
      },
    ],
    {
      name: 'recommendations',
      schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: {
              type: 'object',
              properties: { title: { type: 'string' }, description: { type: 'string' }, topic: { type: 'string' } },
              required: ['title', 'description', 'topic'],
              additionalProperties: false,
            },
          },
        },
        required: ['items'],
        additionalProperties: false,
      },
    },
    { temperature: 0.3, maxTokens: 400 },
  );
  return out?.items?.length ? out.items : null;
}
