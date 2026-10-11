import { prisma } from '../config/database.js';
import { notFound, badRequest } from '../utils/errors.js';
import {
  BRANCHES,
  branchMatches,
  canonicalBranch,
  canonicalBranchList,
  readBranchList,
} from '../utils/branches.js';

export interface UpsertProfileInput {
  fullName: string;
  rollNumber?: string | null;
  phone?: string | null;
  branch: string;
  cgpa: number;
  tenthPercentage?: number | null;
  twelfthPercentage?: number | null;
  activeBacklogs?: number | null;
  graduationYear?: number | null;
  skills?: string[];
  resumeUrl?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
}

export type DriveType = 'ON_CAMPUS' | 'OFF_CAMPUS';
export type DriveStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type ApplicationStatus = 'APPLIED' | 'SHORTLISTED' | 'INTERVIEWED' | 'SELECTED' | 'REJECTED';

export interface CreateDriveInput {
  companyName: string;
  role: string;
  description?: string | null;
  driveType?: DriveType;
  eligibilityCgpa?: number | null;
  eligibleBranches?: string[];
  maxBacklogs?: number | null;
  minTenthPercent?: number | null;
  minTwelfthPercent?: number | null;
  batchYear?: number | null;
  ctcLpa?: number | null;
  location?: string | null;
  deadline: string | Date;
  driveDate?: string | Date | null;
  status?: DriveStatus;
  selectionProcess?: string[];
}

/** Drives in these states accept applications (subject to the deadline). */
export const OPEN_DRIVE_STATUSES: readonly string[] = ['ACTIVE', 'UPCOMING'];
/** Final decisions a student can no longer withdraw from. */
const FINAL_APPLICATION_STATUSES: readonly string[] = ['SELECTED', 'REJECTED'];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a date coming from the API. The UI sends a full ISO timestamp built
 * from the admin's local calendar day; a bare "YYYY-MM-DD" from other clients
 * is taken as the end of that day (UTC) for deadlines and midday for drive
 * dates, so the stored instant never lands on the previous calendar day.
 */
function parseDateInput(value: string | Date, label: string, kind: 'deadline' | 'driveDate'): Date {
  let d: Date;
  if (value instanceof Date) d = value;
  else if (DATE_ONLY.test(value.trim())) {
    d = new Date(`${value.trim()}T${kind === 'deadline' ? '23:59:59.999' : '12:00:00.000'}Z`);
  } else d = new Date(value);
  if (Number.isNaN(d.getTime())) throw badRequest(`${label} is not a valid date`);
  return d;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function normaliseBranchesOrThrow(list: string[] | undefined): string[] {
  if (!list) return [];
  const { branches, unknown } = canonicalBranchList(list);
  if (unknown.length) {
    throw badRequest(
      `Unknown branch${unknown.length > 1 ? 'es' : ''}: ${unknown.join(', ')}. Choose from: ${BRANCHES.join(', ')}`
    );
  }
  return branches;
}

type ProfileLike = {
  cgpa: number;
  branch: string | null;
  activeBacklogs: number;
  tenthPercentage: number | null;
  twelfthPercentage: number | null;
  graduationYear: number | null;
};

type DriveLike = {
  eligibilityCgpa: number;
  eligibleBranches: unknown;
  maxBacklogs: number | null;
  minTenthPercent: number | null;
  minTwelfthPercent: number | null;
  batchYear: number | null;
  deadline: Date;
  status: string;
};

/**
 * The single eligibility rule set. Used by the drive list, the drive detail
 * and the apply endpoint so the badge a student sees always agrees with what
 * the server enforces.
 */
export function evaluateEligibility(drive: DriveLike, profile: ProfileLike | null) {
  const reasons: string[] = [];
  if (!profile) {
    return { isEligible: false, reasons: ['Complete your placement profile to check eligibility'] };
  }

  if (drive.eligibilityCgpa > 0 && profile.cgpa < drive.eligibilityCgpa) {
    reasons.push(`Minimum CGPA is ${drive.eligibilityCgpa} (yours: ${profile.cgpa})`);
  }

  const branches = readBranchList(drive.eligibleBranches);
  if (branches.length > 0 && !branchMatches(profile.branch, branches)) {
    const mine = canonicalBranch(profile.branch) ?? profile.branch ?? 'not set';
    reasons.push(`Open to ${branches.join(', ')} only (your branch: ${mine})`);
  }

  if (drive.maxBacklogs !== null && drive.maxBacklogs !== undefined && profile.activeBacklogs > drive.maxBacklogs) {
    reasons.push(
      drive.maxBacklogs === 0
        ? `No active backlogs allowed (you have ${profile.activeBacklogs})`
        : `At most ${drive.maxBacklogs} active backlog${drive.maxBacklogs === 1 ? '' : 's'} allowed (you have ${profile.activeBacklogs})`
    );
  }

  if (drive.minTenthPercent && drive.minTenthPercent > 0) {
    if (profile.tenthPercentage === null || profile.tenthPercentage === undefined) {
      reasons.push(`Minimum 10th marks is ${drive.minTenthPercent}% (add your 10th % to your profile)`);
    } else if (profile.tenthPercentage < drive.minTenthPercent) {
      reasons.push(`Minimum 10th marks is ${drive.minTenthPercent}% (yours: ${profile.tenthPercentage}%)`);
    }
  }

  if (drive.minTwelfthPercent && drive.minTwelfthPercent > 0) {
    if (profile.twelfthPercentage === null || profile.twelfthPercentage === undefined) {
      reasons.push(`Minimum 12th/diploma marks is ${drive.minTwelfthPercent}% (add your 12th % to your profile)`);
    } else if (profile.twelfthPercentage < drive.minTwelfthPercent) {
      reasons.push(`Minimum 12th/diploma marks is ${drive.minTwelfthPercent}% (yours: ${profile.twelfthPercentage}%)`);
    }
  }

  if (drive.batchYear) {
    if (!profile.graduationYear) {
      reasons.push(`Only for the ${drive.batchYear} batch (add your graduation year to your profile)`);
    } else if (profile.graduationYear !== drive.batchYear) {
      reasons.push(`Only for the ${drive.batchYear} batch (yours: ${profile.graduationYear})`);
    }
  }

  return { isEligible: reasons.length === 0, reasons };
}

/** Whether the drive is currently taking applications, and why not if it isn't. */
export function applicationWindow(drive: Pick<DriveLike, 'deadline' | 'status'>, now = new Date()) {
  const isExpired = new Date(drive.deadline).getTime() < now.getTime();
  if (!OPEN_DRIVE_STATUSES.includes(drive.status)) {
    return {
      isOpen: false,
      isExpired,
      closedReason: `This drive is ${drive.status.toLowerCase()} and no longer accepts applications`,
    };
  }
  if (isExpired) {
    return {
      isOpen: false,
      isExpired,
      closedReason: 'The application deadline for this drive has passed',
    };
  }
  return { isOpen: true, isExpired, closedReason: null as string | null };
}

function studentView(drive: any, profile: ProfileLike | null, application: any | null) {
  const { isEligible, reasons } = evaluateEligibility(drive, profile);
  const window = applicationWindow(drive);
  return {
    isEligible,
    eligibilityReasons: reasons,
    eligibilityReason: reasons.join('; '),
    isExpired: window.isExpired,
    isOpen: window.isOpen,
    closedReason: window.closedReason,
    canApply: !application && isEligible && window.isOpen,
    hasApplied: !!application,
    applicationId: application?.id ?? null,
    applicationStatus: application?.status ?? null,
    applicationNotes: application?.notes ?? null,
    appliedAt: application?.appliedAt ?? null,
  };
}

function countByStatus(applications: { status: string }[]) {
  const counts: Record<string, number> = { APPLIED: 0, SHORTLISTED: 0, INTERVIEWED: 0, SELECTED: 0, REJECTED: 0 };
  for (const a of applications) counts[a.status] = (counts[a.status] ?? 0) + 1;
  return counts;
}

export class PlacementService {
  /**
   * Get placement profile for a user
   */
  async getProfile(userId: string) {
    const profile = await prisma.placementProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
    return profile;
  }

  /**
   * Create or update placement profile (POD registration)
   */
  async upsertProfile(userId: string, input: UpsertProfileInput) {
    const branch = canonicalBranch(input.branch);
    if (!branch) {
      throw badRequest(`Unknown branch "${input.branch}". Choose from: ${BRANCHES.join(', ')}`);
    }

    const optional = (v: number | null | undefined) => (v === undefined || v === null ? null : Number(v));
    const data = {
      fullName: input.fullName.trim(),
      rollNumber: input.rollNumber?.trim() || null,
      phone: input.phone?.trim() || null,
      branch,
      cgpa: Number(input.cgpa),
      tenthPercentage: optional(input.tenthPercentage),
      twelfthPercentage: optional(input.twelfthPercentage),
      activeBacklogs: input.activeBacklogs === undefined || input.activeBacklogs === null ? 0 : Number(input.activeBacklogs),
      graduationYear: optional(input.graduationYear),
      skills: Array.from(new Set((input.skills || []).map((s) => s.trim()).filter(Boolean))),
      resumeUrl: input.resumeUrl?.trim() || null,
      githubUrl: input.githubUrl?.trim() || null,
      linkedinUrl: input.linkedinUrl?.trim() || null,
      isVerified: true,
    };

    return prisma.placementProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  /**
   * List placement drives with student eligibility & application status
   */
  async getDrives(
    userId: string,
    userRole: string,
    filters?: { type?: string; status?: string; search?: string; onlyEligible?: boolean }
  ) {
    const where: any = {};
    if (filters?.type && filters.type !== 'ALL') {
      where.driveType = filters.type;
    }
    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }
    if (filters?.search) {
      where.OR = [
        { companyName: { contains: filters.search } },
        { role: { contains: filters.search } },
        { location: { contains: filters.search } },
      ];
    }

    const drives = await prisma.placementDrive.findMany({
      where,
      orderBy: { deadline: 'asc' },
      include: {
        createdBy: {
          select: { id: true, fullName: true, username: true, email: true },
        },
        applications: {
          select: { id: true, status: true },
        },
      },
    });

    if (userRole === 'STUDENT') {
      const [studentProfile, studentApplications] = await Promise.all([
        prisma.placementProfile.findUnique({ where: { userId } }),
        prisma.placementApplication.findMany({ where: { studentId: userId } }),
      ]);
      const appMap = new Map(studentApplications.map((app) => [app.driveId, app]));

      let evaluated = drives.map(({ applications, ...drive }) => ({
        ...drive,
        applicantCount: applications.length,
        ...studentView(drive, studentProfile, appMap.get(drive.id) ?? null),
      }));

      if (filters?.onlyEligible) {
        evaluated = evaluated.filter((d) => d.isEligible);
      }
      return evaluated;
    }

    return drives.map(({ applications, ...drive }) => ({
      ...drive,
      applicantCount: applications.length,
      statusCounts: countByStatus(applications),
      ...applicationWindow(drive),
    }));
  }

  /**
   * Get drive detail with applications
   */
  async getDriveById(driveId: string, userId: string, userRole: string) {
    const drive = await prisma.placementDrive.findUnique({
      where: { id: driveId },
      include: {
        createdBy: {
          select: { id: true, fullName: true, username: true, email: true },
        },
        applications: {
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                username: true,
                email: true,
                placementProfile: true,
              },
            },
          },
          orderBy: { appliedAt: 'desc' },
        },
      },
    });

    if (!drive) {
      throw notFound('Placement drive');
    }

    if (userRole === 'STUDENT') {
      const studentProfile = await prisma.placementProfile.findUnique({ where: { userId } });
      const application = drive.applications.find((app) => app.studentId === userId) ?? null;
      const { applications, ...rest } = drive;
      // Other students' applications are never exposed to a student.
      return {
        ...rest,
        applicantCount: applications.length,
        ...studentView(drive, studentProfile, application),
      };
    }

    return {
      ...drive,
      applicantCount: drive.applications.length,
      statusCounts: countByStatus(drive.applications),
      ...applicationWindow(drive),
    };
  }

  private validateDates(deadline: Date, driveDate: Date | null, status: string, deadlineChanged: boolean) {
    if (driveDate && driveDate.getTime() < deadline.getTime() - 24 * 3600 * 1000) {
      throw badRequest(
        `Drive date (${fmtDate(driveDate)}) cannot be before the application deadline (${fmtDate(deadline)})`
      );
    }
    if (deadlineChanged && OPEN_DRIVE_STATUSES.includes(status) && deadline.getTime() < Date.now()) {
      throw badRequest(
        'Application deadline must be in the future for an ACTIVE or UPCOMING drive (mark past drives COMPLETED or CANCELLED)'
      );
    }
  }

  /**
   * Create a new placement drive (Admin / Teacher)
   */
  async createDrive(createdById: string, input: CreateDriveInput) {
    const deadline = parseDateInput(input.deadline, 'Application deadline', 'deadline');
    const driveDate = input.driveDate ? parseDateInput(input.driveDate, 'Drive date', 'driveDate') : null;
    const status = input.status || 'UPCOMING';
    this.validateDates(deadline, driveDate, status, true);

    return prisma.placementDrive.create({
      data: {
        companyName: input.companyName.trim(),
        role: input.role.trim(),
        description: input.description?.trim() || null,
        driveType: input.driveType || 'ON_CAMPUS',
        eligibilityCgpa: input.eligibilityCgpa ?? 0,
        eligibleBranches: normaliseBranchesOrThrow(input.eligibleBranches),
        maxBacklogs: input.maxBacklogs ?? 0,
        minTenthPercent: input.minTenthPercent ?? null,
        minTwelfthPercent: input.minTwelfthPercent ?? null,
        batchYear: input.batchYear ?? null,
        ctcLpa: input.ctcLpa ?? null,
        location: input.location?.trim() || null,
        deadline,
        driveDate,
        status,
        selectionProcess: input.selectionProcess?.length
          ? input.selectionProcess
          : ['Resume Screening', 'Online Assessment', 'Technical Interview', 'HR Round'],
        createdById,
      },
    });
  }

  /**
   * Update drive
   */
  async updateDrive(driveId: string, input: Partial<CreateDriveInput>) {
    const existing = await prisma.placementDrive.findUnique({ where: { id: driveId } });
    if (!existing) {
      throw notFound('Placement drive');
    }

    const data: any = {};
    if (input.companyName !== undefined) data.companyName = input.companyName.trim();
    if (input.role !== undefined) data.role = input.role.trim();
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.driveType !== undefined) data.driveType = input.driveType;
    if (input.eligibilityCgpa !== undefined) data.eligibilityCgpa = input.eligibilityCgpa ?? 0;
    if (input.eligibleBranches !== undefined) data.eligibleBranches = normaliseBranchesOrThrow(input.eligibleBranches);
    if (input.maxBacklogs !== undefined) data.maxBacklogs = input.maxBacklogs ?? 0;
    if (input.minTenthPercent !== undefined) data.minTenthPercent = input.minTenthPercent;
    if (input.minTwelfthPercent !== undefined) data.minTwelfthPercent = input.minTwelfthPercent;
    if (input.batchYear !== undefined) data.batchYear = input.batchYear;
    if (input.ctcLpa !== undefined) data.ctcLpa = input.ctcLpa;
    if (input.location !== undefined) data.location = input.location?.trim() || null;
    if (input.deadline !== undefined) data.deadline = parseDateInput(input.deadline, 'Application deadline', 'deadline');
    if (input.driveDate !== undefined) {
      data.driveDate = input.driveDate ? parseDateInput(input.driveDate, 'Drive date', 'driveDate') : null;
    }
    if (input.status !== undefined) data.status = input.status;
    if (input.selectionProcess !== undefined) data.selectionProcess = input.selectionProcess;

    const deadline: Date = data.deadline ?? existing.deadline;
    const driveDate: Date | null = data.driveDate !== undefined ? data.driveDate : existing.driveDate;
    const status: string = data.status ?? existing.status;
    // Re-saving an unchanged past deadline (e.g. editing the description of a
    // closed drive) is fine; only a newly entered deadline must be in the future.
    const deadlineChanged =
      data.deadline !== undefined && Math.abs(data.deadline.getTime() - existing.deadline.getTime()) > 60_000;
    const reopened = data.status !== undefined && !OPEN_DRIVE_STATUSES.includes(existing.status);
    this.validateDates(deadline, driveDate, status, deadlineChanged || reopened);

    return prisma.placementDrive.update({
      where: { id: driveId },
      data,
    });
  }

  /**
   * Delete drive (applications cascade)
   */
  async deleteDrive(driveId: string) {
    const existing = await prisma.placementDrive.findUnique({
      where: { id: driveId },
      include: { _count: { select: { applications: true } } },
    });
    if (!existing) {
      throw notFound('Placement drive');
    }
    await prisma.placementDrive.delete({ where: { id: driveId } });
    return { id: driveId, removedApplications: existing._count.applications };
  }

  /**
   * Apply for a placement drive (Student)
   */
  async applyForDrive(driveId: string, studentId: string) {
    const drive = await prisma.placementDrive.findUnique({ where: { id: driveId } });
    if (!drive) {
      throw notFound('Placement drive');
    }

    const existingApplication = await prisma.placementApplication.findUnique({
      where: { driveId_studentId: { driveId, studentId } },
    });
    if (existingApplication) {
      throw badRequest(`You have already applied for this drive (status: ${existingApplication.status})`);
    }

    const window = applicationWindow(drive);
    if (!window.isOpen) {
      throw badRequest(window.closedReason!);
    }

    const profile = await prisma.placementProfile.findUnique({ where: { userId: studentId } });
    if (!profile) {
      throw badRequest('Please complete your placement profile before applying');
    }

    const { isEligible, reasons } = evaluateEligibility(drive, profile);
    if (!isEligible) {
      throw badRequest(`You are not eligible for this drive: ${reasons.join('; ')}`, { reasons });
    }

    return prisma.placementApplication.create({
      data: { driveId, studentId, status: 'APPLIED' },
    });
  }

  /**
   * Withdraw application
   */
  async withdrawApplication(driveId: string, studentId: string) {
    const application = await prisma.placementApplication.findUnique({
      where: { driveId_studentId: { driveId, studentId } },
    });

    if (!application) {
      throw notFound('Application');
    }
    if (FINAL_APPLICATION_STATUSES.includes(application.status)) {
      throw badRequest(`This application already has a final decision (${application.status}) and cannot be withdrawn`);
    }

    return prisma.placementApplication.delete({ where: { id: application.id } });
  }

  /**
   * Update application status and round (Admin/Teacher)
   */
  async updateApplicationStatus(
    applicationId: string,
    input: {
      status?: ApplicationStatus;
      currentRound?: string | null;
      assessmentScore?: number | null;
      notes?: string | null;
    },
  ) {
    const app = await prisma.placementApplication.findUnique({ where: { id: applicationId } });
    if (!app) {
      throw notFound('Application');
    }

    const data: any = {};
    if (input.status) data.status = input.status;
    if (input.currentRound) data.currentRound = input.currentRound;
    if (input.assessmentScore !== undefined) data.assessmentScore = input.assessmentScore;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

    return prisma.placementApplication.update({
      where: { id: applicationId },
      data,
      include: {
        student: {
          select: { id: true, fullName: true, username: true, email: true },
        },
        drive: {
          select: { id: true, companyName: true, role: true },
        },
      },
    });
  }

  /**
   * Get all registered student POD profiles (Admin/Teacher)
   */
  async getAllProfiles(filters?: { branch?: string; verified?: boolean; search?: string }) {
    const where: any = {};
    if (filters?.branch && filters.branch !== 'ALL') {
      where.branch = filters.branch;
    }
    if (filters?.verified !== undefined) {
      where.isVerified = filters.verified;
    }
    if (filters?.search) {
      where.OR = [
        { fullName: { contains: filters.search } },
        { rollNumber: { contains: filters.search } },
        { user: { email: { contains: filters.search } } },
      ];
    }

    return prisma.placementProfile.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, username: true, fullName: true, avatarUrl: true },
        },
      },
      orderBy: { cgpa: 'desc' },
    });
  }

  /**
   * Verify or unverify student profile (Admin/Teacher)
   */
  async verifyProfile(profileId: string, isVerified: boolean, verifiedBy: string) {
    const profile = await prisma.placementProfile.findUnique({ where: { id: profileId } });
    if (!profile) {
      throw notFound('Placement profile');
    }

    return prisma.placementProfile.update({
      where: { id: profileId },
      data: {
        isVerified,
        verifiedAt: isVerified ? new Date() : null,
        verifiedBy: isVerified ? verifiedBy : null,
      },
    });
  }

  /**
   * List candidates for assessment proctoring (Proctor / Admin / Teacher)
   */
  async getProctorCandidates(filters?: { driveId?: string; proctorStatus?: string; search?: string }) {
    const where: any = {};
    if (filters?.driveId && filters.driveId !== 'ALL') {
      where.driveId = filters.driveId;
    }
    if (filters?.proctorStatus && filters.proctorStatus !== 'ALL') {
      where.proctorStatus = filters.proctorStatus;
    }
    if (filters?.search) {
      where.OR = [
        { student: { fullName: { contains: filters.search } } },
        { student: { email: { contains: filters.search } } },
        { student: { placementProfile: { rollNumber: { contains: filters.search } } } },
      ];
    }

    return prisma.placementApplication.findMany({
      where,
      include: {
        drive: {
          select: { id: true, companyName: true, role: true, driveType: true, driveDate: true, selectionProcess: true },
        },
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
            username: true,
            placementProfile: true,
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  /**
   * Update candidate proctor status (Proctor)
   */
  async updateProctorStatus(
    applicationId: string,
    input: { proctorStatus: string; proctorNotes?: string; assessmentScore?: number }
  ) {
    const app = await prisma.placementApplication.findUnique({ where: { id: applicationId } });
    if (!app) {
      throw notFound('Application');
    }

    const data: any = {
      proctorStatus: input.proctorStatus,
    };
    if (input.proctorNotes !== undefined) data.proctorNotes = input.proctorNotes;
    if (input.assessmentScore !== undefined) data.assessmentScore = input.assessmentScore;

    if (input.proctorStatus === 'CLEARED') {
      data.status = 'SHORTLISTED';
      data.currentRound = 'Technical Interview';
    } else if (input.proctorStatus === 'DISQUALIFIED') {
      data.status = 'REJECTED';
      data.currentRound = 'Disqualified (Malpractice)';
    }

    return prisma.placementApplication.update({
      where: { id: applicationId },
      data,
      include: {
        student: {
          select: { id: true, fullName: true, username: true, email: true },
        },
        drive: {
          select: { id: true, companyName: true, role: true },
        },
      },
    });
  }

  /**
   * Proctor statistics for placement assessment invigilation
   */
  async getProctorStats() {
    const [
      totalInvigilated,
      clearedCount,
      flaggedCount,
      disqualifiedCount,
      activeAssessmentDrives,
    ] = await Promise.all([
      prisma.placementApplication.count(),
      prisma.placementApplication.count({ where: { proctorStatus: 'CLEARED' } }),
      prisma.placementApplication.count({ where: { proctorStatus: 'FLAGGED' } }),
      prisma.placementApplication.count({ where: { proctorStatus: 'DISQUALIFIED' } }),
      prisma.placementDrive.count({ where: { status: 'ACTIVE' } }),
    ]);

    return {
      totalInvigilated,
      clearedCount,
      flaggedCount,
      disqualifiedCount,
      activeAssessmentDrives,
    };
  }

  /**
   * Get student's application history
   */
  async getStudentApplications(studentId: string) {
    return prisma.placementApplication.findMany({
      where: { studentId },
      include: {
        drive: true,
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  /**
   * Placement statistics for dashboard
   */
  async getStats() {
    const [
      totalRegisteredStudents,
      drives,
      applicationGroups,
      placedStudents,
      branchGroups,
    ] = await Promise.all([
      prisma.placementProfile.count(),
      prisma.placementDrive.findMany({ select: { status: true, driveType: true, ctcLpa: true } }),
      prisma.placementApplication.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.placementApplication.findMany({
        where: { status: 'SELECTED' },
        distinct: ['studentId'],
        select: { studentId: true },
      }),
      prisma.placementProfile.groupBy({ by: ['branch'], _count: { _all: true } }),
    ]);

    const applicationsByStatus: Record<string, number> = {
      APPLIED: 0, SHORTLISTED: 0, INTERVIEWED: 0, SELECTED: 0, REJECTED: 0,
    };
    for (const g of applicationGroups) applicationsByStatus[g.status] = g._count._all;
    const totalApplications = Object.values(applicationsByStatus).reduce((a, b) => a + b, 0);

    const ctcs = drives.map((d) => d.ctcLpa).filter((c): c is number => typeof c === 'number' && c > 0);
    const countStatus = (s: string) => drives.filter((d) => d.status === s).length;
    const byBranch: Record<string, number> = {};
    for (const g of branchGroups) byBranch[g.branch || 'General'] = g._count._all;

    return {
      totalRegisteredStudents,
      totalDrives: drives.length,
      activeDrives: countStatus('ACTIVE'),
      upcomingDrives: countStatus('UPCOMING'),
      completedDrives: countStatus('COMPLETED'),
      cancelledDrives: countStatus('CANCELLED'),
      onCampusDrives: drives.filter((d) => d.driveType === 'ON_CAMPUS').length,
      offCampusDrives: drives.filter((d) => d.driveType === 'OFF_CAMPUS').length,
      totalApplications,
      applicationsByStatus,
      byBranch,
      selectedCount: applicationsByStatus.SELECTED,
      placedStudents: placedStudents.length,
      averageCtc: ctcs.length ? Math.round((ctcs.reduce((a, b) => a + b, 0) / ctcs.length) * 10) / 10 : null,
      highestCtc: ctcs.length ? Math.max(...ctcs) : null,
      placementRate:
        totalRegisteredStudents > 0 ? ((placedStudents.length / totalRegisteredStudents) * 100).toFixed(1) : '0',
    };
  }
}

export const placementService = new PlacementService();
