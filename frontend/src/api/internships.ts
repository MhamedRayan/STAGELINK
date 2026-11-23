import { ApiError } from '@/lib/errors';
import { http } from './http';
import type { components } from './schema/internships';

export type Internship = components['schemas']['Internship'];
export type InternshipPage = components['schemas']['InternshipPage'];
export type InternshipSubmission = components['schemas']['InternshipSubmission'];
export type InternshipEvaluation = components['schemas']['InternshipEvaluation'];

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
