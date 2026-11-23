import { ApiError } from '@/lib/errors';
import { downloadFile, http } from './http';
import type { components } from './schema/internships';

export type Internship = components['schemas']['Internship'];
export type InternshipPage = components['schemas']['InternshipPage'];
export type InternshipSubmission = components['schemas']['InternshipSubmission'];
export type InternshipEvaluation = components['schemas']['InternshipEvaluation'];
export type CancellationRequest = components['schemas']['CancellationRequest'];

export function listInternships(params: {
  mine?: boolean;
  limit?: number;
  offset?: number;
}): Promise<InternshipPage> {
  return http<InternshipPage>('internships', '/api/internships/', { query: { ...params } });
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
