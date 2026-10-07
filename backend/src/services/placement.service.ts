import { prisma } from '../config/database.js';
import { notFound, badRequest } from '../utils/errors.js';

export interface UpsertProfileInput {
  fullName: string;
  rollNumber?: string;
  phone?: string;
  branch?: string;
  cgpa: number;
  tenthPercentage?: number;
  twelfthPercentage?: number;
  activeBacklogs?: number;
  graduationYear?: number;
  skills?: string[];
  resumeUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
}

export interface CreateDriveInput {
  companyName: string;
  role: string;
  description?: string;
  driveType?: 'ON_CAMPUS' | 'OFF_CAMPUS';
  eligibilityCgpa?: number;
  eligibleBranches?: string[];
  maxBacklogs?: number;
  minTenthPercent?: number;
  minTwelfthPercent?: number;
  batchYear?: number;
  ctcLpa?: number;
  location?: string;
  deadline: string | Date;
  driveDate?: string | Date;
  status?: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
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
    const data = {
      fullName: input.fullName,
      rollNumber: input.rollNumber || null,
      phone: input.phone || null,
      branch: input.branch || null,
      cgpa: Number(input.cgpa) || 0,
      tenthPercentage: input.tenthPercentage !== undefined && input.tenthPercentage !== null ? Number(input.tenthPercentage) : null,
      twelfthPercentage: input.twelfthPercentage !== undefined && input.twelfthPercentage !== null ? Number(input.twelfthPercentage) : null,
      activeBacklogs: input.activeBacklogs !== undefined && input.activeBacklogs !== null ? Number(input.activeBacklogs) : 0,
      graduationYear: input.graduationYear !== undefined && input.graduationYear !== null ? Number(input.graduationYear) : null,
      skills: input.skills || [],
      resumeUrl: input.resumeUrl || null,
      githubUrl: input.githubUrl || null,
      linkedinUrl: input.linkedinUrl || null,
      isVerified: true,
    };

    const profile = await prisma.placementProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...data,
      },
      update: data,
    });

    return profile;
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
          select: { id: true },
        },
      },
    });

    // If student, check eligibility and application status for each drive
    if (userRole === 'STUDENT') {
      const studentProfile = await prisma.placementProfile.findUnique({
        where: { userId },
      });

      const studentApplications = await prisma.placementApplication.findMany({
        where: { studentId: userId },
      });

      const appMap = new Map(studentApplications.map((app) => [app.driveId, app]));

      let evaluatedDrives = drives.map((drive: any) => {
        const application = appMap.get(drive.id) || null;
        let isEligible = true;
        const reasons: string[] = [];

        if (!studentProfile) {
          isEligible = false;
          reasons.push('Please complete placement registration profile');
        } else {
          if (drive.eligibilityCgpa > 0 && studentProfile.cgpa < drive.eligibilityCgpa) {
            isEligible = false;
            reasons.push(`Minimum CGPA: ${drive.eligibilityCgpa} (Your CGPA: ${studentProfile.cgpa})`);
          }

          const eligibleBranches = Array.isArray(drive.eligibleBranches)
            ? (drive.eligibleBranches as string[])
            : [];
          if (
            eligibleBranches.length > 0 &&
            (!studentProfile.branch || !eligibleBranches.includes(studentProfile.branch))
          ) {
            isEligible = false;
            reasons.push(`Eligible branches: ${eligibleBranches.join(', ')} (Your branch: ${studentProfile.branch || 'None'})`);
          }

          if (drive.maxBacklogs !== undefined && drive.maxBacklogs !== null && studentProfile.activeBacklogs > drive.maxBacklogs) {
            isEligible = false;
            reasons.push(`Max ${drive.maxBacklogs} active backlogs allowed (You have ${studentProfile.activeBacklogs})`);
          }

          if (drive.minTenthPercent && studentProfile.tenthPercentage && studentProfile.tenthPercentage < drive.minTenthPercent) {
            isEligible = false;
            reasons.push(`Minimum 10th marks: ${drive.minTenthPercent}% (You have ${studentProfile.tenthPercentage}%)`);
          }

          if (drive.minTwelfthPercent && studentProfile.twelfthPercentage && studentProfile.twelfthPercentage < drive.minTwelfthPercent) {
            isEligible = false;
            reasons.push(`Minimum 12th marks: ${drive.minTwelfthPercent}% (You have ${studentProfile.twelfthPercentage}%)`);
          }

          if (drive.batchYear && studentProfile.graduationYear && studentProfile.graduationYear !== drive.batchYear) {
            isEligible = false;
            reasons.push(`Eligible Batch: ${drive.batchYear} (Your batch: ${studentProfile.graduationYear})`);
          }
        }

        const isExpired = new Date(drive.deadline) < new Date();

        return {
          ...drive,
          applicantCount: drive.applications.length,
          hasApplied: !!application,
          applicationStatus: application ? application.status : null,
          appliedAt: application ? application.appliedAt : null,
          isEligible,
          eligibilityReason: reasons.join('; '),
          isExpired,
        };
      });

      if (filters?.onlyEligible) {
        evaluatedDrives = evaluatedDrives.filter((d) => d.isEligible);
      }

      return evaluatedDrives;
    }

    return drives.map((drive: any) => ({
      ...drive,
      applicantCount: drive.applications.length,
      isExpired: new Date(drive.deadline) < new Date(),
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
      const studentProfile = await prisma.placementProfile.findUnique({
        where: { userId },
      });
      const application = drive.applications.find((app: any) => app.studentId === userId);

      let isEligible = true;
      const reasons: string[] = [];
      if (!studentProfile) {
        isEligible = false;
        reasons.push('Please complete placement registration profile');
      } else {
        if (drive.eligibilityCgpa > 0 && studentProfile.cgpa < drive.eligibilityCgpa) {
          isEligible = false;
          reasons.push(`Minimum CGPA: ${drive.eligibilityCgpa} (Yours: ${studentProfile.cgpa})`);
        }
        const branches = Array.isArray(drive.eligibleBranches) ? (drive.eligibleBranches as string[]) : [];
        if (branches.length > 0 && (!studentProfile.branch || !branches.includes(studentProfile.branch))) {
          isEligible = false;
          reasons.push(`Eligible branches: ${branches.join(', ')}`);
        }
        if (drive.maxBacklogs !== undefined && drive.maxBacklogs !== null && studentProfile.activeBacklogs > drive.maxBacklogs) {
          isEligible = false;
          reasons.push(`Max backlogs: ${drive.maxBacklogs} (You have: ${studentProfile.activeBacklogs})`);
        }
        if (drive.minTenthPercent && studentProfile.tenthPercentage && studentProfile.tenthPercentage < drive.minTenthPercent) {
          isEligible = false;
          reasons.push(`Min 10th: ${drive.minTenthPercent}% (Yours: ${studentProfile.tenthPercentage}%)`);
        }
        if (drive.minTwelfthPercent && studentProfile.twelfthPercentage && studentProfile.twelfthPercentage < drive.minTwelfthPercent) {
          isEligible = false;
          reasons.push(`Min 12th: ${drive.minTwelfthPercent}% (Yours: ${studentProfile.twelfthPercentage}%)`);
        }
        if (drive.batchYear && studentProfile.graduationYear && studentProfile.graduationYear !== drive.batchYear) {
          isEligible = false;
          reasons.push(`Target Batch: ${drive.batchYear} (Yours: ${studentProfile.graduationYear})`);
        }
      }

      return {
        ...drive,
        applications: undefined, // Hide other students' applications from student
        applicantCount: drive.applications.length,
        hasApplied: !!application,
        applicationStatus: application?.status || null,
        appliedAt: application?.appliedAt || null,
        isEligible,
        eligibilityReason: reasons.join('; '),
      };
    }

    return {
      ...drive,
      applicantCount: drive.applications.length,
    };
  }

  /**
   * Create a new placement drive (Admin / Teacher / Staff)
   */
  async createDrive(createdById: string, input: CreateDriveInput) {
    const drive = await prisma.placementDrive.create({
      data: {
        companyName: input.companyName,
        role: input.role,
        description: input.description || null,
        driveType: input.driveType || 'ON_CAMPUS',
        eligibilityCgpa: input.eligibilityCgpa !== undefined ? Number(input.eligibilityCgpa) : 0,
        eligibleBranches: input.eligibleBranches || [],
        maxBacklogs: input.maxBacklogs !== undefined && input.maxBacklogs !== null ? Number(input.maxBacklogs) : 0,
        minTenthPercent: input.minTenthPercent !== undefined && input.minTenthPercent !== null ? Number(input.minTenthPercent) : null,
        minTwelfthPercent: input.minTwelfthPercent !== undefined && input.minTwelfthPercent !== null ? Number(input.minTwelfthPercent) : null,
        batchYear: input.batchYear !== undefined && input.batchYear !== null ? Number(input.batchYear) : null,
        ctcLpa: input.ctcLpa !== undefined ? Number(input.ctcLpa) : null,
        location: input.location || null,
        deadline: new Date(input.deadline),
        driveDate: input.driveDate ? new Date(input.driveDate) : null,
        status: input.status || 'UPCOMING',
        createdById,
      },
    });
    return drive;
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
    if (input.companyName !== undefined) data.companyName = input.companyName;
    if (input.role !== undefined) data.role = input.role;
    if (input.description !== undefined) data.description = input.description;
    if (input.driveType !== undefined) data.driveType = input.driveType;
    if (input.eligibilityCgpa !== undefined) data.eligibilityCgpa = Number(input.eligibilityCgpa);
    if (input.eligibleBranches !== undefined) data.eligibleBranches = input.eligibleBranches;
    if (input.maxBacklogs !== undefined) data.maxBacklogs = Number(input.maxBacklogs);
    if (input.minTenthPercent !== undefined) data.minTenthPercent = input.minTenthPercent !== null ? Number(input.minTenthPercent) : null;
    if (input.minTwelfthPercent !== undefined) data.minTwelfthPercent = input.minTwelfthPercent !== null ? Number(input.minTwelfthPercent) : null;
    if (input.batchYear !== undefined) data.batchYear = input.batchYear !== null ? Number(input.batchYear) : null;
    if (input.ctcLpa !== undefined) data.ctcLpa = Number(input.ctcLpa);
    if (input.location !== undefined) data.location = input.location;
    if (input.deadline !== undefined) data.deadline = new Date(input.deadline);
    if (input.driveDate !== undefined) data.driveDate = input.driveDate ? new Date(input.driveDate) : null;
    if (input.status !== undefined) data.status = input.status;

    return prisma.placementDrive.update({
      where: { id: driveId },
      data,
    });
  }

  /**
   * Delete drive
   */
  async deleteDrive(driveId: string) {
    const existing = await prisma.placementDrive.findUnique({ where: { id: driveId } });
    if (!existing) {
      throw notFound('Placement drive');
    }
    return prisma.placementDrive.delete({ where: { id: driveId } });
  }

  /**
   * Apply for a placement drive (Student)
   */
  async applyForDrive(driveId: string, studentId: string) {
    const drive = await prisma.placementDrive.findUnique({ where: { id: driveId } });
    if (!drive) {
      throw notFound('Placement drive');
    }

    if (new Date(drive.deadline) < new Date()) {
      throw badRequest('Deadline has passed for this placement drive');
    }

    if (drive.status === 'COMPLETED' || drive.status === 'CANCELLED') {
      throw badRequest(`This drive is no longer accepting applications (Status: ${drive.status})`);
    }

    const profile = await prisma.placementProfile.findUnique({ where: { userId: studentId } });
    if (!profile) {
      throw badRequest('Please complete your Placement Registration Profile first before applying');
    }

    if (drive.eligibilityCgpa > 0 && profile.cgpa < drive.eligibilityCgpa) {
      throw badRequest(
        `Eligibility criteria not met: Required CGPA is ${drive.eligibilityCgpa}, but your CGPA is ${profile.cgpa}`
      );
    }

    const branches = Array.isArray(drive.eligibleBranches) ? (drive.eligibleBranches as string[]) : [];
    if (branches.length > 0 && (!profile.branch || !branches.includes(profile.branch))) {
      throw badRequest(
        `Eligibility criteria not met: Allowed branches are ${branches.join(', ')}, but your branch is ${profile.branch || 'unspecified'}`
      );
    }

    if (drive.maxBacklogs !== undefined && drive.maxBacklogs !== null && profile.activeBacklogs > drive.maxBacklogs) {
      throw badRequest(
        `Eligibility criteria not met: Maximum allowed backlogs is ${drive.maxBacklogs}, but you have ${profile.activeBacklogs}`
      );
    }

    if (drive.minTenthPercent && profile.tenthPercentage && profile.tenthPercentage < drive.minTenthPercent) {
      throw badRequest(
        `Eligibility criteria not met: Minimum 10th marks required is ${drive.minTenthPercent}%, but you have ${profile.tenthPercentage}%`
      );
    }

    if (drive.minTwelfthPercent && profile.twelfthPercentage && profile.twelfthPercentage < drive.minTwelfthPercent) {
      throw badRequest(
        `Eligibility criteria not met: Minimum 12th marks required is ${drive.minTwelfthPercent}%, but you have ${profile.twelfthPercentage}%`
      );
    }

    if (drive.batchYear && profile.graduationYear && profile.graduationYear !== drive.batchYear) {
      throw badRequest(
        `Eligibility criteria not met: Drive is for graduation year ${drive.batchYear}, but your year is ${profile.graduationYear}`
      );
    }

    const existingApplication = await prisma.placementApplication.findUnique({
      where: {
        driveId_studentId: {
          driveId,
          studentId,
        },
      },
    });

    if (existingApplication) {
      throw badRequest('You have already applied for this placement drive');
    }

    return prisma.placementApplication.create({
      data: {
        driveId,
        studentId,
        status: 'APPLIED',
      },
    });
  }

  /**
   * Withdraw application
   */
  async withdrawApplication(driveId: string, studentId: string) {
    const application = await prisma.placementApplication.findUnique({
      where: {
        driveId_studentId: { driveId, studentId },
      },
    });

    if (!application) {
      throw notFound('Application');
    }

    return prisma.placementApplication.delete({
      where: { id: application.id },
    });
  }

  /**
   * Update application status (Admin/Teacher)
   */
  async updateApplicationStatus(applicationId: string, status: string, notes?: string) {
    const app = await prisma.placementApplication.findUnique({ where: { id: applicationId } });
    if (!app) {
      throw notFound('Application');
    }

    return prisma.placementApplication.update({
      where: { id: applicationId },
      data: {
        status,
        ...(notes !== undefined ? { notes } : {}),
      },
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
      totalDrives,
      activeDrives,
      onCampusDrives,
      offCampusDrives,
      totalApplications,
      selectedCount,
    ] = await Promise.all([
      prisma.placementProfile.count(),
      prisma.placementDrive.count(),
      prisma.placementDrive.count({ where: { status: 'ACTIVE' } }),
      prisma.placementDrive.count({ where: { driveType: 'ON_CAMPUS' } }),
      prisma.placementDrive.count({ where: { driveType: 'OFF_CAMPUS' } }),
      prisma.placementApplication.count(),
      prisma.placementApplication.count({ where: { status: 'SELECTED' } }),
    ]);

    return {
      totalRegisteredStudents,
      totalDrives,
      activeDrives,
      onCampusDrives,
      offCampusDrives,
      totalApplications,
      selectedCount,
      placementRate: totalRegisteredStudents > 0 ? ((selectedCount / totalRegisteredStudents) * 100).toFixed(1) : '0',
    };
  }
}

export const placementService = new PlacementService();
