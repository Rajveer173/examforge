import { Router } from 'express';
import { z, ZodTypeAny } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest } from '../utils/errors.js';
import { placementService } from '../services/placement.service.js';

export const placementRouter = Router();

placementRouter.use(requireAuth);

/**
 * Who runs the placement cell. Teachers act as placement coordinators: the UI
 * gives them the same management page as admins (/teacher/placements), so the
 * API grants both roles the same create/edit/delete/review rights.
 */
const MANAGERS = ['ADMIN', 'TEACHER'] as const;

/* ------------------------------------------------------------ validation */

const LABELS: Record<string, string> = {
  fullName: 'Full name',
  rollNumber: 'Roll number',
  phone: 'Phone',
  branch: 'Branch',
  cgpa: 'CGPA',
  tenthPercentage: '10th percentage',
  twelfthPercentage: '12th percentage',
  activeBacklogs: 'Active backlogs',
  graduationYear: 'Graduation year',
  skills: 'Skills',
  resumeUrl: 'Resume URL',
  githubUrl: 'GitHub URL',
  linkedinUrl: 'LinkedIn URL',
  companyName: 'Company name',
  role: 'Role',
  description: 'Description',
  driveType: 'Drive type',
  eligibilityCgpa: 'Minimum CGPA',
  eligibleBranches: 'Eligible branches',
  maxBacklogs: 'Max backlogs',
  minTenthPercent: 'Minimum 10th %',
  minTwelfthPercent: 'Minimum 12th %',
  batchYear: 'Batch year',
  ctcLpa: 'CTC',
  location: 'Location',
  deadline: 'Application deadline',
  driveDate: 'Drive date',
  status: 'Status',
  notes: 'Notes',
  selectionProcess: 'Selection rounds',
  currentRound: 'Current round',
  assessmentScore: 'Assessment score',
};

/** Parse a body and turn Zod issues into one readable 400 ("CGPA: must be at most 10"). */
function parseBody<S extends ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data;
  const messages = result.error.issues.map((issue) => {
    const key = String(issue.path[0] ?? '');
    const label = LABELS[key] ?? key;
    return label ? `${label}: ${issue.message}` : issue.message;
  });
  throw badRequest(Array.from(new Set(messages)).join('; '), result.error.flatten());
}

/** Optional number that also accepts "" / null as "clear this value". */
const optNumber = (min: number, max: number, { int = false } = {}) =>
  z.preprocess(
    (v) => (v === '' || v === null ? null : v === undefined ? undefined : Number(v)),
    (int
      ? z.number({ invalid_type_error: 'must be a number' }).int('must be a whole number')
      : z.number({ invalid_type_error: 'must be a number' })
    )
      .min(min, `must be at least ${min}`)
      .max(max, `must be at most ${max}`)
      .nullable()
      .optional()
  );

const reqNumber = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({ required_error: 'is required', invalid_type_error: 'must be a number' })
      .min(min, `must be at least ${min}`)
      .max(max, `must be at most ${max}`)
  );

const httpUrl = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() : v),
  z
    .string()
    .max(500, 'is too long')
    .refine((v) => {
      if (v === '') return true;
      try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'must be a valid http(s) link')
    .nullable()
    .optional()
);

const optText = (max: number) =>
  z.string({ invalid_type_error: 'must be text' }).max(max, `must be at most ${max} characters`).nullable().optional();

const reqText = (max: number) =>
  z
    .string({ required_error: 'is required', invalid_type_error: 'must be text' })
    .trim()
    .min(1, 'is required')
    .max(max, `must be at most ${max} characters`);

const dateInput = z
  .string({ required_error: 'is required', invalid_type_error: 'must be a date' })
  .trim()
  .min(1, 'is required')
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'must be a valid date');

const profileSchema = z.object({
  fullName: reqText(200),
  rollNumber: optText(100),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\+?[0-9][0-9 ()-]{6,19}$/.test(v), 'must be a valid phone number')
    .nullable()
    .optional(),
  branch: reqText(100),
  cgpa: reqNumber(0, 10),
  tenthPercentage: optNumber(0, 100),
  twelfthPercentage: optNumber(0, 100),
  activeBacklogs: optNumber(0, 50, { int: true }),
  graduationYear: optNumber(2000, 2040, { int: true }),
  skills: z.array(z.string().max(60, 'each skill must be at most 60 characters')).max(50, 'at most 50 skills').optional(),
  resumeUrl: httpUrl,
  githubUrl: httpUrl,
  linkedinUrl: httpUrl,
});

const driveFields = {
  companyName: reqText(200),
  role: reqText(200),
  description: optText(5000),
  driveType: z.enum(['ON_CAMPUS', 'OFF_CAMPUS'], { errorMap: () => ({ message: 'must be ON_CAMPUS or OFF_CAMPUS' }) }),
  eligibilityCgpa: optNumber(0, 10),
  eligibleBranches: z.array(z.string(), { invalid_type_error: 'must be a list of branches' }).max(30).optional(),
  maxBacklogs: optNumber(0, 50, { int: true }),
  minTenthPercent: optNumber(0, 100),
  minTwelfthPercent: optNumber(0, 100),
  batchYear: optNumber(2000, 2040, { int: true }),
  ctcLpa: optNumber(0, 1000),
  location: optText(200),
  deadline: dateInput,
  driveDate: z.preprocess((v) => (v === '' ? null : v), dateInput.nullable().optional()),
  selectionProcess: z.array(z.string().trim().min(1).max(100), { invalid_type_error: 'must be a list of rounds' }).max(10).optional(),
  status: z.enum(['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED'], {
    errorMap: () => ({ message: 'must be UPCOMING, ACTIVE, COMPLETED or CANCELLED' }),
  }),
};

const createDriveSchema = z.object({
  ...driveFields,
  driveType: driveFields.driveType.default('ON_CAMPUS'),
  status: driveFields.status.default('UPCOMING'),
});

const updateDriveSchema = z.object({
  ...driveFields,
  companyName: driveFields.companyName.optional(),
  role: driveFields.role.optional(),
  driveType: driveFields.driveType.optional(),
  deadline: driveFields.deadline.optional(),
  status: driveFields.status.optional(),
});

const statusSchema = z
  .object({
    status: z
      .enum(['APPLIED', 'SHORTLISTED', 'INTERVIEWED', 'SELECTED', 'REJECTED'], {
        errorMap: () => ({ message: 'must be one of APPLIED, SHORTLISTED, INTERVIEWED, SELECTED, REJECTED' }),
      })
      .optional(),
    currentRound: optText(100),
    assessmentScore: optNumber(0, 100),
    notes: optText(2000),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Nothing to update');

/* ---------------------------------------------------------------- routes */

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
placementRouter.post('/profile', requireRole('STUDENT'), asyncHandler(async (req, res) => {
  const input = parseBody(profileSchema, req.body);
  const profile = await placementService.upsertProfile(req.user!.id, input);
  res.json({ success: true, data: { profile } });
}));

/**
 * GET /api/placements/drives - List placement drives
 */
placementRouter.get('/drives', asyncHandler(async (req, res) => {
  const { type, status, search, onlyEligible } = req.query;
  const drives = await placementService.getDrives(req.user!.id, req.user!.role, {
    type: typeof type === 'string' ? type : undefined,
    status: typeof status === 'string' ? status : undefined,
    search: typeof search === 'string' && search.trim() ? search.trim() : undefined,
    onlyEligible: onlyEligible === 'true' || onlyEligible === '1',
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
placementRouter.post('/drives', requireRole(...MANAGERS), asyncHandler(async (req, res) => {
  const input = parseBody(createDriveSchema, req.body);
  const drive = await placementService.createDrive(req.user!.id, {
    ...input,
    driveDate: input.driveDate || null,
  });
  res.status(201).json({ success: true, data: { drive } });
}));

/**
 * PUT /api/placements/drives/:id - Update placement drive (Admin/Teacher)
 */
placementRouter.put('/drives/:id', requireRole(...MANAGERS), asyncHandler(async (req, res) => {
  const input = parseBody(updateDriveSchema, req.body);
  const drive = await placementService.updateDrive(req.params.id, {
    ...input,
    driveDate: input.driveDate === undefined ? undefined : input.driveDate || null,
  });
  res.json({ success: true, data: { drive } });
}));

/**
 * DELETE /api/placements/drives/:id - Delete placement drive (Admin/Teacher)
 */
placementRouter.delete('/drives/:id', requireRole(...MANAGERS), asyncHandler(async (req, res) => {
  const result = await placementService.deleteDrive(req.params.id);
  res.json({ success: true, message: 'Drive deleted successfully', data: result });
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
 * PATCH /api/placements/applications/:id/status - Update application status and round (Admin/Teacher)
 */
placementRouter.patch('/applications/:id/status', requireRole(...MANAGERS), asyncHandler(async (req, res) => {
  const input = parseBody(statusSchema, req.body);
  const application = await placementService.updateApplicationStatus(req.params.id, input);
  res.json({ success: true, data: { application } });
}));

/**
 * GET /api/placements/profiles - List all registered student POD profiles (Admin/Teacher)
 */
placementRouter.get('/profiles', requireRole(...MANAGERS), asyncHandler(async (req, res) => {
  const { branch, verified, search } = req.query;
  const profiles = await placementService.getAllProfiles({
    branch: branch as string | undefined,
    verified: verified !== undefined ? verified === 'true' : undefined,
    search: search as string | undefined,
  });
  res.json({ success: true, data: { profiles } });
}));

/**
 * PATCH /api/placements/profiles/:id/verify - Verify or flag student profile (Admin/Teacher)
 */
placementRouter.patch('/profiles/:id/verify', requireRole(...MANAGERS), asyncHandler(async (req, res) => {
  const schema = z.object({
    isVerified: z.boolean(),
  });
  const { isVerified } = schema.parse(req.body);
  const profile = await placementService.verifyProfile(req.params.id, isVerified, req.user!.id);
  res.json({ success: true, data: { profile } });
}));

/**
 * GET /api/placements/proctor/candidates - Placement test assessment candidates (Proctor/Admin/Teacher)
 */
placementRouter.get('/proctor/candidates', requireRole('PROCTOR', 'ADMIN', 'TEACHER'), asyncHandler(async (req, res) => {
  const { driveId, proctorStatus, search } = req.query;
  const candidates = await placementService.getProctorCandidates({
    driveId: driveId as string | undefined,
    proctorStatus: proctorStatus as string | undefined,
    search: search as string | undefined,
  });
  res.json({ success: true, data: { candidates } });
}));

/**
 * PATCH /api/placements/proctor/candidates/:id - Update proctor verification status (Proctor)
 */
placementRouter.patch('/proctor/candidates/:id', requireRole('PROCTOR', 'ADMIN', 'TEACHER'), asyncHandler(async (req, res) => {
  const schema = z.object({
    proctorStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'CLEARED', 'FLAGGED', 'DISQUALIFIED']),
    proctorNotes: z.string().optional(),
    assessmentScore: z.coerce.number().min(0).max(100).optional(),
  });
  const input = schema.parse(req.body);
  const application = await placementService.updateProctorStatus(req.params.id, input);
  res.json({ success: true, data: { application } });
}));

/**
 * GET /api/placements/proctor/stats - Proctoring stats for placement assessments
 */
placementRouter.get('/proctor/stats', requireRole('PROCTOR', 'ADMIN', 'TEACHER'), asyncHandler(async (req, res) => {
  const stats = await placementService.getProctorStats();
  res.json({ success: true, data: { stats } });
}));

/**
 * GET /api/placements/stats - Placement statistics (Admin/Teacher)
 */
placementRouter.get('/stats', requireRole(...MANAGERS), asyncHandler(async (req, res) => {
  const stats = await placementService.getStats();
  res.json({ success: true, data: { stats } });
}));
