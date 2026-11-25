import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { NotFoundPage } from './NotFoundPage';
import { PATTERNS as P } from './routes';
import { PublicOnly } from './guards/PublicOnly';
import { RequireRole } from './guards/RequireRole';
import { RootRedirect } from './guards/RootRedirect';
import { AuthLoginPage } from '@/features/auth/pages/AuthLoginPage';
import { AuthCompanyRegisterPage } from '@/features/auth/pages/AuthCompanyRegisterPage';
import { AuthRegistrationSubmittedPage } from '@/features/auth/pages/AuthRegistrationSubmittedPage';
import { AuthPasswordChangedPage } from '@/features/auth/pages/AuthPasswordChangedPage';
import { GuestBrowseOffersPage } from '@/features/guest/pages/GuestBrowseOffersPage';
import { GuestOfferDetailPage } from '@/features/guest/pages/GuestOfferDetailPage';
import { StudentDashboardPage } from '@/features/student/pages/StudentDashboardPage';
import { StudentBrowseOffersPage } from '@/features/student/pages/StudentBrowseOffersPage';
import { StudentOfferDetailPage } from '@/features/student/pages/StudentOfferDetailPage';
import { StudentApplicationsPage } from '@/features/student/pages/StudentApplicationsPage';
import { StudentApplicationDetailPage } from '@/features/student/pages/StudentApplicationDetailPage';
import { StudentInternshipPage } from '@/features/student/pages/StudentInternshipPage';
import { StudentSubmissionPage } from '@/features/student/pages/StudentSubmissionPage';
import { StudentEvaluationPage } from '@/features/student/pages/StudentEvaluationPage';
import { CompanyDashboardPage } from '@/features/company/pages/CompanyDashboardPage';
import { CompanyOffersPage } from '@/features/company/pages/CompanyOffersPage';
import { CompanyOfferFormPage } from '@/features/company/pages/CompanyOfferFormPage';
import { CompanyApplicationsPage } from '@/features/company/pages/CompanyApplicationsPage';
import { CompanyCancellationsPage } from '@/features/company/pages/CompanyCancellationsPage';
import { UniversityDashboardPage } from '@/features/university/pages/UniversityDashboardPage';
import { UniversityStudentsPage } from '@/features/university/pages/UniversityStudentsPage';
import { UniversitySupervisorsPage } from '@/features/university/pages/UniversitySupervisorsPage';
import { UniversityApplicationsPage } from '@/features/university/pages/UniversityApplicationsPage';
import { UniversityApplicationDetailPage } from '@/features/university/pages/UniversityApplicationDetailPage';
import { UniversityAssignmentsPage } from '@/features/university/pages/UniversityAssignmentsPage';
import { UniversityInternshipsPage } from '@/features/university/pages/UniversityInternshipsPage';
import { UniversityCancellationsPage } from '@/features/university/pages/UniversityCancellationsPage';
import { SupervisorDashboardPage } from '@/features/supervisor/pages/SupervisorDashboardPage';
import { SupervisorStudentsPage } from '@/features/supervisor/pages/SupervisorStudentsPage';
import { SupervisorStudentProfilePage } from '@/features/supervisor/pages/SupervisorStudentProfilePage';
import { SupervisorInternshipProgressPage } from '@/features/supervisor/pages/SupervisorInternshipProgressPage';
import { SupervisorFinalReviewPage } from '@/features/supervisor/pages/SupervisorFinalReviewPage';
import { PlatformDashboardPage } from '@/features/platform/pages/PlatformDashboardPage';
import { PlatformCompaniesPage } from '@/features/platform/pages/PlatformCompaniesPage';
import { PlatformCompanyVerificationPage } from '@/features/platform/pages/PlatformCompanyVerificationPage';
import { PlatformUniversitiesPage } from '@/features/platform/pages/PlatformUniversitiesPage';
import { PlatformCreateAccountsPage } from '@/features/platform/pages/PlatformCreateAccountsPage';
import { StudentProfilePage } from '@/features/profile/pages/StudentProfilePage';
import { CompanyProfilePage } from '@/features/profile/pages/CompanyProfilePage';
import { UniversityProfilePage } from '@/features/profile/pages/UniversityProfilePage';
import { SupervisorProfilePage } from '@/features/profile/pages/SupervisorProfilePage';
import { PlatformProfilePage } from '@/features/profile/pages/PlatformProfilePage';
import { NotificationsPage } from '@/features/notifications/pages/NotificationsPage';
import type { Role } from '@/lib/roles';

/** One guarded subtree per role: guard → layout → pages. Pages are replaced, this file rarely changes. */
function roleSubtree(role: Role, children: RouteObject[]): RouteObject {
  return {
    element: <RequireRole role={role} />,
    children: [{ element: <AppLayout role={role} />, children }],
  };
}

export const router = createBrowserRouter([
  { path: P.root, element: <RootRedirect /> },

  // Public routes (authenticated users are redirected to their dashboard)
  {
    element: <PublicOnly />,
    children: [
      { path: P.login, element: <AuthLoginPage /> },
      { path: P.registerCompany, element: <AuthCompanyRegisterPage /> },
      { path: P.registerSubmitted, element: <AuthRegistrationSubmittedPage /> },
      { path: P.guestOffers, element: <GuestBrowseOffersPage /> },
      { path: P.guestOfferDetail, element: <GuestOfferDetailPage /> },
    ],
  },
  // Reached right after a password change (tokens already cleared) — no guard
  { path: P.passwordChanged, element: <AuthPasswordChangedPage /> },

  roleSubtree('student', [
    { path: P.student.base, element: <StudentDashboardPage /> },
    { path: P.student.offers, element: <StudentBrowseOffersPage /> },
    { path: P.student.offerDetail, element: <StudentOfferDetailPage /> },
    { path: P.student.applications, element: <StudentApplicationsPage /> },
    { path: P.student.applicationDetail, element: <StudentApplicationDetailPage /> },
    { path: P.student.internship, element: <StudentInternshipPage /> },
    { path: P.student.submission, element: <StudentSubmissionPage /> },
    { path: P.student.evaluation, element: <StudentEvaluationPage /> },
    { path: P.student.notifications, element: <NotificationsPage /> },
    { path: P.student.profile, element: <StudentProfilePage /> },
  ]),

  roleSubtree('company', [
    { path: P.company.base, element: <CompanyDashboardPage /> },
    { path: P.company.profile, element: <CompanyProfilePage /> },
    { path: P.company.offers, element: <CompanyOffersPage /> },
    { path: P.company.offerNew, element: <CompanyOfferFormPage /> },
    { path: P.company.offerEdit, element: <CompanyOfferFormPage /> },
    { path: P.company.applications, element: <CompanyApplicationsPage /> },
    { path: P.company.cancellations, element: <CompanyCancellationsPage /> },
    { path: P.company.notifications, element: <NotificationsPage /> },
  ]),

  roleSubtree('university_admin', [
    { path: P.university.base, element: <UniversityDashboardPage /> },
    { path: P.university.students, element: <UniversityStudentsPage /> },
    { path: P.university.supervisors, element: <UniversitySupervisorsPage /> },
    { path: P.university.applications, element: <UniversityApplicationsPage /> },
    { path: P.university.applicationDetail, element: <UniversityApplicationDetailPage /> },
    { path: P.university.assignments, element: <UniversityAssignmentsPage /> },
    { path: P.university.internships, element: <UniversityInternshipsPage /> },
    { path: P.university.cancellations, element: <UniversityCancellationsPage /> },
    { path: P.university.notifications, element: <NotificationsPage /> },
    { path: P.university.profile, element: <UniversityProfilePage /> },
  ]),

  roleSubtree('supervisor', [
    { path: P.supervisor.base, element: <SupervisorDashboardPage /> },
    { path: P.supervisor.students, element: <SupervisorStudentsPage /> },
    { path: P.supervisor.studentProfile, element: <SupervisorStudentProfilePage /> },
    { path: P.supervisor.internshipProgress, element: <SupervisorInternshipProgressPage /> },
    { path: P.supervisor.finalReview, element: <SupervisorFinalReviewPage /> },
    { path: P.supervisor.notifications, element: <NotificationsPage /> },
    { path: P.supervisor.profile, element: <SupervisorProfilePage /> },
  ]),

  roleSubtree('platform_admin', [
    { path: P.platform.base, element: <PlatformDashboardPage /> },
    { path: P.platform.companies, element: <PlatformCompaniesPage /> },
    { path: P.platform.verification, element: <PlatformCompanyVerificationPage /> },
    { path: P.platform.universities, element: <PlatformUniversitiesPage /> },
    { path: P.platform.createAccounts, element: <PlatformCreateAccountsPage /> },
    { path: P.platform.profile, element: <PlatformProfilePage /> },
  ]),

  { path: '*', element: <NotFoundPage /> },
]);
