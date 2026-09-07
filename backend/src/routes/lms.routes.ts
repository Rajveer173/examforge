import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { auditLog } from '../middleware/audit.js';
import {
  createModule,
  listModules,
  getModule,
  updateModule,
  deleteModule,
  createLesson,
  getLesson,
  updateLesson,
  deleteLesson,
  addResource,
  deleteResource,
  enrollStudent,
  getEnrollments,
  getMyEnrollments,
  markLessonComplete,
  getCourseProgress,
  getLessonProgress,
  createAnnouncement,
  listAnnouncements,
  deleteAnnouncement,
  rateCourse,
  listRatings,
  getRatingSummary,
  getRecentlyViewed,
  trackRecentlyViewed,
  createDiscussion,
  listDiscussions,
  deleteDiscussion,
} from '../controllers/lms.controller.js';

const staffOnly = requireRole('ADMIN', 'TEACHER');

export const lmsRouter = Router();

// Course enrollment
lmsRouter.post('/courses/:courseId/enroll', requireAuth, enrollStudent);
lmsRouter.get('/courses/:courseId/enrollments', requireAuth, staffOnly, getEnrollments);
lmsRouter.get('/courses/:courseId/progress', requireAuth, getCourseProgress);
lmsRouter.get('/courses/:courseId/lesson-progress', requireAuth, getLessonProgress);
lmsRouter.get('/my-courses', requireAuth, getMyEnrollments);

// Modules
lmsRouter.get('/courses/:courseId/modules', requireAuth, listModules);
lmsRouter.post('/courses/:courseId/modules', requireAuth, staffOnly, auditLog('CREATE', 'Module'), createModule);
lmsRouter.get('/modules/:id', requireAuth, getModule);
lmsRouter.put('/modules/:id', requireAuth, staffOnly, auditLog('UPDATE', 'Module'), updateModule);
lmsRouter.delete('/modules/:id', requireAuth, staffOnly, auditLog('DELETE', 'Module'), deleteModule);

// Lessons
lmsRouter.post('/modules/:moduleId/lessons', requireAuth, staffOnly, auditLog('CREATE', 'Lesson'), createLesson);
lmsRouter.get('/lessons/:id', requireAuth, getLesson);
lmsRouter.put('/lessons/:id', requireAuth, staffOnly, auditLog('UPDATE', 'Lesson'), updateLesson);
lmsRouter.delete('/lessons/:id', requireAuth, staffOnly, auditLog('DELETE', 'Lesson'), deleteLesson);
lmsRouter.post('/lessons/:lessonId/complete', requireAuth, markLessonComplete);

// Resources
lmsRouter.post('/lessons/:lessonId/resources', requireAuth, staffOnly, auditLog('CREATE', 'Resource'), addResource);
lmsRouter.delete('/resources/:id', requireAuth, staffOnly, auditLog('DELETE', 'Resource'), deleteResource);

// --- Phase 8: Announcements, Ratings, Recently Viewed, Discussions ---
lmsRouter.get('/courses/:courseId/announcements', requireAuth, listAnnouncements);
lmsRouter.post('/courses/:courseId/announcements', requireAuth, staffOnly, auditLog('CREATE', 'Announcement'), createAnnouncement);
lmsRouter.delete('/announcements/:id', requireAuth, staffOnly, auditLog('DELETE', 'Announcement'), deleteAnnouncement);

lmsRouter.post('/courses/:courseId/rate', requireAuth, rateCourse);
lmsRouter.get('/courses/:courseId/ratings', requireAuth, listRatings);
lmsRouter.get('/courses/:courseId/rating-summary', requireAuth, getRatingSummary);

lmsRouter.get('/recently-viewed', requireAuth, getRecentlyViewed);
lmsRouter.post('/recently-viewed', requireAuth, trackRecentlyViewed);

lmsRouter.get('/courses/:courseId/discussions', requireAuth, listDiscussions);
lmsRouter.post('/courses/:courseId/discussions', requireAuth, createDiscussion);
lmsRouter.delete('/discussions/:id', requireAuth, deleteDiscussion);