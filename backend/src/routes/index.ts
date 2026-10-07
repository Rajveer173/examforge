import { Router } from 'express';
import { prisma } from '../config/database.js';
import { authRouter } from './auth.routes.js';
import { attemptRouter } from './attempt.routes.js';
import { courseRouter } from './course.routes.js';
import { questionRouter } from './question.routes.js';
import { questionBankRouter } from './questionBank.routes.js';
import { resultRouter } from './result.routes.js';
import { testRouter } from './test.routes.js';
import { userRouter } from './user.routes.js';
import { assignmentRouter } from './assignment.routes.js';
import { notificationRouter } from './notification.routes.js';
import { auditRouter } from './audit.routes.js';
import { classBatchRouter } from './classBatch.routes.js';
import { lmsRouter } from './lms.routes.js';
import { testSectionRouter } from './testSection.routes.js';
import { fileUploadRouter } from './fileUpload.routes.js';
import { certificateRouter, leaderboardRouter } from './certificateLeaderboard.routes.js';
import { codingProblemRouter } from './codingProblem.routes.js';
import { proctoringRouter } from './proctoring.routes.js';
import { organizationRouter } from './organization.routes.js';
import { aiRouter } from './ai.routes.js';
import { analyticsRouter } from './analytics.routes.js';
import { healthRouter, versionRouter } from './health.routes.js';
import { searchRouter } from './search.routes.js';
import { placementRouter } from './placement.routes.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { metricsHandler } from '../monitoring/metrics.js';
import {
  aiLimiter,
  attemptWriteLimiter,
  codeExecutionLimiter,
  searchLimiter,
  uploadLimiter,
} from '../middleware/rateLimit.js';
import { listAssignedTests } from '../controllers/attempt.controller.js';
import { AppError } from '../utils/errors.js';

export const apiRouter = Router();

apiRouter.get('/tests/assigned', requireAuth, (req, res, next) => {
  if (req.user?.role !== 'STUDENT') {
    next(new AppError(403, 'Student role required'));
    return;
  }
  listAssignedTests(req, res, next);
});

// Mounted before lmsRouter, which is prefix-less and applies requireAuth to
// every route registered after it; probes must answer without a token.
apiRouter.use('/health', healthRouter);
apiRouter.use('/version', versionRouter);

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/courses', courseRouter);
apiRouter.use('/questions', questionRouter);
apiRouter.use('/question-banks', questionBankRouter);
apiRouter.use('/assignments', assignmentRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/audit-logs', auditRouter);
apiRouter.use('/class-batches', classBatchRouter);
apiRouter.use(lmsRouter);
apiRouter.use(testSectionRouter);
apiRouter.use('/files', uploadLimiter, fileUploadRouter);
apiRouter.use('/coding-problems', codeExecutionLimiter, codingProblemRouter);
apiRouter.use('/proctoring', proctoringRouter);
apiRouter.use('/organizations', organizationRouter);
apiRouter.use('/ai', aiLimiter, aiRouter);
apiRouter.use('/search', searchLimiter, searchRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/certificates', certificateRouter);
apiRouter.use('/leaderboards', leaderboardRouter);
apiRouter.use('/placements', placementRouter);
// Student attempt routes must precede testRouter so GET /tests/assigned and
// POST /tests/:testId/start are not shadowed by GET /tests/:id.
apiRouter.use(attemptWriteLimiter, attemptRouter);
apiRouter.use('/tests', testRouter);
apiRouter.use('/results', resultRouter);

// Prometheus metrics
apiRouter.get('/metrics', metricsHandler);

apiRouter.get('/admin/stats', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  const [
    totalUsers,
    totalTeachers,
    totalStudents,
    totalProctors,
    totalOrganizations,
    totalCourses,
    totalTests,
    publishedTests,
    totalQuestions,
    totalAttempts,
    evaluatedAttempts,
    passedAttempts,
    totalAssignments,
    totalSubmissions,
    totalCodingProblems,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'TEACHER' } }),
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'PROCTOR' } }),
    prisma.organization.count(),
    prisma.course.count(),
    prisma.test.count(),
    prisma.test.count({ where: { status: 'PUBLISHED' } }),
    prisma.question.count(),
    prisma.attempt.count({ where: { status: { not: 'IN_PROGRESS' } } }),
    prisma.attempt.count({ where: { status: 'EVALUATED' } }),
    prisma.attempt.count({ where: { passed: true } }),
    prisma.assignment.count(),
    prisma.assignmentSubmission.count(),
    prisma.codingProblem.count(),
  ]);

  const avgScore = await prisma.attempt.aggregate({
    where: { status: 'EVALUATED', score: { not: null } },
    _avg: { score: true, percentage: true },
  });

  res.json({
    success: true,
    data: {
      totalUsers,
      totalTeachers,
      totalStudents,
      totalProctors,
      totalOrganizations,
      totalCourses,
      totalTests,
      publishedTests,
      totalQuestions,
      totalAttempts,
      evaluatedAttempts,
      passedAttempts,
      totalAssignments,
      totalSubmissions,
      totalCodingProblems,
      avgScore: avgScore._avg.score ? Number(avgScore._avg.score) : null,
      avgPercentage: avgScore._avg.percentage ? Number(avgScore._avg.percentage) : null,
    },
  });
});