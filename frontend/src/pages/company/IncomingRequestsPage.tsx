import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { applicationsApi } from '@/lib/api/applications';
import type { Application, ApplicationStatus } from '@/lib/api/types';
import { useApplications } from '@/lib/queries';
import { formatDate } from '@/lib/format';
import { applicationStatuses, statusMeta } from '@/lib/status';
import { OfferTitle, StudentName } from '@/components/EntityName';
import { useToast } from '@/components/Toast';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  Pagination,
  Select,
  StatusPill,
  Table,
  Td,
  Textarea,
  Th,
} from '@/components/ui';

const PAGE_SIZE = 20;

export function IncomingRequestsPage() {
  const [status, setStatus] = useState<ApplicationStatus | ''>('SUBMITTED');
  const [page, setPage] = useState(1);
  const [refusing, setRefusing] = useState<Application | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    setPage(1);
  }, [status]);

  const applications = useApplications({
    status: status || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['applications'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const decide = useMutation({
    mutationFn: (input: { application: Application; decision: 'ACCEPT' | 'REJECT'; reason?: string }) =>
      applicationsApi.companyDecision(input.application.id, input.decision, input.reason),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.decision === 'ACCEPT' ? 'Application accepted.' : 'Application refused.',
      );
      setRefusing(null);
      setReason('');
      invalidate();
    },
    onError: (caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not record the decision.');
    },
  });

  return (
    <div>
      <PageHeader
        title="Incoming Requests"
        subtitle="Accept a student to send the application to the university for validation, or refuse with a reason."
      />

      <div className="mb-5 w-72">
        <label htmlFor="request-status" className="sr-only">
          Filter by status
        </label>
        <Select
          id="request-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as ApplicationStatus | '')}
        >
          <option value="">All statuses</option>
          {Object.entries(applicationStatuses).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
      </div>

      {applications.isLoading ? (
        <LoadingBlock label="Loading requests…" />
      ) : applications.isError ? (
        <ErrorState onRetry={() => void applications.refetch()} />
      ) : !applications.data || applications.data.results.length === 0 ? (
        <EmptyState
          title="No requests in this view"
          description="Applications to your offers appear here as soon as students apply."
        />
      ) : (
        <>
          <div className="rounded-card border border-forest-900/5 bg-white p-6 shadow-sm">
            <Table>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Applied for</Th>
                  <Th>Applied on</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {applications.data.results.map((application) => (
                  <tr key={application.id}>
                    <Td className="font-semibold text-forest-900">
                      <StudentName userId={application.student_user_id} />
                    </Td>
                    <Td>
                      <OfferTitle offerId={application.offer_id} />
                    </Td>
                    <Td className="text-muted">{formatDate(application.created_at)}</Td>
                    <Td>
                      <StatusPill meta={statusMeta(applicationStatuses, application.status)} />
                    </Td>
                    <Td>
                      {application.status === 'SUBMITTED' ? (
                        <div className="flex items-center gap-3 text-xs font-semibold">
                          <button
                            type="button"
                            className="text-success underline"
                            onClick={() =>
                              decide.mutate({ application, decision: 'ACCEPT' })
                            }
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="text-danger underline"
                            onClick={() => {
                              setError(null);
                              setRefusing(application);
                            }}
                          >
                            Refuse
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">No action</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={applications.data.pagination.total}
            onChange={setPage}
          />
        </>
      )}

      <Modal
        open={Boolean(refusing)}
        title="Refuse application"
        onClose={() => setRefusing(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRefusing(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={reason.trim().length === 0 || decide.isPending}
              onClick={() =>
                refusing &&
                decide.mutate({ application: refusing, decision: 'REJECT', reason: reason.trim() })
              }
            >
              {decide.isPending ? 'Refusing…' : 'Refuse application'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            The reason is shown to the student and kept in the application history.
          </p>
          <Field label="Reason" htmlFor="refuse-reason" required>
            <Textarea
              id="refuse-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="Explain why the application is not accepted."
            />
          </Field>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
