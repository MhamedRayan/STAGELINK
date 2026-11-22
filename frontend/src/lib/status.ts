// One map per service vocabulary (design-plan §4). Never compare strings across services.
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type StatusDomain =
  | 'application'
  | 'offer'
  | 'internship'
  | 'submission'
  | 'cancellation'
  | 'verification';

export interface StatusInfo {
  label: string;
  tone: Tone;
}

export const APPLICATION_STATUS: Record<string, StatusInfo> = {
  SUBMITTED: { label: 'Submitted', tone: 'neutral' },
  COMPANY_ACCEPTED: { label: 'Pending university validation', tone: 'warning' },
  UNIVERSITY_VALIDATED: { label: 'Awaiting student decision', tone: 'info' },
  STUDENT_ACCEPTED: { label: 'Student accepted', tone: 'info' },
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  COMPANY_REJECTED: { label: 'Rejected by company', tone: 'danger' },
  UNIVERSITY_REJECTED: { label: 'Rejected by university', tone: 'danger' },
  STUDENT_DECLINED: { label: 'Declined by student', tone: 'neutral' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'neutral' },
};

export const APPLICATION_TERMINAL = [
  'CONFIRMED',
  'COMPANY_REJECTED',
  'UNIVERSITY_REJECTED',
  'STUDENT_DECLINED',
  'WITHDRAWN',
] as const;

export const OFFER_STATUS: Record<string, StatusInfo> = {
  draft: { label: 'Draft', tone: 'neutral' },
  published: { label: 'Open', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
};

export const INTERNSHIP_STATUS: Record<string, StatusInfo> = {
  confirmed: { label: 'Confirmed', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'success' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

export const SUBMISSION_STATUS: Record<string, StatusInfo> = {
  SUBMITTED: { label: 'Under review', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Resubmission required', tone: 'danger' },
};

export const CANCELLATION_STATUS: Record<string, StatusInfo> = {
  pending: { label: 'Pending approval', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

export const VERIFICATION_STATUS: Record<string, StatusInfo> = {
  pending: { label: 'Pending verification', tone: 'warning' },
  active: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

const MAPS: Record<StatusDomain, Record<string, StatusInfo>> = {
  application: APPLICATION_STATUS,
  offer: OFFER_STATUS,
  internship: INTERNSHIP_STATUS,
  submission: SUBMISSION_STATUS,
  cancellation: CANCELLATION_STATUS,
  verification: VERIFICATION_STATUS,
};

/** Unknown values degrade to a neutral pill showing the raw value instead of crashing. */
export function getStatusInfo(domain: StatusDomain, value: string): StatusInfo {
  return MAPS[domain][value] ?? { label: value, tone: 'neutral' };
}
