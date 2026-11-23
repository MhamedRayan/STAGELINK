import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { applicationsApi } from '@/lib/api/applications';
import { useApplication, useApplicationHistory, useCompanyProfile } from '@/lib/queries';
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

const WITHDRAWABLE = ['SUBMITTED', 'COMPANY_ACCEPTED', 'UNIVERSITY_VALIDATED', 'STUDENT_ACCEPTED'];

export function ApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const application = useApplication(applicationId);
  const history = useApplicationHistory(applicationId);
  const company = useCompanyProfile(application.data?.company_user_id);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['application', applicationId] });
    void queryClient.invalidateQueries({ queryKey: ['application-history', applicationId] });
    void queryClient.invalidateQueries({ queryKey: ['applications'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const decide = useMutation({
    mutationFn: (decision: 'ACCEPT' | 'DECLINE') =>
      applicationsApi.studentDecision(applicationId as string, decision),
    onSuccess: () => {
      toast.success('Your decision was recorded.');
      invalidate();
    },
    onError: (caught) => {
      toast.error(caught instanceof Error ? caught.message : 'Could not record the decision.');
    },
  });

  const withdraw = useMutation({
    mutationFn: () =>
      applicationsApi.withdraw(applicationId as string, reason.trim() || undefined),
    onSuccess: () => {
      toast.success('Application withdrawn.');
      setWithdrawOpen(false);
      setReason('');
      invalidate();
    },
    onError: (caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not withdraw the application.');
    },
  });

  if (application.isLoading) return <LoadingBlock label="Loading application…" />;
  if (application.isError || !application.data) {
    return <ErrorState message="This application could not be loaded." onRetry={() => void application.refetch()} />;
  }

  const app = application.data;
  const status = statusMeta(applicationStatuses, app.status);
  const canWithdraw = WITHDRAWABLE.includes(app.status);

  return (
    <div>
      <Link
        to="/app/student/applications"
        className="mb-5 inline-flex text-sm font-semibold text-muted hover:text-forest-900"
      >
        ← Back to my applications
      </Link>

      <PageHeader
        title="Application Detail"
        subtitle={`${company.data?.legal_name || 'Company'} • applied ${formatDate(app.created_at)}`}
        action={<StatusPill meta={status} />}
      />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-forest-900">Decision</h2>
            <div className="mt-4">
              {app.status === 'UNIVERSITY_VALIDATED' && (
                <div>
                  <p className="text-sm leading-relaxed text-muted">
                    The university has validated this application. Accept to confirm the
                    internship, or decline to release the place.
                  </p>
                  <div className="mt-5 flex gap-3">
                    <Button
                      onClick={() => decide.mutate('ACCEPT')}
                      disabled={decide.isPending}
                    >
                      Accept internship
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => decide.mutate('DECLINE')}
                      disabled={decide.isPending}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              )}

              {app.status === 'COMPANY_ACCEPTED' && (
                <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-warning">
                  Available after university validation. The university is reviewing the
                  company&apos;s decision.
                </p>
              )}

              {app.status === 'SUBMITTED' && (
                <p className="rounded-lg bg-mint px-4 py-3 text-sm text-forest-900">
                  Your application is with the company. You will be notified when they respond.
                </p>
              )}

              {app.status === 'COMPANY_REJECTED' && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-danger">
                  <p className="font-semibold">This application is closed.</p>
                  {app.company_reason && <p className="mt-1">Reason: {app.company_reason}</p>}
                </div>
              )}

              {app.status === 'UNIVERSITY_REJECTED' && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-danger">
                  <p className="font-semibold">Rejected by the university.</p>
                  {app.university_reason && <p className="mt-1">Reason: {app.university_reason}</p>}
                </div>
              )}

              {app.status === 'CONFIRMED' && (
                <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-success">
                  <p className="font-semibold">Your internship is confirmed.</p>
                  <Link to="/app/student/internship" className="mt-2 inline-block underline">
                    Open my internship
                  </Link>
                </div>
              )}

              {app.status === 'STUDENT_DECLINED' && (
                <p className="rounded-lg bg-mint px-4 py-3 text-sm text-forest-900">
                  You declined this internship. The place was released.
                </p>
              )}

              {app.status === 'WITHDRAWN' && (
                <div className="rounded-lg bg-mint px-4 py-3 text-sm text-forest-900">
                  <p className="font-semibold">Application withdrawn.</p>
                  {app.withdrawal_reason && <p className="mt-1">Reason: {app.withdrawal_reason}</p>}
                </div>
              )}

              {canWithdraw && (
                <div className="mt-5 border-t border-forest-900/5 pt-4">
                  <Button variant="secondary" size="sm" onClick={() => setWithdrawOpen(true)}>
                    Withdraw application
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-forest-900">Status history</h2>
            {history.isLoading ? (
              <p className="mt-3 text-sm text-muted">Loading history…</p>
            ) : (history.data?.results.length ?? 0) === 0 ? (
              <p className="mt-3 text-sm text-muted">No history recorded yet.</p>
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
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Period</h2>
            <p className="mt-3 text-sm font-semibold text-forest-900">
              {formatDate(app.start_date)} → {formatDate(app.end_date)}
            </p>
          </Card>
          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Company</h2>
            <p className="mt-3 text-sm font-semibold text-forest-900">
              {company.data?.legal_name || 'Company'}
            </p>
            <p className="mt-1 text-xs text-muted">{company.data?.address || 'Address not provided'}</p>
          </Card>
        </div>
      </div>

      <Modal
        open={withdrawOpen}
        title="Withdraw application"
        onClose={() => setWithdrawOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setWithdrawOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => withdraw.mutate()} disabled={withdraw.isPending}>
              {withdraw.isPending ? 'Withdrawing…' : 'Withdraw'}
            </Button>
          </>
        }
      >
        <Field label="Reason (optional)" htmlFor="withdraw-reason">
          <Textarea
            id="withdraw-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Tell the company and university why you are withdrawing."
            maxLength={500}
          />
        </Field>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </Modal>
    </div>
  );
}
