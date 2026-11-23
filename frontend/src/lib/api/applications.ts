import { request, toQuery } from './client';
import type {
  Application,
  ApplicationCreate,
  ApplicationHistory,
  ApplicationList,
  ApplicationStatus,
} from './types';

export interface ApplicationListParams {
  status?: ApplicationStatus;
  offer_id?: string;
  student_user_id?: string;
  company_user_id?: string;
  created_after?: string;
  created_before?: string;
  ordering?: string;
  limit?: number;
  offset?: number;
}

export const applicationsApi = {
  list: (params: ApplicationListParams = {}) =>
    request<ApplicationList>('applications', `/api/applications/${toQuery(params)}`),

  get: (id: string) =>
    request<Application>('applications', `/api/applications/${encodeURIComponent(id)}/`),

  create: (payload: ApplicationCreate) =>
    request<Application>('applications', '/api/applications/', { method: 'POST', body: payload }),

  history: (id: string, params: { limit?: number; offset?: number } = {}) =>
    request<{ results: ApplicationHistory[] }>(
      'applications',
      `/api/applications/${encodeURIComponent(id)}/history/${toQuery(params)}`,
    ),

  companyDecision: (id: string, decision: 'ACCEPT' | 'REJECT', reason?: string) =>
    request<Application>('applications', `/api/applications/${encodeURIComponent(id)}/company-decision/`, {
      method: 'POST',
      body: { decision, ...(reason ? { reason } : {}) },
    }),

  universityDecision: (id: string, decision: 'ACCEPT' | 'REJECT', reason?: string) =>
    request<Application>(
      'applications',
      `/api/applications/${encodeURIComponent(id)}/university-decision/`,
      { method: 'POST', body: { decision, ...(reason ? { reason } : {}) } },
    ),

  studentDecision: (id: string, decision: 'ACCEPT' | 'DECLINE') =>
    request<Application>(
      'applications',
      `/api/applications/${encodeURIComponent(id)}/student-decision/`,
      { method: 'POST', body: { decision } },
    ),

  withdraw: (id: string, reason?: string) =>
    request<Application>('applications', `/api/applications/${encodeURIComponent(id)}/withdraw/`, {
      method: 'POST',
      body: reason ? { reason } : {},
    }),
};
