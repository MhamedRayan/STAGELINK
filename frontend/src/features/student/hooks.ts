import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createApplication,
  getApplication,
  listApplicationHistory,
  listApplications,
  postStudentDecision,
  withdrawApplication,
  type ApplicationStatus,
  type ListApplicationsParams,
  type StudentDecisionValue,
} from '@/api/applications';
import {
  downloadSubmission,
  getEvaluation,
  listCancellationRequests,
  listInternships,
  listSubmissions,
  requestCancellation,
  uploadSubmission,
} from '@/api/internships';
import { normalizeOffsetPage, pageToOffset } from '@/lib/pagination';
import { studentKeys } from './keys';

export interface StudentApplicationParams {
  page: number;
  status?: ApplicationStatus | '';
}

function useInvalidateStudent() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: studentKeys.all });
  };
}

export function useStudentApplications({ page, status }: StudentApplicationParams) {
  const params: ListApplicationsParams = {
    ...pageToOffset(page),
    ...(status ? { status } : {}),
    ordering: '-created_at',
  };
  return useQuery({
    queryKey: studentKeys.applications(params),
    queryFn: async () => normalizeOffsetPage(await listApplications(params)),
    placeholderData: keepPreviousData,
  });
}

export function useApplication(id: string | undefined) {
  return useQuery({
    queryKey: studentKeys.application(id ?? ''),
    queryFn: () => getApplication(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useApplicationHistory(id: string | undefined) {
  return useQuery({
    queryKey: studentKeys.history(id ?? ''),
    queryFn: async () => (await listApplicationHistory(id as string)).results,
    enabled: Boolean(id),
    retry: false,
  });
}

/** Does the student already have an application for this offer? (Offer Details CTA). */
export function useOfferApplication(offerId: string | undefined) {
  return useQuery({
    queryKey: studentKeys.offerApplication(offerId ?? ''),
    queryFn: async () => {
      const page = normalizeOffsetPage(await listApplications({ offer_id: offerId as string, limit: 1 }));
      return page.items[0] ?? null;
    },
    enabled: Boolean(offerId),
    retry: false,
  });
}

export function useMyInternships() {
  return useQuery({
    queryKey: studentKeys.internships,
    queryFn: async () =>
      normalizeOffsetPage(await listInternships({ mine: true, limit: 20 })),
  });
}

export function useCancellationRequests(internshipId: string | undefined) {
  return useQuery({
    queryKey: studentKeys.cancellations(internshipId ?? ''),
    queryFn: () => listCancellationRequests(internshipId as string),
    enabled: Boolean(internshipId),
    retry: false,
  });
}

export function useSubmissions(internshipId: string | undefined) {
  return useQuery({
    queryKey: studentKeys.submissions(internshipId ?? ''),
    queryFn: () => listSubmissions(internshipId as string),
    enabled: Boolean(internshipId),
  });
}

export function useEvaluation(internshipId: string | undefined) {
  return useQuery({
    queryKey: studentKeys.evaluation(internshipId ?? ''),
    queryFn: () => getEvaluation(internshipId as string),
    enabled: Boolean(internshipId),
    retry: false,
  });
}

export function useSubmitApplication() {
  const invalidate = useInvalidateStudent();
  return useMutation({
    mutationFn: createApplication,
    onSuccess: invalidate,
  });
}

export function useStudentDecision() {
  const invalidate = useInvalidateStudent();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: StudentDecisionValue }) =>
      postStudentDecision(id, decision),
    onSuccess: invalidate,
  });
}

export function useWithdrawApplication() {
  const invalidate = useInvalidateStudent();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => withdrawApplication(id, reason),
    onSuccess: invalidate,
  });
}

export function useRequestCancellation() {
  const invalidate = useInvalidateStudent();
  return useMutation({
    mutationFn: ({ internshipId, reason }: { internshipId: string; reason: string }) =>
      requestCancellation(internshipId, reason),
    onSuccess: invalidate,
  });
}

export function useUploadSubmission() {
  const invalidate = useInvalidateStudent();
  return useMutation({
    mutationFn: ({ internshipId, file }: { internshipId: string; file: File }) =>
      uploadSubmission(internshipId, file),
    onSuccess: invalidate,
  });
}

export function useDownloadSubmission() {
  return useMutation({
    mutationFn: ({
      internshipId,
      submissionId,
      filename,
    }: {
      internshipId: string;
      submissionId: string;
      filename: string;
    }) => downloadSubmission(internshipId, submissionId, filename),
  });
}
