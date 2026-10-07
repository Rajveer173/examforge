// The seed runs outside the app, so it loads .env itself rather than
// inheriting DATABASE_URL from an already-booted process.
import 'dotenv/config';
import { PrismaClient, Role, QuestionType, Difficulty, TestStatus, ExamMode, AttemptStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('Admin123!', 12);
  const teacherPassword = await bcrypt.hash('Teacher123!', 12);
  const studentPassword = await bcrypt.hash('Student123!', 12);
  const proctorPassword = await bcrypt.hash('Proctor123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@examforge.dev' },
    update: {},
    create: {
      email: 'admin@examforge.dev',
      username: 'admin',
      fullName: 'System Administrator',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      isEmailVerified: true,
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@examforge.dev' },
    update: {},
    create: {
      email: 'teacher@examforge.dev',
      username: 'teacher',
      fullName: 'Demo Teacher',
      passwordHash: teacherPassword,
      role: Role.TEACHER,
      qualification: 'M.Sc. Computer Science',
      isEmailVerified: true,
    },
  });

  const student = await prisma.user.upsert({
    where: { email: 'student@examforge.dev' },
    update: {},
    create: {
      email: 'student@examforge.dev',
      username: 'student',
      fullName: 'Demo Student',
      passwordHash: studentPassword,
      role: Role.STUDENT,
      isEmailVerified: true,
    },
  });

  const proctor = await prisma.user.upsert({
    where: { email: 'proctor@examforge.dev' },
    update: {},
    create: {
      email: 'proctor@examforge.dev',
      username: 'proctor',
      fullName: 'Demo Proctor',
      passwordHash: proctorPassword,
      role: Role.PROCTOR,
      isEmailVerified: true,
    },
  });

  // Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'examforge-org' },
    update: {},
    create: {
      name: 'ExamForge University',
      slug: 'examforge-org',
      description: 'Demo educational institution',
      brandColor: '#2563eb',
    },
  });

  // Link users to org
  await Promise.all([
    prisma.user.update({ where: { id: admin.id }, data: { organizationId: org.id } }).catch(() => {}),
    prisma.user.update({ where: { id: teacher.id }, data: { organizationId: org.id } }).catch(() => {}),
    prisma.user.update({ where: { id: student.id }, data: { organizationId: org.id } }).catch(() => {}),
    prisma.user.update({ where: { id: proctor.id }, data: { organizationId: org.id } }).catch(() => {}),
  ]);

  // Department + Batch
  const dept = await prisma.department.upsert({
    where: { id: 'dept-comp-sci' },
    update: { organizationId: org.id },
    create: {
      id: 'dept-comp-sci',
      organizationId: org.id,
      name: 'Computer Science',
      code: 'CS',
    },
  });

  const academicYear = await prisma.academicYear.upsert({
    where: { id: 'ay-2026' },
    update: { organizationId: org.id },
    create: {
      id: 'ay-2026',
      organizationId: org.id,
      departmentId: dept.id,
      name: 'Academic Year 2026',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    },
  });

  const semester = await prisma.semester.upsert({
    where: { id: 'sem-1-2026' },
    update: { academicYearId: academicYear.id },
    create: {
      id: 'sem-1-2026',
      academicYearId: academicYear.id,
      name: 'Semester 1',
      orderIndex: 1,
    },
  });

  const batch = await prisma.batch.upsert({
    where: { id: 'batch-cs-2026' },
    update: { departmentId: dept.id },
    create: {
      id: 'batch-cs-2026',
      departmentId: dept.id,
      semesterId: semester.id,
      name: 'CS 2026 Batch',
      code: 'CS-2026',
      startYear: 2026,
      endYear: 2027,
    },
  });

  await prisma.batchStudent.upsert({
    where: { batchId_studentId: { batchId: batch.id, studentId: student.id } },
    update: {},
    create: { batchId: batch.id, studentId: student.id },
  });

  // Course
  const course = await prisma.course.upsert({
    where: { code: 'CS101' },
    update: {},
    create: {
      name: 'Computer Science',
      code: 'CS101',
      description: 'Introductory computer science course covering web development, algorithms, and programming fundamentals.',
      category: 'Computer Science',
      organizationId: org.id,
    },
  });

  // Enroll student
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: student.id, courseId: course.id } },
    update: {},
    create: { userId: student.id, courseId: course.id },
  });

  // Class batch
  const classBatch = await prisma.classBatch.upsert({
    where: { id: 'class-cs101-a' },
    update: { courseId: course.id, batchId: batch.id },
    create: {
      id: 'class-cs101-a',
      name: 'CS101 Section A',
      courseId: course.id,
      batchId: batch.id,
    },
  });

  await prisma.classStudent.upsert({
    where: { classId_studentId: { classId: classBatch.id, studentId: student.id } },
    update: {},
    create: { classId: classBatch.id, studentId: student.id },
  });

  // Modules + Lessons
  const module1 = await prisma.module.upsert({
    where: { id: 'mod-web-dev' },
    update: { courseId: course.id },
    create: {
      id: 'mod-web-dev',
      title: 'Web Development Fundamentals',
      description: 'Introduction to HTML, CSS, and JavaScript',
      orderIndex: 0,
      courseId: course.id,
    },
  });

  const module2 = await prisma.module.upsert({
    where: { id: 'mod-algorithms' },
    update: { courseId: course.id },
    create: {
      id: 'mod-algorithms',
      title: 'Algorithms & Data Structures',
      description: 'Core CS algorithms and data structures',
      orderIndex: 1,
      courseId: course.id,
    },
  });

  const lesson1 = await prisma.lesson.upsert({
    where: { id: 'lesson-js-basics' },
    update: { moduleId: module1.id },
    create: {
      id: 'lesson-js-basics',
      title: 'JavaScript Basics',
      content: 'JavaScript is a programming language that enables you to create dynamically updating content.',
      type: 'text',
      durationMin: 30,
      orderIndex: 0,
      moduleId: module1.id,
    },
  });

  const lesson2 = await prisma.lesson.upsert({
    where: { id: 'lesson-html-css' },
    update: { moduleId: module1.id },
    create: {
      id: 'lesson-html-css',
      title: 'HTML & CSS',
      content: 'HTML provides structure, CSS provides styling for web pages.',
      type: 'text',
      durationMin: 25,
      orderIndex: 1,
      moduleId: module1.id,
    },
  });

  await prisma.lesson.upsert({
    where: { id: 'lesson-big-o' },
    update: { moduleId: module2.id },
    create: {
      id: 'lesson-big-o',
      title: 'Big-O Notation',
      content: 'Big-O notation describes the complexity of an algorithm in terms of how its execution time grows as the input size grows.',
      type: 'video',
      videoUrl: 'https://example.com/big-o-video',
      durationMin: 45,
      orderIndex: 0,
      moduleId: module2.id,
    },
  });

  // Announcement
  await prisma.courseAnnouncement.upsert({
    where: { id: 'announcement-welcome' },
    update: { courseId: course.id, authorId: teacher.id },
    create: {
      id: 'announcement-welcome',
      courseId: course.id,
      authorId: teacher.id,
      title: 'Welcome to CS101!',
      message: 'Welcome to the computer science course. Please complete Lesson 1 & 2 before the first quiz.',
      pinned: true,
    },
  });

  // Question bank + questions
  const bank = await prisma.questionBank.upsert({
    where: { id: 'qb-js-fundamentals' },
    update: { courseId: course.id },
    create: {
      id: 'qb-js-fundamentals',
      name: 'JavaScript Fundamentals',
      courseId: course.id,
      createdById: teacher.id,
    },
  });

  // Seed a rich set of questions
  const qCount = await prisma.question.count({ where: { createdById: teacher.id } });
  if (qCount === 0) {
    const q1 = await prisma.question.create({
      data: {
        text: 'Which keyword is used to declare a block-scoped variable in JavaScript?',
        type: QuestionType.SINGLE,
        difficulty: Difficulty.EASY,
        marks: 2,
        createdById: teacher.id,
        bloomLevel: 'REMEMBER',
        topic: 'JavaScript',
        subtopic: 'Variables',
        explanation: 'let and const are block-scoped in JavaScript. var is function-scoped.',
        options: {
          create: [
            { text: 'var', isCorrect: false, orderIndex: 0 },
            { text: 'let', isCorrect: true, orderIndex: 1 },
            { text: 'const', isCorrect: false, orderIndex: 2 },
            { text: 'def', isCorrect: false, orderIndex: 3 },
          ],
        },
        tags: { create: [{ tag: 'javascript' }, { tag: 'variables' }, { tag: 'basic' }] },
      },
    });

    const q2 = await prisma.question.create({
      data: {
        text: 'In JavaScript, `typeof null` evaluates to:',
        type: QuestionType.SINGLE,
        difficulty: Difficulty.MEDIUM,
        marks: 2,
        createdById: teacher.id,
        bloomLevel: 'UNDERSTAND',
        topic: 'JavaScript',
        subtopic: 'Types',
        explanation: 'This is a well-known JavaScript quirk dating back to the first edition of ECMAScript.',
        options: {
          create: [
            { text: '"null"', isCorrect: false, orderIndex: 0 },
            { text: '"undefined"', isCorrect: false, orderIndex: 1 },
            { text: '"object"', isCorrect: true, orderIndex: 2 },
            { text: '"boolean"', isCorrect: false, orderIndex: 3 },
          ],
        },
      },
    });

    const q3 = await prisma.question.create({
      data: {
        text: 'Select all JavaScript primitive types:',
        type: QuestionType.MULTIPLE,
        difficulty: Difficulty.MEDIUM,
        marks: 3,
        createdById: teacher.id,
        bloomLevel: 'REMEMBER',
        correctAnswer: [{ optionIndex: 0 }, { optionIndex: 1 }],
        explanation: 'Number, String, Boolean, Symbol, and undefined are primitives. Array and Object are not.',
        options: {
          create: [
            { text: 'Number', isCorrect: true, orderIndex: 0 },
            { text: 'String', isCorrect: true, orderIndex: 1 },
            { text: 'Array', isCorrect: false, orderIndex: 2 },
            { text: 'Object', isCorrect: false, orderIndex: 3 },
          ],
        },
      },
    });

    const q4 = await prisma.question.create({
      data: {
        text: 'JavaScript is a statically typed language.',
        type: QuestionType.TRUE_FALSE,
        difficulty: Difficulty.EASY,
        marks: 2,
        createdById: teacher.id,
        correctAnswer: ['false'],
        options: {
          create: [
            { text: 'True', isCorrect: false, orderIndex: 0 },
            { text: 'False', isCorrect: true, orderIndex: 1 },
          ],
        },
      },
    });

    const q5 = await prisma.question.create({
      data: {
        text: 'The method used to parse a JSON string in JavaScript is ______.',
        type: QuestionType.FILL_BLANK,
        difficulty: Difficulty.EASY,
        marks: 2,
        createdById: teacher.id,
        correctAnswer: ['JSON.parse'],
        explanation: 'JSON.parse() converts a JSON string into a JavaScript object.',
      },
    });

    const q6 = await prisma.question.create({
      data: {
        text: 'Explain the difference between `let` and `const` in JavaScript.',
        type: QuestionType.SUBJECTIVE,
        difficulty: Difficulty.MEDIUM,
        marks: 5,
        createdById: teacher.id,
        bloomLevel: 'UNDERSTAND',
        explanation: 'let allows reassignment, const does not. Both are block-scoped.',
      },
    });

    const q7 = await prisma.question.create({
      data: {
        text: 'Write a function that returns the sum of two numbers.',
        type: QuestionType.CODING,
        difficulty: Difficulty.EASY,
        marks: 8,
        createdById: teacher.id,
        correctAnswer: [],
      },
    });

    // Boundary question for discrimination index
    const q8 = await prisma.question.create({
      data: {
        text: 'What is the time complexity of binary search on a sorted array?',
        type: QuestionType.SINGLE,
        difficulty: Difficulty.HARD,
        marks: 4,
        createdById: teacher.id,
        bloomLevel: 'ANALYZE',
        topic: 'Algorithms',
        explanation: 'Binary search halves the search space each step, giving O(log n).',
        options: {
          create: [
            { text: 'O(n)', isCorrect: false, orderIndex: 0 },
            { text: 'O(log n)', isCorrect: true, orderIndex: 1 },
            { text: 'O(n log n)', isCorrect: false, orderIndex: 2 },
            { text: 'O(1)', isCorrect: false, orderIndex: 3 },
          ],
        },
      },
    });

    await prisma.questionBankQuestion.createMany({
      data: [
        { bankId: bank.id, questionId: q1.id },
        { bankId: bank.id, questionId: q2.id },
        { bankId: bank.id, questionId: q3.id },
        { bankId: bank.id, questionId: q4.id },
        { bankId: bank.id, questionId: q5.id },
        { bankId: bank.id, questionId: q6.id },
        { bankId: bank.id, questionId: q7.id },
        { bankId: bank.id, questionId: q8.id },
      ],
    });

    // Test with question pool
    const test = await prisma.test.upsert({
      where: { id: 'test-js-fundamentals' },
      update: { createdById: teacher.id },
      create: {
        id: 'test-js-fundamentals',
        title: 'JavaScript Fundamentals',
        description: 'Covers variables, types, and basic language features.',
        courseId: course.id,
        durationMinutes: 60,
        totalMarks: 20,
        passingMarks: 10,
        negativeMarks: 0,
        maxAttempts: 2,
        shuffleQuestions: true,
        showResultImmediately: true,
        status: TestStatus.PUBLISHED,
        examMode: ExamMode.PRACTICE,
        createdById: teacher.id,
        testQuestions: {
          create: [
            { questionId: q1.id, orderIndex: 0 },
            { questionId: q2.id, orderIndex: 1 },
            { questionId: q3.id, orderIndex: 2 },
            { questionId: q4.id, orderIndex: 3 },
            { questionId: q5.id, orderIndex: 4 },
            { questionId: q6.id, orderIndex: 5 },
            { questionId: q7.id, orderIndex: 6 },
            { questionId: q8.id, orderIndex: 7 },
          ],
        },
      },
    });

    // Test assignment
    await prisma.testAssignment.upsert({
      where: { id: 'assignment-js-test-1' },
      update: { testId: test.id, studentId: student.id },
      create: {
        id: 'assignment-js-test-1',
        testId: test.id,
        studentId: student.id,
      },
    }).catch(() => {});

    // Question pool (Phase 10)
    const pool = await prisma.questionPool.upsert({
      where: { id: 'pool-section-1' },
      update: { testId: test.id },
      create: {
        id: 'pool-section-1',
        testId: test.id,
        name: 'Core JavaScript',
        description: 'Core questions pool for section 1',
        orderIndex: 0,
      },
    });

    await prisma.questionPoolQuestion.upsert({
      where: { poolId_questionId: { poolId: pool.id, questionId: q1.id } },
      update: {},
      create: { poolId: pool.id, questionId: q1.id },
    }).catch(() => {});

    // Demo Evaluated Attempt for Student (Score: 16/20 - 80%, Passed)
    const demoAttempt = await prisma.attempt.upsert({
      where: { id: 'attempt-demo-1' },
      update: { score: 16, percentage: 80, passed: true, status: AttemptStatus.EVALUATED },
      create: {
        id: 'attempt-demo-1',
        testId: test.id,
        studentId: student.id,
        status: AttemptStatus.EVALUATED,
        score: 16,
        percentage: 80,
        passed: true,
        timeTakenSeconds: 1420,
        startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000 + 24 * 60 * 1000),
        suspicionScore: 0,
      },
    });

    const q1Options = await prisma.questionOption.findMany({ where: { questionId: q1.id } });
    const q1Correct = q1Options.find((o) => o.isCorrect);
    const q4Options = await prisma.questionOption.findMany({ where: { questionId: q4.id } });
    const q4Correct = q4Options.find((o) => o.isCorrect);
    const q8Options = await prisma.questionOption.findMany({ where: { questionId: q8.id } });
    const q8Wrong = q8Options.find((o) => !o.isCorrect);

    await prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId: demoAttempt.id, questionId: q1.id } },
      update: {},
      create: {
        attemptId: demoAttempt.id,
        questionId: q1.id,
        optionId: q1Correct?.id,
        isCorrect: true,
        marksObtained: 2,
        timeSpentSeconds: 45,
      },
    }).catch(() => {});

    await prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId: demoAttempt.id, questionId: q2.id } },
      update: {},
      create: {
        attemptId: demoAttempt.id,
        questionId: q2.id,
        answerJson: { selected: ['boolean', 'number', 'string'] },
        isCorrect: true,
        marksObtained: 3,
        timeSpentSeconds: 65,
      },
    }).catch(() => {});

    await prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId: demoAttempt.id, questionId: q4.id } },
      update: {},
      create: {
        attemptId: demoAttempt.id,
        questionId: q4.id,
        optionId: q4Correct?.id,
        isCorrect: true,
        marksObtained: 2,
        timeSpentSeconds: 20,
      },
    }).catch(() => {});

    await prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId: demoAttempt.id, questionId: q5.id } },
      update: {},
      create: {
        attemptId: demoAttempt.id,
        questionId: q5.id,
        answerJson: { text: 'JSON.parse' },
        isCorrect: true,
        marksObtained: 2,
        timeSpentSeconds: 30,
      },
    }).catch(() => {});

    await prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId: demoAttempt.id, questionId: q6.id } },
      update: {},
      create: {
        attemptId: demoAttempt.id,
        questionId: q6.id,
        answerJson: { text: 'let allows re-assignment and is block-scoped. const is also block-scoped but cannot be re-assigned.' },
        isCorrect: true,
        marksObtained: 5,
        timeSpentSeconds: 180,
      },
    }).catch(() => {});

    await prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId: demoAttempt.id, questionId: q7.id } },
      update: {},
      create: {
        attemptId: demoAttempt.id,
        questionId: q7.id,
        answerJson: { code: 'function add(a, b) {\n  return a + b;\n}' },
        isCorrect: true,
        marksObtained: 8,
        timeSpentSeconds: 240,
      },
    }).catch(() => {});

    await prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId: demoAttempt.id, questionId: q8.id } },
      update: {},
      create: {
        attemptId: demoAttempt.id,
        questionId: q8.id,
        optionId: q8Wrong?.id,
        isCorrect: false,
        marksObtained: 0,
        timeSpentSeconds: 50,
      },
    }).catch(() => {});

    // Populate question analytics
    await prisma.questionAnalytics.upsert({
      where: { questionId: q1.id },
      update: { attemptCount: 1, correctCount: 1, accuracy: 100 },
      create: { questionId: q1.id, attemptCount: 1, correctCount: 1, accuracy: 100, avgTimeSeconds: 45 },
    }).catch(() => {});

    await prisma.questionAnalytics.upsert({
      where: { questionId: q8.id },
      update: { attemptCount: 1, incorrectCount: 1, accuracy: 0 },
      create: { questionId: q8.id, attemptCount: 1, incorrectCount: 1, accuracy: 0, avgTimeSeconds: 50 },
    }).catch(() => {});
  }

  // Coding problem (always upsert, independent of question count)
  const codingProblem = await prisma.codingProblem.upsert({
    where: { id: 'problem-sum' },
    update: { courseId: course.id, createdById: teacher.id },
    create: {
      id: 'problem-sum',
      title: 'Two Sum',
      description: 'Write a function that takes two numbers and returns their sum.',
      courseId: course.id,
      difficulty: Difficulty.EASY,
      timeLimitMs: 2000,
      memoryLimitMB: 256,
      allowedLanguages: JSON.stringify(['python', 'javascript', 'java']),
      createdById: teacher.id,
      testCases: {
        create: [
          { input: '1\n2\n', expectedOutput: '3', isPublic: true, orderIndex: 0 },
          { input: '10\n20\n', expectedOutput: '30', isPublic: true, orderIndex: 1 },
          { input: '-5\n5\n', expectedOutput: '0', isPublic: false, orderIndex: 2 },
        ],
      },
    },
  });

  const practiceProblems = [
    {
      id: 'problem-reverse-string', title: 'Reverse String', difficulty: Difficulty.EASY,
      description: 'Given an array of characters, reverse the array in place using constant extra space.',
      cases: [['["h","e","l","l","o"]', '["o","l","l","e","h"]'], ['["H","a","n","n","a","h"]', '["h","a","n","n","a","H"]']],
    },
    {
      id: 'problem-valid-parentheses', title: 'Valid Parentheses', difficulty: Difficulty.EASY,
      description: 'Given a string containing parentheses, brackets, and braces, determine whether the input is valid.',
      cases: [['()', 'true'], ['([{}])', 'true'], ['(]', 'false']],
    },
    {
      id: 'problem-contains-duplicate', title: 'Contains Duplicate', difficulty: Difficulty.EASY,
      description: 'Return true if any value appears at least twice in an integer array, otherwise return false.',
      cases: [['[1,2,3,1]', 'true'], ['[1,2,3,4]', 'false']],
    },
    {
      id: 'problem-best-time-stock', title: 'Best Time to Buy and Sell Stock', difficulty: Difficulty.EASY,
      description: 'Choose one day to buy and a later day to sell to maximize profit. Return zero when no profit is possible.',
      cases: [['[7,1,5,3,6,4]', '5'], ['[7,6,4,3,1]', '0']],
    },
    {
      id: 'problem-binary-search', title: 'Binary Search', difficulty: Difficulty.MEDIUM,
      description: 'Given a sorted array of distinct integers and a target, return its index or -1 when it is not present.',
      cases: [['[-1,0,3,5,9,12]\n9', '4'], ['[-1,0,3,5,9,12]\n2', '-1']],
    },
    {
      id: 'problem-maximum-subarray', title: 'Maximum Subarray', difficulty: Difficulty.MEDIUM,
      description: 'Find the contiguous subarray with the largest sum and return that sum.',
      cases: [['[-2,1,-3,4,-1,2,1,-5,4]', '6'], ['[1]', '1']],
    },
    {
      id: 'problem-merge-sorted-lists', title: 'Merge Two Sorted Lists', difficulty: Difficulty.MEDIUM,
      description: 'Merge two sorted linked lists into one sorted linked list and return its head.',
      cases: [['[1,2,4]\n[1,3,4]', '[1,1,2,3,4,4]'], ['[]\n[]', '[]']],
    },
  ];

  for (const problem of practiceProblems) {
    await prisma.codingProblem.upsert({
      where: { id: problem.id },
      update: { courseId: course.id, createdById: teacher.id, title: problem.title, description: problem.description, difficulty: problem.difficulty },
      create: {
        id: problem.id,
        title: problem.title,
        description: problem.description,
        courseId: course.id,
        difficulty: problem.difficulty,
        timeLimitMs: 2000,
        memoryLimitMB: 256,
        allowedLanguages: JSON.stringify(['python', 'javascript', 'java']),
        createdById: teacher.id,
        testCases: { create: problem.cases.map(([input, expectedOutput], orderIndex) => ({ input, expectedOutput, isPublic: orderIndex < 1, orderIndex })) },
      },
    });
  }

  // Certificate (demonstrates Phase 15)
  await prisma.certificate.upsert({
    where: { id: 'cert-demo-1' },
    update: { userId: student.id, courseId: course.id },
    create: {
      id: 'cert-demo-1',
      userId: student.id,
      courseId: course.id,
      title: 'Computer Science Fundamentals',
      description: 'Awarded for completing the CS101 course.',
      credentialId: 'CERT-5021-ABCD',
      status: 'ACTIVE',
      qrData: 'http://localhost:5173/verify/CERT-5021-ABCD',
    },
  });

  // Assignments
  await prisma.assignment.upsert({
    where: { id: 'assignment-1' },
    update: { courseId: course.id, createdById: teacher.id },
    create: {
      id: 'assignment-1',
      title: 'Build a Simple Web Page',
      description: 'Create a basic webpage using HTML, CSS, and JavaScript that displays a greeting.',
      courseId: course.id,
      maxMarks: 10,
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdById: teacher.id,
    },
  });

  // Notification
  await prisma.notification.upsert({
    where: { id: 'notif-welcome' },
    update: { userId: student.id },
    create: {
      id: 'notif-welcome',
      userId: student.id,
      type: 'SYSTEM',
      title: 'Welcome to ExamForge!',
      message: 'Your account has been created successfully.',
    },
  });

  // Leaderboard entry
  await prisma.leaderboard.upsert({
    where: { userId_courseId: { userId: student.id, courseId: course.id } },
    update: {},
    create: {
      userId: student.id,
      courseId: course.id,
      totalScore: 18,
      testsTaken: 1,
      avgPercentage: 90,
      rank: 1,
    },
  });

  // Demo Placement Profile (POD Registration)
  await prisma.placementProfile.upsert({
    where: { userId: student.id },
    update: {
      fullName: 'Alex Student',
      rollNumber: 'CS2024-042',
      phone: '+1 555-0199',
      branch: 'Computer Science',
      cgpa: 8.75,
      tenthPercentage: 92.0,
      twelfthPercentage: 89.5,
      skills: ['React', 'Node.js', 'TypeScript', 'SQL', 'Python'],
      githubUrl: 'https://github.com/alexstudent',
      linkedinUrl: 'https://linkedin.com/in/alexstudent',
      isVerified: true,
    },
    create: {
      userId: student.id,
      fullName: 'Alex Student',
      rollNumber: 'CS2024-042',
      phone: '+1 555-0199',
      branch: 'Computer Science',
      cgpa: 8.75,
      tenthPercentage: 92.0,
      tenthPercentage: 92.4,
      twelfthPercentage: 89.5,
      activeBacklogs: 0,
      graduationYear: 2026,
      skills: ['React', 'Node.js', 'TypeScript', 'SQL', 'Python'],
      githubUrl: 'https://github.com/alexstudent',
      linkedinUrl: 'https://linkedin.com/in/alexstudent',
      isVerified: true,
    },
  });

  // Demo Placement Drives
  const driveGoogle = await prisma.placementDrive.upsert({
    where: { id: 'drive-google-sde' },
    update: {},
    create: {
      id: 'drive-google-sde',
      companyName: 'Google',
      role: 'Software Engineer Intern',
      description: 'Design scalable distributed systems, collaborate with cross-functional engineering teams, and implement algorithmic solutions in C++ or Python.',
      driveType: 'ON_CAMPUS',
      eligibilityCgpa: 8.0,
      eligibleBranches: ['Computer Science', 'Information Technology', 'Electronics'],
      maxBacklogs: 0,
      minTenthPercent: 75.0,
      minTwelfthPercent: 75.0,
      batchYear: 2026,
      ctcLpa: 24.5,
      location: 'Bangalore / Hybrid',
      deadline: new Date(Date.now() + 14 * 24 * 3600 * 1000),
      driveDate: new Date(Date.now() + 20 * 24 * 3600 * 1000),
      status: 'ACTIVE',
      createdById: admin.id,
    },
  });

  await prisma.placementDrive.upsert({
    where: { id: 'drive-microsoft-sde' },
    update: {},
    create: {
      id: 'drive-microsoft-sde',
      companyName: 'Microsoft',
      role: 'Software Development Engineer',
      description: 'Build enterprise cloud native applications on Azure, high-throughput microservices, and AI-assisted workflows.',
      driveType: 'ON_CAMPUS',
      eligibilityCgpa: 7.5,
      eligibleBranches: ['Computer Science', 'Information Technology'],
      maxBacklogs: 0,
      minTenthPercent: 70.0,
      minTwelfthPercent: 70.0,
      batchYear: 2026,
      ctcLpa: 18.0,
      location: 'Hyderabad / On-site',
      deadline: new Date(Date.now() + 21 * 24 * 3600 * 1000),
      driveDate: new Date(Date.now() + 28 * 24 * 3600 * 1000),
      status: 'ACTIVE',
      createdById: teacher.id,
    },
  });

  await prisma.placementDrive.upsert({
    where: { id: 'drive-amazon-sde' },
    update: {},
    create: {
      id: 'drive-amazon-sde',
      companyName: 'Amazon',
      role: 'Associate SDE - Off Campus',
      description: 'National recruitment drive for graduating batches with strong problem-solving skills, object-oriented design, and system architecture fundamentals.',
      driveType: 'OFF_CAMPUS',
      eligibilityCgpa: 6.5,
      eligibleBranches: ['Computer Science', 'Information Technology', 'Electronics', 'Mechanical'],
      maxBacklogs: 1,
      minTenthPercent: 60.0,
      minTwelfthPercent: 60.0,
      batchYear: 2026,
      ctcLpa: 16.0,
      location: 'Multiple Locations / Remote',
      deadline: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      driveDate: new Date(Date.now() + 35 * 24 * 3600 * 1000),
      status: 'ACTIVE',
      createdById: admin.id,
    },
  });

  await prisma.placementDrive.upsert({
    where: { id: 'drive-goldman-sachs' },
    update: {},
    create: {
      id: 'drive-goldman-sachs',
      companyName: 'Goldman Sachs',
      role: 'Quantitative Analyst / SDE',
      description: 'High-frequency algorithmic trading desk engineering. Requires stellar academic record and advanced data structures.',
      driveType: 'ON_CAMPUS',
      eligibilityCgpa: 9.0, // Alex (8.75) is ineligible for this drive!
      eligibleBranches: ['Computer Science'],
      maxBacklogs: 0,
      minTenthPercent: 85.0,
      minTwelfthPercent: 85.0,
      batchYear: 2026,
      ctcLpa: 32.0,
      location: 'Bangalore / On-site',
      deadline: new Date(Date.now() + 10 * 24 * 3600 * 1000),
      driveDate: new Date(Date.now() + 15 * 24 * 3600 * 1000),
      status: 'ACTIVE',
      createdById: admin.id,
    },
  });

  // Demo Application for Alex Student
  await prisma.placementApplication.upsert({
    where: {
      driveId_studentId: {
        driveId: driveGoogle.id,
        studentId: student.id,
      },
    },
    update: {},
    create: {
      driveId: driveGoogle.id,
      studentId: student.id,
      status: 'SHORTLISTED',
      notes: 'Passed initial coding assessment round with top score.',
    },
  });

  const count = await prisma.user.count();
  console.log(`Seed complete. ${count} users.`);
  console.log('Demo accounts:');
  console.log('  admin@examforge.dev / Admin123!');
  console.log('  teacher@examforge.dev / Teacher123!');
  console.log('  student@examforge.dev / Student123!');
  console.log('  proctor@examforge.dev / Proctor123!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });