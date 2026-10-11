import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { AppLayout } from '../layouts/AppLayout.jsx';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { HomePage } from '../pages/HomePage.jsx';
import { Spinner } from '../components/ui.jsx';

// Auth screens stay in the entry chunk: they are the first paint for signed-out
// visitors, so lazy-loading them would only add a spinner before the login box.
import { LoginPage } from '../pages/auth/LoginPage.jsx';
import { RegisterPage } from '../pages/auth/RegisterPage.jsx';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage.jsx';
import { VerifyEmailPage } from '../pages/auth/VerifyEmailPage.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';

/**
 * The pages use named exports, while React.lazy expects a module with a
 * `default`. This adapts one to the other so the app can be code-split without
 * rewriting every page's export style.
 */
const page = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));

const ProfilePage = page(() => import('../pages/ProfilePage.jsx'), 'ProfilePage');
const NotificationsPage = page(() => import('../pages/NotificationsPage.jsx'), 'NotificationsPage');
const CoursesPage = page(() => import('../pages/CoursesPage.jsx'), 'CoursesPage');
const QuestionsPage = page(() => import('../pages/QuestionsPage.jsx'), 'QuestionsPage');
const QuestionBanksPage = page(() => import('../pages/QuestionBanksPage.jsx'), 'QuestionBanksPage');
const TestsPage = page(() => import('../pages/TestsPage.jsx'), 'TestsPage');
const TestDetailPage = page(() => import('../pages/TestDetailPage.jsx'), 'TestDetailPage');
const TeacherResults = page(() => import('../pages/TeacherResults.jsx'), 'TeacherResults');
const TeacherResultDetail = page(() => import('../pages/TeacherResultDetail.jsx'), 'TeacherResultDetail');
const TeacherAssignmentsPage = page(() => import('../pages/AssignmentsPage.jsx'), 'TeacherAssignmentsPage');
const StudentAssignmentsPage = page(() => import('../pages/AssignmentsPage.jsx'), 'StudentAssignmentsPage');
const ClassBatchesPage = page(() => import('../pages/ClassBatchesPage.jsx'), 'ClassBatchesPage');
const CourseCatalogPage = page(() => import('../pages/courses/CourseCatalogPage.jsx'), 'CourseCatalogPage');
const CourseDetailPage = page(() => import('../pages/courses/CourseDetailPage.jsx'), 'CourseDetailPage');
const LessonPage = page(() => import('../pages/courses/LessonPage.jsx'), 'LessonPage');
const MyCoursesPage = page(() => import('../pages/courses/MyCoursesPage.jsx'), 'MyCoursesPage');
const UsersPage = page(() => import('../pages/UsersPage.jsx'), 'UsersPage');
const AnalyticsPage = page(() => import('../pages/analytics/AnalyticsPage.jsx'), 'AnalyticsPage');
const TestAnalyticsPage = page(() => import('../pages/analytics/TestAnalyticsPage.jsx'), 'TestAnalyticsPage');
const StudentProgressPage = page(() => import('../pages/student/StudentProgressPage.jsx'), 'StudentProgressPage');
const StudentDashboard = page(() => import('../pages/student/StudentDashboard.jsx'), 'StudentDashboard');
const MyTests = page(() => import('../pages/student/MyTests.jsx'), 'MyTests');
const ExamPage = page(() => import('../pages/student/ExamPage.jsx'), 'ExamPage');
const StudentResults = page(() => import('../pages/student/StudentResults.jsx'), 'StudentResults');
const StudentResultDetail = page(() => import('../pages/student/StudentResultDetail.jsx'), 'StudentResultDetail');
const TeacherDashboard = page(() => import('../pages/teacher/TeacherDashboard.jsx'), 'TeacherDashboard');
const AdminDashboard = page(() => import('../pages/admin/AdminDashboard.jsx'), 'AdminDashboard');
const AdminTestsPage = page(() => import('../pages/admin/AdminTestsPage.jsx'), 'AdminTestsPage');
const AdminTestDetailPage = page(() => import('../pages/admin/AdminTestDetailPage.jsx'), 'AdminTestDetailPage');
const AdminResultsPage = page(() => import('../pages/admin/AdminResultsPage.jsx'), 'AdminResultsPage');
const AdminResultDetailPage = page(() => import('../pages/admin/AdminResultDetailPage.jsx'), 'AdminResultDetailPage');
const AdminAuditPage = page(() => import('../pages/admin/AdminAuditPage.jsx'), 'AdminAuditPage');
const CodingProblemsPage = page(() => import('../pages/coding/CodingProblemsPage.jsx'), 'CodingProblemsPage');
const StudentCodingProblemsPage = page(() => import('../pages/coding/StudentCodingProblemsPage.jsx'), 'StudentCodingProblemsPage');
const CodingProblemSolvePage = page(() => import('../pages/coding/CodingProblemSolvePage.jsx'), 'CodingProblemSolvePage');
const ProctoringDashboard = page(() => import('../pages/proctoring/ProctoringDashboard.jsx'), 'ProctoringDashboard');
const AiAssistantPage = page(() => import('../pages/ai/AiAssistantPage.jsx'), 'AiAssistantPage');
const SearchResultsPage = page(() => import('../pages/search/SearchResultsPage.jsx'), 'SearchResultsPage');
const OrganizationsPage = page(() => import('../pages/organizations/OrganizationsPage.jsx'), 'OrganizationsPage');
const SettingsPage = page(() => import('../pages/SettingsPage.jsx'), 'SettingsPage');
const PlacementPage = page(() => import('../pages/placement/PlacementPage.jsx'), 'PlacementPage');
const AdminPlacementPage = page(() => import('../pages/placement/AdminPlacementPage.jsx'), 'AdminPlacementPage');
const ProctorPlacementPage = page(() => import('../pages/placement/ProctorPlacementPage.jsx'), 'ProctorPlacementPage');

export const roleHome = {
  ADMIN: '/admin',
  TEACHER: '/teacher',
  STUDENT: '/student',
  PROCTOR: '/proctoring',
};

const ALL_ROLES = ['ADMIN', 'TEACHER', 'STUDENT', 'PROCTOR'];

/** Wraps an element in the role guard plus the lazy-loading boundary. */
const guard = (roles, element) => (
  <ProtectedRoute roles={roles}>
    <Suspense fallback={<Spinner />}>{element}</Suspense>
  </ProtectedRoute>
);

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
      </Route>

      <Route path="/" element={<HomePage />} />

      <Route element={<AppLayout />}>
        {/* Profile previously sat outside AppLayout, so it rendered with no
            sidebar or header and stranded the user with no way back. */}
        <Route path="/profile" element={guard(ALL_ROLES, <ProfilePage />)} />
        <Route path="/settings" element={guard(ALL_ROLES, <SettingsPage />)} />

        {/* One canonical notifications route for every role. The header bell used
            to build `/{role}/notifications`, which 404'd for PROCTOR because no
            such route was ever declared. */}
        <Route path="/notifications" element={guard(ALL_ROLES, <NotificationsPage />)} />
        <Route path="/admin/notifications" element={<Navigate to="/notifications" replace />} />
        <Route path="/teacher/notifications" element={<Navigate to="/notifications" replace />} />
        <Route path="/student/notifications" element={<Navigate to="/notifications" replace />} />

        <Route path="/courses" element={guard(ALL_ROLES, <CourseCatalogPage />)} />
        <Route path="/courses/:courseId" element={guard(ALL_ROLES, <CourseDetailPage />)} />
        <Route path="/my-courses" element={guard(['STUDENT'], <MyCoursesPage />)} />
        <Route path="/lessons/:lessonId" element={guard(['ADMIN', 'TEACHER', 'STUDENT'], <LessonPage />)} />
        <Route path="/search" element={guard(ALL_ROLES, <SearchResultsPage />)} />
        <Route path="/ai-assistant" element={guard(ALL_ROLES, <AiAssistantPage />)} />

        <Route path="/analytics" element={guard(['ADMIN', 'TEACHER'], <AnalyticsPage />)} />
        <Route
          path="/analytics/tests/:testId"
          element={guard(['ADMIN', 'TEACHER'], <TestAnalyticsPage />)}
        />

        <Route path="/admin" element={guard(['ADMIN'], <AdminDashboard />)} />
        <Route path="/admin/users" element={guard(['ADMIN'], <UsersPage />)} />
        <Route path="/admin/courses" element={guard(['ADMIN'], <CoursesPage />)} />
        <Route path="/admin/class-batches" element={guard(['ADMIN'], <ClassBatchesPage />)} />
        <Route path="/admin/organizations" element={guard(['ADMIN'], <OrganizationsPage />)} />
        <Route path="/admin/tests" element={guard(['ADMIN'], <AdminTestsPage />)} />
        <Route path="/admin/tests/:testId" element={guard(['ADMIN'], <AdminTestDetailPage />)} />
        <Route path="/admin/coding-problems" element={guard(['ADMIN'], <CodingProblemsPage />)} />
        <Route path="/admin/assignments" element={guard(['ADMIN'], <TeacherAssignmentsPage />)} />
        <Route path="/admin/results" element={guard(['ADMIN'], <AdminResultsPage />)} />
        <Route path="/admin/results/:attemptId" element={guard(['ADMIN'], <AdminResultDetailPage />)} />
        <Route path="/admin/proctoring" element={guard(['ADMIN'], <ProctoringDashboard />)} />
        <Route path="/admin/audit" element={guard(['ADMIN'], <AdminAuditPage />)} />
        <Route path="/admin/placements" element={guard(['ADMIN'], <AdminPlacementPage />)} />

        <Route path="/teacher" element={guard(['TEACHER'], <TeacherDashboard />)} />
        <Route path="/teacher/courses" element={guard(['TEACHER'], <CoursesPage />)} />
        <Route path="/teacher/class-batches" element={guard(['TEACHER'], <ClassBatchesPage />)} />
        <Route path="/teacher/questions" element={guard(['TEACHER'], <QuestionsPage />)} />
        <Route path="/teacher/banks" element={guard(['TEACHER'], <QuestionBanksPage />)} />
        <Route path="/teacher/tests" element={guard(['TEACHER'], <TestsPage />)} />
        <Route path="/teacher/tests/:testId" element={guard(['TEACHER'], <TestDetailPage />)} />
        <Route path="/teacher/coding-problems" element={guard(['TEACHER'], <CodingProblemsPage />)} />
        <Route path="/teacher/assignments" element={guard(['TEACHER'], <TeacherAssignmentsPage />)} />
        <Route path="/teacher/results" element={guard(['TEACHER'], <TeacherResults />)} />
        <Route path="/teacher/results/:attemptId" element={guard(['TEACHER'], <TeacherResultDetail />)} />
        <Route path="/teacher/proctoring" element={guard(['TEACHER'], <ProctoringDashboard />)} />
        <Route path="/teacher/placements" element={guard(['TEACHER'], <AdminPlacementPage />)} />

        <Route path="/proctoring" element={guard(['PROCTOR', 'ADMIN', 'TEACHER'], <ProctoringDashboard />)} />
        <Route path="/proctor/placements" element={guard(['PROCTOR', 'ADMIN', 'TEACHER'], <ProctorPlacementPage />)} />

        <Route path="/student" element={guard(['STUDENT'], <StudentDashboard />)} />
        <Route path="/student/tests" element={guard(['STUDENT'], <MyTests />)} />
        <Route path="/student/tests/:testId/exam" element={guard(['STUDENT'], <ExamPage />)} />
        <Route path="/student/coding-problems" element={guard(['STUDENT'], <StudentCodingProblemsPage />)} />
        <Route path="/student/coding-problems/:problemId" element={guard(['STUDENT'], <CodingProblemSolvePage />)} />
        <Route path="/student/assignments" element={guard(['STUDENT'], <StudentAssignmentsPage />)} />
        <Route path="/student/results" element={guard(['STUDENT'], <StudentResults />)} />
        <Route path="/student/results/:attemptId" element={guard(['STUDENT'], <StudentResultDetail />)} />
        <Route path="/student/progress" element={guard(['STUDENT'], <StudentProgressPage />)} />
        <Route path="/placements" element={guard(['STUDENT'], <PlacementPage />)} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user, hasHydrated } = useAuthStore();
  const location = useLocation();

  if (!hasHydrated) return <Spinner label="Restoring your session…" />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (roles && (!user || !roles.includes(user.role))) {
    return <Navigate to={roleHome[user?.role] ?? '/'} replace />;
  }
  return children;
}
