import { ApiError } from '@/lib/errors';
import { downloadFile, http } from './http';
import type { components } from './schema/internships';

export type Internship = components['schemas']['Internship'];
export type InternshipPage = components['schemas']['InternshipPage'];
export type InternshipAudit = components['schemas']['InternshipAudit'];
export type InternshipSubmission = components['schemas']['InternshipSubmission'];
export type InternshipEvaluation = components['schemas']['InternshipEvaluation'];
export type CancellationRequest = components['schemas']['CancellationRequest'];

export interface ListInternshipsParams {
  mine?: boolean;
  limit?: number;
  offset?: number;
  status?: components['schemas']['InternshipStatus'];
  student_user_id?: string;
  company_user_id?: string;
  supervisor_user_id?: string;
  ordering?: 'created_at' | '-created_at' | 'start_date' | '-start_date';
}

export function listInternships(params: ListInternshipsParams = {}): Promise<InternshipPage> {
  return http<InternshipPage>('internships', '/api/internships/', { query: { ...params } });
}

export function getInternship(id: string): Promise<Internship> {
  return http<Internship>('internships', `/api/internships/${id}/`);
}

export async function getInternshipHistory(id: string): Promise<InternshipAudit[]> {
  const res = await http<{ results: InternshipAudit[] }>(
    'internships',
    `/api/internships/${id}/history/`,
  );
  return res.results;
}

export function approveSubmission(
  internshipId: string,
  submissionId: string,
  reason: string,
): Promise<InternshipSubmission> {
  return http<InternshipSubmission>(
    'internships',
    `/api/internships/${internshipId}/submissions/${submissionId}/approve/`,
    { method: 'POST', body: { reason } },
  );
}

export function rejectSubmission(
  internshipId: string,
  submissionId: string,
  reason: string,
): Promise<InternshipSubmission> {
  return http<InternshipSubmission>(
    'internships',
    `/api/internships/${internshipId}/submissions/${submissionId}/reject/`,
    { method: 'POST', body: { reason } },
  );
}

/** Grade is serialised as a string, e.g. "17.50" (contracts/internships.yaml). */
export function createEvaluation(
  internshipId: string,
  grade: string,
  comment?: string,
): Promise<InternshipEvaluation> {
  return http<InternshipEvaluation>('internships', `/api/internships/${internshipId}/evaluation/`, {
    method: 'POST',
    body: { grade, ...(comment?.trim() ? { comment } : {}) },
  });
}

export function assignSupervisor(
  internshipId: string,
  supervisorUserId: string,
  reason?: string,
): Promise<Internship> {
  return http<Internship>('internships', `/api/internships/${internshipId}/assign-supervisor/`, {
    method: 'POST',
    body: { supervisor_user_id: supervisorUserId, ...(reason?.trim() ? { reason } : {}) },
  });
}

export function startInternship(internshipId: string): Promise<Internship> {
  return http<Internship>('internships', `/api/internships/${internshipId}/start/`, {
    method: 'POST',
  });
}

export function completeInternship(internshipId: string): Promise<Internship> {
  return http<Internship>('internships', `/api/internships/${internshipId}/complete/`, {
    method: 'POST',
  });
}

export function approveCancellationRequest(
  internshipId: string,
  requestId: string,
): Promise<CancellationRequest> {
  return http<CancellationRequest>(
    'internships',
    `/api/internships/${internshipId}/cancellation-requests/${requestId}/approve/`,
    { method: 'POST' },
  );
}

export function rejectCancellationRequest(
  internshipId: string,
  requestId: string,
  reason: string,
): Promise<CancellationRequest> {
  return http<CancellationRequest>(
    'internships',
    `/api/internships/${internshipId}/cancellation-requests/${requestId}/reject/`,
    { method: 'POST', body: { reason } },
  );
}

export async function listSubmissions(internshipId: string): Promise<InternshipSubmission[]> {
  const res = await http<{ results: InternshipSubmission[] }>(
    'internships',
    `/api/internships/${internshipId}/submissions/`,
  );
  return res.results;
}

/** Evaluation of an internship, or null when none has been recorded yet (404). */
export async function getEvaluation(internshipId: string): Promise<InternshipEvaluation | null> {
  try {
    return await http<InternshipEvaluation>('internships', `/api/internships/${internshipId}/evaluation/`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function listCancellationRequests(internshipId: string): Promise<CancellationRequest[]> {
  const res = await http<{ results: CancellationRequest[] }>(
    'internships',
    `/api/internships/${internshipId}/cancellation-requests/`,
  );
  return res.results;
}

export function requestCancellation(
  internshipId: string,
  reason: string,
): Promise<CancellationRequest> {
  return http<CancellationRequest>(
    'internships',
    `/api/internships/${internshipId}/cancellation-requests/`,
    { method: 'POST', body: { reason } },
  );
}

export function uploadSubmission(internshipId: string, file: File): Promise<InternshipSubmission> {
  const formData = new FormData();
  formData.append('file', file);
  return http<InternshipSubmission>(
    'internships',
    `/api/internships/${internshipId}/submissions/`,
    { method: 'POST', formData },
  );
}

export function downloadSubmission(
  internshipId: string,
  submissionId: string,
  fallbackFilename: string,
): Promise<void> {
  return downloadFile(
    'internships',
    `/api/internships/${internshipId}/submissions/${submissionId}/download/`,
    fallbackFilename,
  );
}
