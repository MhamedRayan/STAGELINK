import type { Role } from '@/lib/roles';
import { ROUTES } from './routes';

export interface NavItem {
  label: string;
  to: string;
  /** Match the path exactly (dashboards, so they don't stay active on child routes). */
  end?: boolean;
}

/** Final sidebar navigation per role (design-plan §2) — labels are normalised, not per-frame. */
export const NAV_ITEMS: Record<Role, NavItem[]> = {
  student: [
    { label: 'Dashboard', to: ROUTES.student.dashboard, end: true },
    { label: 'Browse Offers', to: ROUTES.student.offers },
    { label: 'My Applications', to: ROUTES.student.applications },
    { label: 'My Internship', to: ROUTES.student.internship, end: true },
    { label: 'Final Submission', to: ROUTES.student.submission },
    { label: 'Notifications', to: ROUTES.student.notifications },
    { label: 'Profile', to: ROUTES.student.profile },
  ],
  company: [
    { label: 'Dashboard', to: ROUTES.company.dashboard, end: true },
    { label: 'Company Profile', to: ROUTES.company.profile },
    { label: 'My Offers', to: ROUTES.company.offers, end: true },
    { label: 'Post Internship', to: ROUTES.company.offerNew },
    { label: 'Incoming Requests', to: ROUTES.company.applications },
    { label: 'Cancellations', to: ROUTES.company.cancellations },
    { label: 'Notifications', to: ROUTES.company.notifications },
  ],
  university_admin: [
    { label: 'Dashboard', to: ROUTES.university.dashboard, end: true },
    { label: 'Students', to: ROUTES.university.students },
    { label: 'Supervisors', to: ROUTES.university.supervisors },
    { label: 'Applications', to: ROUTES.university.applications },
    { label: 'Internships', to: ROUTES.university.internships },
    { label: 'Cancellations', to: ROUTES.university.cancellations },
    { label: 'Notifications', to: ROUTES.university.notifications },
    { label: 'Profile', to: ROUTES.university.profile },
  ],
  supervisor: [
    { label: 'Dashboard', to: ROUTES.supervisor.dashboard, end: true },
    { label: 'My Students', to: ROUTES.supervisor.students },
    { label: 'Final Reviews', to: ROUTES.supervisor.students },
    { label: 'Notifications', to: ROUTES.supervisor.notifications },
    { label: 'Profile', to: ROUTES.supervisor.profile },
  ],
  platform_admin: [
    { label: 'Dashboard', to: ROUTES.platform.dashboard, end: true },
    { label: 'Company Verification', to: ROUTES.platform.companies },
    { label: 'Universities', to: ROUTES.platform.universities },
    { label: 'Create Accounts', to: ROUTES.platform.createAccounts },
    { label: 'Profile', to: ROUTES.platform.profile },
  ],
};
