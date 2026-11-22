import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { applicationsApi } from '@/lib/api/applications';
import {
  useApplication,
  useApplicationHistory,
  useCompanyProfile,
  useOffer,
} from '@/lib/queries';
import { displayUserName } from '@/lib/demo/directory';
import { formatDate, formatDateTime } from '@/lib/format';
import { applicationStatuses, statusMeta } from '@/lib/status';
import { useToast } from '@/components/Toast';
import {
  Button,
  Card,
  ErrorState,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  StatusPill,
  Textarea,
} from '@/components/ui';

export function UniversityApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const application = useApplication(applicationId);
  const history = useApplicationHistory(applicationId);
  const offer = useOffer(application.data?.offer_id);
  const company = useCompanyProfile(application.data?.company_user_id);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['application', applicationId] });
    void queryClient.invalidateQueries({ queryKey: ['application-history', applicationId] });
    void queryClient.invalidateQueries({ queryKey: ['applications'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const decide = useMutation({
    mutationFn: (input: { decision: 'ACCEPT' | 'REJECT'; reason?: string }) =>
      applicationsApi.universityDecision(applicationId as string, input.decision, input.reason),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.decision === 'ACCEPT' ? 'Application validated.' : 'Application rejected.',
      );
      setRejecting(false);
      setReason('');
      invalidate();
    },
    onError: (caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not record the decision.');
    },
  });

  if (application.isLoading) return <LoadingBlock label="Loading application…" />;
  if (application.isError || !application.data) {
    return <ErrorState message="This application could not be loaded." onRetry={() => void application.refetch()} />;
  }

  const app = application.data;

  return (
    <div>
      <Link
        to="/app/university/applications"
        className="mb-5 inline-flex text-sm font-semibold text-muted hover:text-forest-900"
      >
        ← Back to applications
      </Link>

      <PageHeader
        title="Application Detail"
        subtitle={`Submitted ${formatDate(app.created_at)}`}
        action={<StatusPill meta={statusMeta(applicationStatuses, app.status)} />}
      />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-forest-900">Student</h2>
            <p className="mt-3 text-sm font-semibold text-forest-900">
              {displayUserName(app.student_user_id, 'Student')}
            </p>
            <p className="mt-1 text-xs text-muted">
              Student ID {app.student_user_id.slice(0, 8)}
            </p>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-forest-900">Offer</h2>
            <p className="mt-3 text-sm font-semibold text-forest-900">
              {offer.data?.title ?? 'Offer'}
            </p>
            <p className="mt-1 text-sm text-muted">
              {company.data?.legal_name || 'Company'} • {offer.data?.location ?? 'Location'}
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted">Period</dt>
                <dd className="font-semibold text-forest-900">
                  {formatDate(app.start_date)} → {formatDate(app.end_date)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Places</dt>
                <dd className="font-semibold text-forest-900">{offer.data?.capacity ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Deadline</dt>
                <dd className="font-semibold text-forest-900">
                  {formatDate(offer.data?.deadline)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-forest-900">Decision history</h2>
            {history.isLoading ? (
              <p className="mt-3 text-sm text-muted">Loading history…</p>
            ) : (history.data?.results.length ?? 0) === 0 ? (
              <p className="mt-3 text-sm text-muted">No history recorded.</p>
            ) : (
              <ol className="mt-4 space-y-4">
                {history.data?.results.map((entry) => (
                  <li key={entry.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sage" />
                    <div>
                      <p className="text-sm font-semibold text-forest-900">
                        {statusMeta(applicationStatuses, entry.to_status).label}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDateTime(entry.created_at)}
                        {entry.actor_role ? ` • ${entry.actor_role}` : ''}
                      </p>
                      {entry.reason && (
                        <p className="mt-1 text-xs text-forest-900/75">{entry.reason}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card muted>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              University decision
            </h2>
            {app.status === 'COMPANY_ACCEPTED' ? (
              <div className="mt-4">
                <p className="text-sm leading-relaxed text-forest-900/80">
                  Validating the application makes it available for the student to accept.
                </p>
                <div className="mt-4 space-y-2">
                  <Button
                    className="w-full"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ decision: 'ACCEPT' })}
                  >
                    Validate application
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      setError(null);
                      setRejecting(true);
                    }}
                  >
                    Reject application
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">
                No university decision is available for the current status.
              </p>
            )}
          </Card>

          {app.company_reason && (
            <Card>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Company reason
              </h2>
              <p className="mt-2 text-sm text-forest-900/80">{app.company_reason}</p>
            </Card>
          )}
          {app.university_reason && (
            <Card>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                University reason
              </h2>
              <p className="mt-2 text-sm text-forest-900/80">{app.university_reason}</p>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={rejecting}
        title="Reject application"
        onClose={() => setRejecting(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={reason.trim().length === 0 || decide.isPending}
              onClick={() => decide.mutate({ decision: 'REJECT', reason: reason.trim() })}
            >
              {decide.isPending ? 'Rejecting…' : 'Reject application'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            The reason is sent to the student and the company and stored in the history.
          </p>
          <Field label="Reason" htmlFor="university-reason" required>
            <Textarea
              id="university-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="Explain why the application cannot be validated."
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
