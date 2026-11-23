import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/useAuth';
import { RequireAuth, RequireRole, RequireGuest } from './auth/guards';
import { AppShell } from './components/layout/AppShell';

// Public & Auth Pages
import { Login } from './pages/auth/Login';
import { CompanyRegister } from './pages/auth/CompanyRegister';
import { RegistrationSubmitted } from './pages/auth/RegistrationSubmitted';
import { PasswordChanged } from './pages/auth/PasswordChanged';
import { BrowseOffers } from './pages/guest/BrowseOffers';
import { OfferDetails } from './pages/guest/OfferDetails';

// Student Pages
import { StudentDashboard } from './pages/student/Dashboard';
import { StudentBrowseOffers } from './pages/student/BrowseOffers';
import { StudentOfferDetails } from './pages/student/OfferDetails';
import { StudentMyApplications } from './pages/student/MyApplications';
import { StudentApplicationDetail } from './pages/student/ApplicationDetail';
import { StudentMyInternship } from './pages/student/MyInternship';
import { StudentFinalSubmission } from './pages/student/FinalSubmission';
import { StudentEvaluation } from './pages/student/Evaluation';
import { StudentNotifications } from './pages/student/Notifications';
import { StudentProfile } from './pages/student/Profile';

// Company Pages
import { CompanyDashboard } from './pages/company/Dashboard';
import { CompanyProfile } from './pages/company/CompanyProfile';
import { CompanyMyOffers } from './pages/company/MyOffers';
import { CompanyPostInternship } from './pages/company/PostInternship';
import { CompanyIncomingRequests } from './pages/company/IncomingRequests';
import { CompanyCancellations } from './pages/company/Cancellations';
import { CompanyNotifications } from './pages/company/Notifications';

// University Admin Pages
import { UniversityDashboard } from './pages/university/Dashboard';
import { UniversityStudents } from './pages/university/Students';
import { UniversitySupervisors } from './pages/university/Supervisors';
import { UniversityApplications } from './pages/university/Applications';
import { UniversityApplicationDetail } from './pages/university/ApplicationDetail';
import { UniversitySupervisorAssignment } from './pages/university/SupervisorAssignment';
import { UniversityInternships } from './pages/university/Internships';
import { UniversityCancellations } from './pages/university/Cancellations';
import { UniversityProfile } from './pages/university/Profile';
import { UniversityNotifications } from './pages/university/Notifications';

// Supervisor Pages
import { SupervisorDashboard } from './pages/supervisor/Dashboard';
import { SupervisorMyStudents } from './pages/supervisor/MyStudents';
import { SupervisorStudentProfile } from './pages/supervisor/StudentProfile';
import { SupervisorInternshipProgress } from './pages/supervisor/InternshipProgress';
import { SupervisorFinalReview } from './pages/supervisor/FinalReview';
import { SupervisorProfile } from './pages/supervisor/Profile';
import { SupervisorNotifications } from './pages/supervisor/Notifications';

// Platform Admin Pages
import { PlatformDashboard } from './pages/platform/Dashboard';
import { PlatformCompanyVerification } from './pages/platform/CompanyVerification';
import { PlatformCreateAccounts } from './pages/platform/CreateAccounts';
import { PlatformProfile } from './pages/platform/Profile';

export const App: React.FC = () => {
  const { user, isAuthenticated, getDashboardRoute } = useAuth();

  return (
    <Routes>
      {/* Root redirect */}
      <Route
        path="/"
        element={
          isAuthenticated && user ? (
            <Navigate to={getDashboardRoute(user.role)} replace />
          ) : (
            <Navigate to="/offers" replace />
          )
        }
      />

      {/* Guest & Auth routes */}
      <Route element={<RequireGuest />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register/company" element={<CompanyRegister />} />
      </Route>

      <Route path="/register/submitted" element={<RegistrationSubmitted />} />
      <Route path="/password-changed" element={<PasswordChanged />} />
      <Route path="/offers" element={<BrowseOffers />} />
      <Route path="/offers/:offerId" element={<OfferDetails />} />

      {/* Protected App Routes */}
      <Route path="/app" element={<RequireAuth />}>
        <Route element={<AppShell />}>
          {/* Student Lane */}
          <Route element={<RequireRole allowedRoles={['student']} />}>
            <Route path="student" element={<StudentDashboard />} />
            <Route path="student/offers" element={<StudentBrowseOffers />} />
            <Route path="student/offers/:offerId" element={<StudentOfferDetails />} />
            <Route path="student/applications" element={<StudentMyApplications />} />
            <Route path="student/applications/:applicationId" element={<StudentApplicationDetail />} />
            <Route path="student/internship" element={<StudentMyInternship />} />
            <Route path="student/internship/submission" element={<StudentFinalSubmission />} />
            <Route path="student/internship/evaluation" element={<StudentEvaluation />} />
            <Route path="student/notifications" element={<StudentNotifications />} />
            <Route path="student/profile" element={<StudentProfile />} />
          </Route>

          {/* Company */}
          <Route element={<RequireRole allowedRoles={['company']} />}>
            <Route path="company" element={<CompanyDashboard />} />
            <Route path="company/profile" element={<CompanyProfile />} />
            <Route path="company/offers" element={<CompanyMyOffers />} />
            <Route path="company/offers/new" element={<CompanyPostInternship />} />
            <Route path="company/offers/:offerId/edit" element={<CompanyPostInternship />} />
            <Route path="company/applications" element={<CompanyIncomingRequests />} />
            <Route path="company/cancellations" element={<CompanyCancellations />} />
            <Route path="company/notifications" element={<CompanyNotifications />} />
          </Route>

          {/* University Admin */}
          <Route element={<RequireRole allowedRoles={['university_admin']} />}>
            <Route path="university" element={<UniversityDashboard />} />
            <Route path="university/students" element={<UniversityStudents />} />
            <Route path="university/supervisors" element={<UniversitySupervisors />} />
            <Route path="university/applications" element={<UniversityApplications />} />
            <Route path="university/applications/:applicationId" element={<UniversityApplicationDetail />} />
            <Route path="university/assignments" element={<UniversitySupervisorAssignment />} />
            <Route path="university/internships" element={<UniversityInternships />} />
            <Route path="university/cancellations" element={<UniversityCancellations />} />
            <Route path="university/profile" element={<UniversityProfile />} />
            <Route path="university/notifications" element={<UniversityNotifications />} />
          </Route>

          {/* Supervisor */}
          <Route element={<RequireRole allowedRoles={['supervisor']} />}>
            <Route path="supervisor" element={<SupervisorDashboard />} />
            <Route path="supervisor/students" element={<SupervisorMyStudents />} />
            <Route path="supervisor/students/:internshipId" element={<SupervisorStudentProfile />} />
            <Route path="supervisor/internships/:internshipId" element={<SupervisorInternshipProgress />} />
            <Route path="supervisor/reviews/:internshipId" element={<SupervisorFinalReview />} />
            <Route path="supervisor/reviews" element={<SupervisorFinalReview />} />
            <Route path="supervisor/notifications" element={<SupervisorNotifications />} />
            <Route path="supervisor/profile" element={<SupervisorProfile />} />
          </Route>

          {/* Platform Admin */}
          <Route element={<RequireRole allowedRoles={['platform_admin']} />}>
            <Route path="platform" element={<PlatformDashboard />} />
            <Route path="platform/companies" element={<PlatformCompanyVerification />} />
            <Route path="platform/accounts/new" element={<PlatformCreateAccounts />} />
            <Route path="platform/profile" element={<PlatformProfile />} />
          </Route>
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
