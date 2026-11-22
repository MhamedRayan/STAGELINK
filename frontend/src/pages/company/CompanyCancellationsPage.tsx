import { useMemo, useState } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { internshipsApi } from '@/lib/api/internships';
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
  PageHeader,
  Select,
  StatusPill,
  Table,
  Td,
  Textarea,
  Th,
} from '@/components/ui';

export function CompanyCancellationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const internships = useInternships({ mine: true, limit: 100 });
  const ongoing = useMemo(
    () =>
      (internships.data?.results ?? []).filter((item) =>
        ['confirmed', 'in_progress'].includes(item.status),
      ),
    [internships.data],
  );

  const [internshipId, setInternshipId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cancellationQueries = useQueries({
    queries: ongoing.map((internship) => ({
      queryKey: ['cancellations', internship.id],
      queryFn: () => internshipsApi.listCancellations(internship.id),
    })),
  });

  const rows = cancellationQueries.flatMap((query, index) =>
    (query.data?.results ?? []).map((request) => ({
      request,
      internship: ongoing[index],
    })),
  );

  const request = useMutation({
    mutationFn: () => internshipsApi.requestCancellation(internshipId, reason.trim()),
    onSuccess: () => {
      toast.success('Cancellation request submitted to the university.');
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['cancellations', internshipId] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not submit the request.');
    },
  });

  if (internships.isLoading) return <LoadingBlock label="Loading internships…" />;
  if (internships.isError) return <ErrorState onRetry={() => void internships.refetch()} />;

  return (
    <div>
      <PageHeader
        title="Cancellations"
        subtitle="Request the university to cancel an ongoing internship, and follow the requests on your placements."
      />

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2">
          <h2 className="text-lg font-semibold text-forest-900">Requests on your internships</h2>
          {cancellationQueries.some((query) => query.isLoading) ? (
            <p className="mt-3 text-sm text-muted">Loading requests…</p>
          ) : rows.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No cancellation request has been made.</p>
          ) : (
            <div className="mt-4">
              <Table>
                <thead>
                  <tr>
                    <Th>Internship</Th>
                    <Th>Requested by</Th>
                    <Th>On</Th>
                    <Th>Status</Th>
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
                        {item.requested_by_role === 'company' ? 'Your company' : 'Student'}
                        {item.requested_by_role === 'student' && (
                          <span className="block text-xs text-muted">
                            {displayUserName(item.requested_by_user_id, 'Student')}
                          </span>
                        )}
                      </Td>
                      <Td className="text-muted">{formatDateTime(item.created_at)}</Td>
                      <Td>
                        <StatusPill meta={statusMeta(cancellationStatuses, item.status)} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>

        <Card muted>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Submit a cancellation request
          </h2>
          {ongoing.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              There is no ongoing internship to cancel.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              <Field label="Internship" htmlFor="cancellation-internship" required>
                <Select
                  id="cancellation-internship"
                  value={internshipId}
                  onChange={(event) => setInternshipId(event.target.value)}
                >
                  <option value="">Select an internship</option>
                  {ongoing.map((internship) => (
                    <option key={internship.id} value={internship.id}>
                      {formatDate(internship.start_date)} — {internship.id.slice(0, 8)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Reason" htmlFor="cancellation-reason" required>
                <Textarea
                  id="cancellation-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  placeholder="Explain why the internship should be cancelled."
                />
              </Field>
              {error && (
                <p role="alert" className="text-xs text-danger">
                  {error}
                </p>
              )}
              <Button
                className="w-full"
                disabled={!internshipId || reason.trim().length === 0 || request.isPending}
                onClick={() => {
                  setError(null);
                  request.mutate();
                }}
              >
                {request.isPending ? 'Submitting…' : 'Submit to university'}
              </Button>
            </div>
          )}
        </Card>
      </div>

      {ongoing.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="No ongoing internships"
            description="Cancellation requests can be made only for confirmed or in-progress internships."
          />
        </div>
      )}
    </div>
  );
}
