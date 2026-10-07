import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { placementService } from '../services/placement.service.js';

export const placementRouter = Router();

placementRouter.use(requireAuth);

/**
 * GET /api/placements/profile - Get student's placement profile
 */
placementRouter.get('/profile', asyncHandler(async (req, res) => {
  const profile = await placementService.getProfile(req.user!.id);
  res.json({ success: true, data: { profile } });
}));

/**
 * POST /api/placements/profile - Register or update placement POD profile
 */
placementRouter.post('/profile', asyncHandler(async (req, res) => {
  const schema = z.object({
    fullName: z.string().min(1).max(200),
    rollNumber: z.string().max(100).optional(),
    phone: z.string().max(20).optional(),
    branch: z.string().max(100).optional(),
    cgpa: z.coerce.number().min(0).max(10),
    tenthPercentage: z.coerce.number().min(0).max(100).optional(),
    twelfthPercentage: z.coerce.number().min(0).max(100).optional(),
    activeBacklogs: z.coerce.number().min(0).default(0).optional(),
    graduationYear: z.coerce.number().min(2020).max(2035).optional(),
    skills: z.array(z.string()).optional(),
    resumeUrl: z.string().url().or(z.literal('')).optional(),
    githubUrl: z.string().url().or(z.literal('')).optional(),
    linkedinUrl: z.string().url().or(z.literal('')).optional(),
  });

  const input = schema.parse(req.body);
  const profile = await placementService.upsertProfile(req.user!.id, input);
  res.json({ success: true, data: { profile } });
}));

/**
 * GET /api/placements/drives - List placement drives
 */
placementRouter.get('/drives', asyncHandler(async (req, res) => {
  const { type, status, search, onlyEligible } = req.query;
  const drives = await placementService.getDrives(req.user!.id, req.user!.role, {
    type: type as string | undefined,
    status: status as string | undefined,
    search: search as string | undefined,
    onlyEligible: onlyEligible === 'true',
  });
  res.json({ success: true, data: { drives } });
}));

/**
 * GET /api/placements/drives/:id - Get drive details
 */
placementRouter.get('/drives/:id', asyncHandler(async (req, res) => {
  const drive = await placementService.getDriveById(req.params.id, req.user!.id, req.user!.role);
  res.json({ success: true, data: { drive } });
}));

/**
 * POST /api/placements/drives - Create placement drive (Admin/Teacher)
 */
placementRouter.post('/drives', requireRole('ADMIN', 'TEACHER'), asyncHandler(async (req, res) => {
  const schema = z.object({
    companyName: z.string().min(1).max(200),
    role: z.string().min(1).max(200),
    description: z.string().optional(),
    driveType: z.enum(['ON_CAMPUS', 'OFF_CAMPUS']).default('ON_CAMPUS'),
    eligibilityCgpa: z.coerce.number().min(0).max(10).default(0),
    eligibleBranches: z.array(z.string()).optional(),
    maxBacklogs: z.coerce.number().min(0).optional(),
    minTenthPercent: z.coerce.number().min(0).max(100).optional(),
    minTwelfthPercent: z.coerce.number().min(0).max(100).optional(),
    batchYear: z.coerce.number().min(2020).max(2035).optional(),
    ctcLpa: z.coerce.number().min(0).optional(),
    location: z.string().max(200).optional(),
    deadline: z.string().or(z.date()),
    driveDate: z.string().or(z.date()).optional(),
    status: z.enum(['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED']).default('UPCOMING'),
  });

  const input = schema.parse(req.body);
  const drive = await placementService.createDrive(req.user!.id, input);
  res.status(201).json({ success: true, data: { drive } });
}));

/**
 * PUT /api/placements/drives/:id - Update placement drive (Admin/Teacher)
 */
placementRouter.put('/drives/:id', requireRole('ADMIN', 'TEACHER'), asyncHandler(async (req, res) => {
  const schema = z.object({
    companyName: z.string().min(1).max(200).optional(),
    role: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    driveType: z.enum(['ON_CAMPUS', 'OFF_CAMPUS']).optional(),
    eligibilityCgpa: z.coerce.number().min(0).max(10).optional(),
    eligibleBranches: z.array(z.string()).optional(),
    maxBacklogs: z.coerce.number().min(0).optional(),
    minTenthPercent: z.coerce.number().min(0).max(100).optional(),
    minTwelfthPercent: z.coerce.number().min(0).max(100).optional(),
    batchYear: z.coerce.number().min(2020).max(2035).optional(),
    ctcLpa: z.coerce.number().min(0).optional(),
    location: z.string().max(200).optional(),
    deadline: z.string().or(z.date()).optional(),
    driveDate: z.string().or(z.date()).optional(),
    status: z.enum(['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  });

  const input = schema.parse(req.body);
  const drive = await placementService.updateDrive(req.params.id, input);
  res.json({ success: true, data: { drive } });
}));

/**
 * DELETE /api/placements/drives/:id - Delete placement drive (Admin/Teacher)
 */
placementRouter.delete('/drives/:id', requireRole('ADMIN', 'TEACHER'), asyncHandler(async (req, res) => {
  await placementService.deleteDrive(req.params.id);
  res.json({ success: true, message: 'Drive deleted successfully' });
}));

/**
 * POST /api/placements/drives/:id/apply - Apply for drive (Student)
 */
placementRouter.post('/drives/:id/apply', requireRole('STUDENT'), asyncHandler(async (req, res) => {
  const application = await placementService.applyForDrive(req.params.id, req.user!.id);
  res.status(201).json({ success: true, data: { application } });
}));

/**
 * POST /api/placements/drives/:id/withdraw - Withdraw application (Student)
 */
placementRouter.post('/drives/:id/withdraw', requireRole('STUDENT'), asyncHandler(async (req, res) => {
  await placementService.withdrawApplication(req.params.id, req.user!.id);
  res.json({ success: true, message: 'Application withdrawn successfully' });
}));

/**
 * GET /api/placements/applications - Student's application history
 */
placementRouter.get('/applications', requireRole('STUDENT'), asyncHandler(async (req, res) => {
  const applications = await placementService.getStudentApplications(req.user!.id);
  res.json({ success: true, data: { applications } });
}));

/**
 * PATCH /api/placements/applications/:id/status - Update application status (Admin/Teacher)
 */
placementRouter.patch('/applications/:id/status', requireRole('ADMIN', 'TEACHER'), asyncHandler(async (req, res) => {
  const schema = z.object({
    status: z.enum(['APPLIED', 'SHORTLISTED', 'INTERVIEWED', 'SELECTED', 'REJECTED']),
    notes: z.string().optional(),
  });

  const { status, notes } = schema.parse(req.body);
  const application = await placementService.updateApplicationStatus(req.params.id, status, notes);
  res.json({ success: true, data: { application } });
}));

/**
 * GET /api/placements/stats - Placement statistics (Admin/Teacher)
 */
placementRouter.get('/stats', requireRole('ADMIN', 'TEACHER'), asyncHandler(async (req, res) => {
  const stats = await placementService.getStats();
  res.json({ success: true, data: { stats } });
}));
