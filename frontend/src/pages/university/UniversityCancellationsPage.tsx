import { useMemo, useState } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { internshipsApi } from '@/lib/api/internships';
import type { CancellationRequest } from '@/lib/api/types';
import { useInternships } from '@/lib/queries';
import { displayUserName } from '@/lib/demo/directory';
import { formatDate, formatDateTime } from '@/lib/format';
import { cancellationStatuses, statusMeta } from '@/lib/status';
import { OfferTitle } from '@/components/EntityName';
import { useToast } from '@/components/Toast';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  StatusPill,
  Table,
  Td,
  Textarea,
  Th,
} from '@/components/ui';

export function UniversityCancellationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const internships = useInternships({ limit: 100 });
  const internshipRows = useMemo(
    () => internships.data?.results ?? [],
    [internships.data],
  );

  const cancellationQueries = useQueries({
    queries: internshipRows.map((internship) => ({
      queryKey: ['cancellations', internship.id],
      queryFn: () => internshipsApi.listCancellations(internship.id),
    })),
  });

  const rows = cancellationQueries.flatMap((query, index) =>
    (query.data?.results ?? []).map((request) => ({
      request,
      internship: internshipRows[index],
    })),
  );

  const [selected, setSelected] = useState<{ request: CancellationRequest; internshipId: string } | null>(
    null,
  );
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['cancellations'] });
    void queryClient.invalidateQueries({ queryKey: ['internships'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const decide = useMutation({
    mutationFn: (input: { kind: 'approve' | 'reject'; reason?: string }) => {
      if (!selected) throw new Error('No request selected');
      return input.kind === 'approve'
        ? internshipsApi.approveCancellation(selected.internshipId, selected.request.id)
        : internshipsApi.rejectCancellation(
            selected.internshipId,
            selected.request.id,
            input.reason ?? '',
          );
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.kind === 'approve' ? 'Cancellation approved.' : 'Cancellation rejected.',
      );
      setRejecting(false);
      setSelected(null);
      setReason('');
      invalidate();
    },
    onError: (caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not record the decision.');
    },
  });

  if (internships.isLoading) return <LoadingBlock label="Loading cancellation requests…" />;
  if (internships.isError) return <ErrorState onRetry={() => void internships.refetch()} />;

  return (
    <div>
      <PageHeader
        title="Cancellation Requests"
        subtitle="Review cancellation requests submitted by students and companies."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No cancellation requests"
          description="Requests submitted for internships appear here."
        />
      ) : (
        <div className="grid grid-cols-3 gap-6">
          <Card className="col-span-2">
            <Table>
              <thead>
                <tr>
                  <Th>Internship</Th>
                  <Th>Requested by</Th>
                  <Th>On</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ request: item, internship }) => (
                  <tr key={item.id}>
                    <Td className="font-semibold text-forest-900">
                      <OfferTitle offerId={internship.offer_id} />
                      <span className="mt-0.5 block text-xs font-normal text-muted">
                        {formatDate(internship.start_date)} → {formatDate(internship.end_date)}
                      </span>
                    </Td>
                    <Td>
                      {item.requested_by_role === 'student' ? 'Student' : 'Company'}
                      <span className="block text-xs text-muted">
                        {displayUserName(
                          item.requested_by_user_id,
                          item.requested_by_role === 'student' ? 'Student' : 'Company',
                        )}
                      </span>
                    </Td>
                    <Td className="text-muted">{formatDateTime(item.created_at)}</Td>
                    <Td>
                      <StatusPill meta={statusMeta(cancellationStatuses, item.status)} />
                    </Td>
                    <Td className="text-right">
                      <button
                        type="button"
                        className="text-xs font-semibold text-forest-900 underline"
                        onClick={() => {
                          setError(null);
                          setSelected({ request: item, internshipId: internship.id });
                        }}
                      >
                        Review
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card muted>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Request details
            </h2>
            {selected ? (
              <div className="mt-3">
                <StatusPill meta={statusMeta(cancellationStatuses, selected.request.status)} />
                <p className="mt-3 text-sm text-forest-900/80">{selected.request.reason}</p>
                {selected.request.decision_reason && (
                  <p className="mt-2 text-xs text-muted">
                    Decision: {selected.request.decision_reason}
                  </p>
                )}
                {selected.request.status === 'pending' && (
                  <div className="mt-4 space-y-2">
                    <Button
                      className="w-full"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ kind: 'approve' })}
                    >
                      Approve cancellation
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        setError(null);
                        setRejecting(true);
                      }}
                    >
                      Reject request
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">
                Select a request to read its reason and decide.
              </p>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={rejecting}
        title="Reject cancellation request"
        onClose={() => setRejecting(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={reason.trim().length === 0 || decide.isPending}
              onClick={() => decide.mutate({ kind: 'reject', reason: reason.trim() })}
            >
              {decide.isPending ? 'Rejecting…' : 'Reject request'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Reason" htmlFor="cancel-reject-reason" required>
            <Textarea
              id="cancel-reject-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="Explain why the internship cannot be cancelled."
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
