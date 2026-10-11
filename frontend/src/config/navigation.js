import {
  Bell,
  BookMarked,
  BookOpen,
  Bot,
  Briefcase,
  Building2,
  ChartNoAxesColumn,
  ClipboardList,
  CodeXml,
  Compass,
  FileCheck,
  GraduationCap,
  LayoutDashboard,
  Library,
  ListChecks,
  ScrollText,
  SquareCheckBig,
  TrendingUp,
  Users,
  Video,
} from 'lucide-react';

/**
 * Sidebar navigation, grouped by role.
 *
 * Two rules hold across every role: no two entries in a role share a label, and
 * no two entries in a role share an icon. A sidebar where four rows carry the
 * same book glyph is unscannable, and duplicate labels ("Courses" for both the
 * shared catalog and the management screen) make the wrong one look right.
 */

export const ROLE_LABEL = {
  ADMIN: 'Administrator',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PROCTOR: 'Proctor',
};

/** Groups shared verbatim across roles keep their identity in one place. */
const workspaceItems = [
  { to: '/ai-assistant', label: 'Assistant', icon: Bot },
  { to: '/notifications', label: 'Notifications', icon: Bell, badge: 'notifications' },
];

export const NAV_BY_ROLE = {
  ADMIN: [
    {
      id: 'overview',
      label: 'Overview',
      items: [
        { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/analytics', label: 'Analytics', icon: ChartNoAxesColumn },
        { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
      ],
    },
    {
      id: 'people',
      label: 'People',
      items: [
        { to: '/admin/users', label: 'Users', icon: Users },
        { to: '/admin/class-batches', label: 'Class batches', icon: GraduationCap },
        { to: '/admin/organizations', label: 'Organizations', icon: Building2 },
      ],
    },
    {
      id: 'learning',
      label: 'Learning',
      items: [
        { to: '/admin/courses', label: 'Course management', icon: BookOpen },
        { to: '/courses', label: 'Course catalog', icon: Compass },
      ],
    },
    {
      id: 'assessment',
      label: 'Assessment',
      items: [
        { to: '/admin/tests', label: 'Tests', icon: FileCheck },
        { to: '/admin/coding-problems', label: 'Coding problems', icon: CodeXml },
        { to: '/admin/assignments', label: 'Assignments', icon: ClipboardList },
      ],
    },
    {
      id: 'insight',
      label: 'Insight',
      items: [
        { to: '/admin/results', label: 'Results', icon: SquareCheckBig },
        { to: '/admin/proctoring', label: 'Proctoring', icon: Video },
      ],
    },
    {
      id: 'career',
      label: 'Career',
      items: [
        { to: '/admin/placements', label: 'Placements', icon: Briefcase },
      ],
    },
    { id: 'workspace', label: 'Workspace', items: workspaceItems },
  ],

  TEACHER: [
    {
      id: 'teaching',
      label: 'Teaching',
      items: [
        { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/teacher/courses', label: 'My courses', icon: BookOpen },
        { to: '/courses', label: 'Course catalog', icon: Compass },
        { to: '/teacher/class-batches', label: 'Class batches', icon: GraduationCap },
      ],
    },
    {
      id: 'assessment',
      label: 'Assessment',
      items: [
        { to: '/teacher/banks', label: 'Question banks', icon: Library },
        { to: '/teacher/questions', label: 'Questions', icon: ListChecks },
        { to: '/teacher/tests', label: 'Tests', icon: FileCheck },
        { to: '/teacher/coding-problems', label: 'Coding problems', icon: CodeXml },
        { to: '/teacher/assignments', label: 'Assignments', icon: ClipboardList },
      ],
    },
    {
      id: 'insight',
      label: 'Insight',
      items: [
        { to: '/teacher/results', label: 'Results', icon: SquareCheckBig },
        { to: '/analytics', label: 'Analytics', icon: ChartNoAxesColumn },
        { to: '/teacher/proctoring', label: 'Proctoring', icon: Video },
      ],
    },
    {
      id: 'career',
      label: 'Career',
      items: [
        { to: '/teacher/placements', label: 'Placements', icon: Briefcase },
      ],
    },
    { id: 'workspace', label: 'Workspace', items: workspaceItems },
  ],

  STUDENT: [
    {
      id: 'learning',
      label: 'Learning',
      items: [
        { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/my-courses', label: 'My courses', icon: BookMarked },
        { to: '/courses', label: 'Course catalog', icon: Compass },
        { to: '/student/assignments', label: 'Assignments', icon: ClipboardList },
      ],
    },
    {
      id: 'practice',
      label: 'Practice',
      items: [
        { to: '/student/tests', label: 'My tests', icon: FileCheck },
        { to: '/student/coding-problems', label: 'Coding problems', icon: CodeXml },
      ],
    },
    {
      id: 'progress',
      label: 'Progress',
      items: [
        { to: '/student/results', label: 'Results', icon: SquareCheckBig },
        { to: '/student/progress', label: 'My progress', icon: TrendingUp },
      ],
    },
    {
      id: 'career',
      label: 'Career',
      items: [
        { to: '/placements', label: 'Placements', icon: Briefcase },
      ],
    },
    { id: 'workspace', label: 'Workspace', items: workspaceItems },
  ],

  PROCTOR: [
    {
      id: 'invigilation',
      label: 'Invigilation',
      items: [
        { to: '/proctoring', label: 'Live sessions', icon: Video, end: true },
        { to: '/proctor/placements', label: 'Placement Assessments', icon: Briefcase },
        { to: '/courses', label: 'Course catalog', icon: Compass },
      ],
    },
    { id: 'workspace', label: 'Workspace', items: workspaceItems },
  ],
};

export const navForRole = (role) => NAV_BY_ROLE[role] ?? [];

/** Flat list of every destination a role can reach, for the command palette. */
export const flatNavForRole = (role) =>
  navForRole(role).flatMap((group) =>
    group.items.map((item) => ({ ...item, group: group.label })),
  );

/**
 * Quick actions surface the create-shaped things a role does most; they live
 * beside navigation in the command palette rather than in the sidebar, which
 * stays a map of places rather than a list of verbs.
 */
export const QUICK_ACTIONS_BY_ROLE = {
  ADMIN: [
    { to: '/admin/users', label: 'Manage users', hint: 'Roles, blocks and invitations' },
    { to: '/admin/tests', label: 'Review tests', hint: 'Every test across the institution' },
    { to: '/admin/audit', label: 'Open audit log', hint: 'Who changed what, and when' },
  ],
  TEACHER: [
    { to: '/teacher/tests', label: 'Create a test', hint: 'Sections, timing and grading' },
    { to: '/teacher/questions', label: 'Add a question', hint: 'MCQ, numeric, descriptive, coding' },
    { to: '/teacher/results', label: 'Grade submissions', hint: 'Manual review queue' },
  ],
  STUDENT: [
    { to: '/student/tests', label: 'Start a test', hint: 'Tests available to you now' },
    { to: '/student/results', label: 'See my results', hint: 'Scores and answer review' },
  ],
  PROCTOR: [
    { to: '/proctoring', label: 'Watch live sessions', hint: 'Candidates currently in an exam' },
    { to: '/proctor/placements', label: 'Invigilate placement tests', hint: 'Online tests & candidate audit flags' },
  ],
};

export const quickActionsForRole = (role) => QUICK_ACTIONS_BY_ROLE[role] ?? [];
