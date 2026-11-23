import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface StatusConfig {
  label: string;
  tone: Tone;
}

const statusMap: Record<string, StatusConfig> = {
  // Application
  SUBMITTED: { label: 'Submitted', tone: 'neutral' },
  COMPANY_ACCEPTED: { label: 'Pending Uni Validation', tone: 'warning' },
  UNIVERSITY_VALIDATED: { label: 'Awaiting Student Decision', tone: 'info' },
  STUDENT_ACCEPTED: { label: 'Student Accepted', tone: 'info' },
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  COMPANY_REJECTED: { label: 'Rejected by Company', tone: 'danger' },
  UNIVERSITY_REJECTED: { label: 'Rejected by University', tone: 'danger' },
  STUDENT_DECLINED: { label: 'Declined by Student', tone: 'neutral' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'neutral' },

  // Offer
  draft: { label: 'Draft', tone: 'neutral' },
  published: { label: 'Open', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },

  // Internship
  confirmed: { label: 'Confirmed', tone: 'info' },
  in_progress: { label: 'In Progress', tone: 'success' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },

  // Submission
  SUBMISSION_SUBMITTED: { label: 'Under Review', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Resubmission Required', tone: 'danger' },

  // Cancellation request
  pending: { label: 'Pending Approval', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },

  // Company verification
  verification_pending: { label: 'Pending Verification', tone: 'warning' },
  verification_active: { label: 'Verified', tone: 'success' },
  verification_rejected: { label: 'Rejected', tone: 'danger' },
};

export interface StatusPillProps {
  status: string;
  type?: 'application' | 'offer' | 'internship' | 'submission' | 'cancellation' | 'verification';
  overrideLabel?: string;
  overrideTone?: Tone;
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  type,
  overrideLabel,
  overrideTone,
  className,
}) => {
  let key = status;
  if (type === 'submission' && status === 'SUBMITTED') {
    key = 'SUBMISSION_SUBMITTED';
  } else if (type === 'verification') {
    key = `verification_${status.toLowerCase()}`;
  }

  const config = statusMap[key] || {
    label: status.replace(/_/g, ' '),
    tone: 'neutral' as Tone,
  };

  const label = overrideLabel || config.label;
  const tone = overrideTone || config.tone;

  const toneStyles: Record<Tone, string> = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize',
          toneStyles[tone],
          className
        )
      )}
    >
      {label}
    </span>
  );
};
