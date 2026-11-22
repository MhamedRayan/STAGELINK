import { downloadFile, request, toQuery } from './client';
import type {
  CancellationRequest,
  Internship,
  InternshipEvaluation,
  InternshipPage,
  InternshipStatus,
  InternshipSubmission,
} from './types';

export interface InternshipListParams {
  limit?: number;
  offset?: number;
  status?: InternshipStatus;
  student_user_id?: string;
  company_user_id?: string;
  supervisor_user_id?: string;
  start_date_from?: string;
  start_date_to?: string;
  mine?: boolean;
  ordering?: 'created_at' | '-created_at' | 'start_date' | '-start_date';
}

export const internshipsApi = {
  list: (params: InternshipListParams = {}) =>
    request<InternshipPage>('internships', `/api/internships/${toQuery(params)}`),

  get: (id: string) =>
    request<Internship>('internships', `/api/internships/${encodeURIComponent(id)}/`),

  history: (id: string) =>
    request<{ results: Array<Record<string, unknown>> }>(
      'internships',
      `/api/internships/${encodeURIComponent(id)}/history/`,
    ),

  assignSupervisor: (id: string, supervisorUserId: string, reason?: string) =>
    request<Internship>('internships', `/api/internships/${encodeURIComponent(id)}/assign-supervisor/`, {
      method: 'POST',
      body: { supervisor_user_id: supervisorUserId, ...(reason ? { reason } : {}) },
    }),

  start: (id: string) =>
    request<Internship>('internships', `/api/internships/${encodeURIComponent(id)}/start/`, {
      method: 'POST',
    }),

  complete: (id: string) =>
    request<Internship>('internships', `/api/internships/${encodeURIComponent(id)}/complete/`, {
      method: 'POST',
    }),

  listCancellations: (id: string) =>
    request<{ results: CancellationRequest[] }>(
      'internships',
      `/api/internships/${encodeURIComponent(id)}/cancellation-requests/`,
    ),

  requestCancellation: (id: string, reason: string) =>
    request<CancellationRequest>(
      'internships',
      `/api/internships/${encodeURIComponent(id)}/cancellation-requests/`,
      { method: 'POST', body: { reason } },
    ),

  approveCancellation: (id: string, requestId: string) =>
    request<Internship>(
      'internships',
      `/api/internships/${encodeURIComponent(id)}/cancellation-requests/${encodeURIComponent(requestId)}/approve/`,
      { method: 'POST' },
    ),

  rejectCancellation: (id: string, requestId: string, reason: string) =>
    request<Internship>(
      'internships',
      `/api/internships/${encodeURIComponent(id)}/cancellation-requests/${encodeURIComponent(requestId)}/reject/`,
      { method: 'POST', body: { reason } },
    ),

  listSubmissions: (id: string) =>
    request<{ results: InternshipSubmission[] }>(
      'internships',
      `/api/internships/${encodeURIComponent(id)}/submissions/`,
    ),

  uploadSubmission: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<InternshipSubmission>(
      'internships',
      `/api/internships/${encodeURIComponent(id)}/submissions/`,
      { method: 'POST', body: form },
    );
  },

  downloadSubmission: (id: string, submissionId: string, filename: string) =>
    downloadFile(
      'internships',
      `/api/internships/${encodeURIComponent(id)}/submissions/${encodeURIComponent(submissionId)}/download/`,
      filename,
    ),

  approveSubmission: (id: string, submissionId: string, reason: string) =>
    request<InternshipSubmission>(
      'internships',
      `/api/internships/${encodeURIComponent(id)}/submissions/${encodeURIComponent(submissionId)}/approve/`,
      { method: 'POST', body: { reason } },
    ),

  rejectSubmission: (id: string, submissionId: string, reason: string) =>
    request<InternshipSubmission>(
      'internships',
      `/api/internships/${encodeURIComponent(id)}/submissions/${encodeURIComponent(submissionId)}/reject/`,
      { method: 'POST', body: { reason } },
    ),

  getEvaluation: (id: string) =>
    request<InternshipEvaluation>(
      'internships',
      `/api/internships/${encodeURIComponent(id)}/evaluation/`,
    ),

  createEvaluation: (id: string, grade: string, comment?: string) =>
    request<InternshipEvaluation>(
      'internships',
      `/api/internships/${encodeURIComponent(id)}/evaluation/`,
      { method: 'POST', body: { grade, ...(comment ? { comment } : {}) } },
    ),
};
