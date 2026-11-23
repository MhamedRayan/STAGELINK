import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { internshipsApi } from '@/lib/api/internships';
import { useCancellations, useCompanyProfile, useInternships } from '@/lib/queries';
import { displayUserName } from '@/lib/demo/directory';
import { formatDate, formatDateTime } from '@/lib/format';
import { cancellationStatuses, internshipStatuses, statusMeta } from '@/lib/status';
import { useToast } from '@/components/Toast';
import { OfferTitle } from '@/components/EntityName';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  PageHeader,
  StatusPill,
  Textarea,
} from '@/components/ui';

const STEPS = ['confirmed', 'in_progress', 'completed'];

export function MyInternshipPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const internships = useInternships({ mine: true, limit: 100 });
  const internship = (internships.data?.results ?? []).find((item) =>
    ['confirmed', 'in_progress', 'completed', 'cancelled'].includes(item.status),
  );
  const company = useCompanyProfile(internship?.company_user_id);
  const cancellations = useCancellations(internship?.id);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const request = useMutation({
    mutationFn: () => internshipsApi.requestCancellation(internship!.id, reason.trim()),
    onSuccess: () => {
      toast.success('Cancellation request sent to the university.');
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['cancellations', internship?.id] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not submit the request.');
    },
  });

  if (internships.isLoading) return <LoadingBlock label="Loading internship…" />;
  if (internships.isError) {
    return <ErrorState onRetry={() => void internships.refetch()} />;
  }
  if (!internship) {
    return (
      <div>
        <PageHeader title="My Internship" subtitle="Your current placement and supervision." />
        <EmptyState
          title="No internship yet"
          description="Once an application is confirmed by the company, the university validates it and you accept it, the internship appears here."
          action={
            <Link to="/app/student/applications">
              <Button size="sm">View my applications</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const requests = cancellations.data?.results ?? [];
  const pending = requests.find((item) => item.status === 'pending');
  const stepIndex = STEPS.indexOf(internship.status);

  return (
    <div>
      <PageHeader
        title="My Internship"
        subtitle="Your placement, supervisor and cancellation options."
        action={<StatusPill meta={statusMeta(internshipStatuses, internship.status)} />}
      />

      <Card className="mb-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-xl font-semibold text-forest-900">
              <OfferTitle offerId={internship.offer_id} />
            </h2>
            <p className="mt-1 text-sm text-muted">
              {company.data?.legal_name || 'Company'} • {company.data?.address || 'Location not provided'} •{' '}
              {formatDate(internship.start_date)} → {formatDate(internship.end_date)}
            </p>
          </div>
        </div>

        <div className="mt-7 flex items-center">
          {STEPS.map((step, index) => {
            const reached = stepIndex >= index;
            return (
              <div key={step} className="flex flex-1 items-center last:flex-none">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      reached
                        ? 'grid h-7 w-7 place-items-center rounded-full bg-forest-900 text-xs font-bold text-inverse'
                        : 'grid h-7 w-7 place-items-center rounded-full bg-mint text-xs font-bold text-muted'
                    }
                  >
                    {index + 1}
                  </span>
                  <span
                    className={
                      reached ? 'text-xs font-semibold text-forest-900' : 'text-xs text-muted'
                    }
                  >
                    {statusMeta(internshipStatuses, step).label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <span
                    className={
                      stepIndex > index
                        ? 'mx-3 h-0.5 flex-1 bg-forest-900'
                        : 'mx-3 h-0.5 flex-1 bg-mint'
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-forest-900">Supervisor</h2>
            {internship.supervisor_user_id ? (
              <div className="mt-3">
                <p className="text-sm font-semibold text-forest-900">
                  {displayUserName(internship.supervisor_user_id, 'Supervisor')}
                </p>
                <p className="mt-1 text-xs text-muted">Assigned by the university</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">
                No supervisor has been assigned yet. The university will assign one.
              </p>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-forest-900">Company contact</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted">Company</dt>
                <dd className="font-semibold text-forest-900">
                  {company.data?.legal_name || 'Company'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Address</dt>
                <dd className="text-forest-900/80">{company.data?.address || 'Not provided'}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-forest-900">Cancellation requests</h2>
            {requests.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No cancellation request has been made.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {requests.map((item) => (
                  <li key={item.id} className="rounded-lg border border-forest-900/5 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <StatusPill meta={statusMeta(cancellationStatuses, item.status)} />
                      <span className="text-xs text-muted">{formatDateTime(item.created_at)}</span>
                    </div>
                    <p className="mt-2 text-sm text-forest-900/80">{item.reason}</p>
                    {item.decision_reason && (
                      <p className="mt-1 text-xs text-muted">
                        University: {item.decision_reason}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card muted>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Final work
            </h2>
            <p className="mt-2 text-sm text-muted">
              Upload your final report for your supervisor to review.
            </p>
            <Link to="/app/student/internship/submission" className="mt-4 block">
              <Button variant="secondary" size="sm" className="w-full">
                Open final submission
              </Button>
            </Link>
            <Link to="/app/student/internship/evaluation" className="mt-2 block">
              <Button variant="ghost" size="sm" className="w-full">
                View evaluation
              </Button>
            </Link>
          </Card>

          {pending ? (
            <Card>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Request cancellation
              </h2>
              <p className="mt-3 text-sm text-forest-900">
                A cancellation request is awaiting the university&apos;s decision.
              </p>
            </Card>
          ) : internship.status === 'cancelled' ? (
            <Card>
              <p className="text-sm text-muted">This internship has been cancelled.</p>
            </Card>
          ) : (
            <Card>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Request cancellation
              </h2>
              <div className="mt-3">
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
                  <p role="alert" className="mt-2 text-xs text-danger">
                    {error}
                  </p>
                )}
                <Button
                  size="sm"
                  className="mt-3 w-full"
                  disabled={reason.trim().length === 0 || request.isPending}
                  onClick={() => {
                    setError(null);
                    request.mutate();
                  }}
                >
                  {request.isPending ? 'Submitting…' : 'Submit request'}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
