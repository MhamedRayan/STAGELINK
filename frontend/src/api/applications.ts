import { http } from './http';
import type { components } from './schema/applications';

export type Application = components['schemas']['Application'];
export type ApplicationList = components['schemas']['ApplicationList'];
export type ApplicationStatusHistory = components['schemas']['ApplicationStatusHistory'];
export type ApplicationHistoryList = components['schemas']['ApplicationHistoryList'];
export type ApplicationCreate = components['schemas']['ApplicationCreate'];
export type ApplicationStatus = components['schemas']['ApplicationStatus'];
export type StudentDecisionValue = components['schemas']['StudentDecisionValue'];

export interface ListApplicationsParams {
  limit?: number;
  offset?: number;
  status?: string;
  offer_id?: string;
  company_user_id?: string;
  student_user_id?: string;
  ordering?: string;
}

export function listApplications(params: ListApplicationsParams = {}): Promise<ApplicationList> {
  return http<ApplicationList>('applications', '/api/applications/', { query: { ...params } });
}

export function getApplication(id: string): Promise<Application> {
  return http<Application>('applications', `/api/applications/${id}/`);
}

export function createApplication(payload: ApplicationCreate): Promise<Application> {
  return http<Application>('applications', '/api/applications/', {
    method: 'POST',
    body: payload,
  });
}

export function listApplicationHistory(id: string): Promise<ApplicationHistoryList> {
  return http<ApplicationHistoryList>('applications', `/api/applications/${id}/history/`);
}

export function postStudentDecision(
  id: string,
  decision: StudentDecisionValue,
): Promise<Application> {
  return http<Application>('applications', `/api/applications/${id}/student-decision/`, {
    method: 'POST',
    body: { decision },
  });
}

export function withdrawApplication(id: string, reason?: string): Promise<Application> {
  return http<Application>('applications', `/api/applications/${id}/withdraw/`, {
    method: 'POST',
    body: reason?.trim() ? { reason } : {},
  });
}
