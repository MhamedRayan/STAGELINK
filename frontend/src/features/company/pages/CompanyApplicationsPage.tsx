import { useState } from 'react';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  ReasonDialog,
  Select,
  StatusPill,
  useToast,
} from '@/components/ui';
import { normalizeError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { PAGE_SIZE } from '@/lib/pagination';
import { APPLICATION_STATUS } from '@/lib/status';
import type { Application, ApplicationStatus } from '@/api/applications';
import { OfferTitleCell, StudentNameCell } from '../components/NameCells';
import { useCompanyApplications, useCompanyDecision } from '../hooks';
import { S } from '../strings';

/** Company Incoming Requests — Figma 26:697. */
export function CompanyApplicationsPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ApplicationStatus | ''>('SUBMITTED');
  const [rejecting, setRejecting] = useState<Application | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const applications = useCompanyApplications({ page, status: status || undefined });
  const decision = useCompanyDecision();

  const accept = async (application: Application) => {
    try {
      await decision.mutateAsync({ id: application.id, decision: 'ACCEPT' });
      toast.success(S.applications.accepted);
      setActionError(null);
    } catch (error) {
      setActionError(normalizeError(error).message);
    }
  };

  const reject = async (reason: string) => {
    if (!rejecting) return;
    await decision.mutateAsync({ id: rejecting.id, decision: 'REJECT', reason });
    toast.success(S.applications.rejected);
    setRejecting(null);
    setActionError(null);
  };

  return (
    <div className="max-w-content">
      <PageHeader title={S.applications.title} subtitle={S.applications.subtitle} />

      <div className="mt-[24px] flex flex-wrap justify-start sm:justify-end">
        <Select
          aria-label={S.common.filter}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as ApplicationStatus | '');
            setPage(1);
          }}
          className="h-10 w-full max-w-full sm:w-[280px]"
        >
          <option value="SUBMITTED">{S.applications.filterSubmitted}</option>
          <option value="">{S.common.allStatuses}</option>
          <option value="COMPANY_ACCEPTED">{S.applications.filterAccepted}</option>
          <option value="UNIVERSITY_VALIDATED">{S.applications.filterValidated}</option>
          <option value="CONFIRMED">{S.applications.filterConfirmed}</option>
          <option value="COMPANY_REJECTED">{S.applications.filterRejected}</option>
          {(Object.keys(APPLICATION_STATUS) as ApplicationStatus[]).map((value) => (
            <option key={value} value={value}>
              {APPLICATION_STATUS[value].label}
            </option>
          ))}
        </Select>
      </div>

      {actionError && (
        <p role="alert" className="mt-4 rounded-card border border-line bg-mint px-4 py-3 text-[13px] text-pill-danger-fg">
          {actionError}
        </p>
      )}

      <div className="mt-5">
        {applications.isError ? (
          <ErrorState error={applications.error} onRetry={() => void applications.refetch()} />
        ) : applications.isLoading ? (
          <div className="h-[360px] animate-pulse rounded-panel bg-line/60" />
        ) : (
          <div className="overflow-hidden rounded-panel border border-line">
            <DataTable
              columns={[
                {
                  key: 'student',
                  header: S.common.student,
                  render: (row) => <StudentNameCell userId={row.student_user_id} />,
                },
                {
                  key: 'offer',
                  header: S.applications.appliedFor,
                  render: (row) => <OfferTitleCell offerId={row.offer_id} />,
                },
                {
                  key: 'date',
                  header: S.applications.submittedOn,
                  render: (row) => formatDate(row.created_at),
                  width: '140px',
                },
                {
                  key: 'status',
                  header: S.common.status,
                  render: (row) => <StatusPill domain="application" value={row.status} />,
                },
                {
                  key: 'actions',
                  header: S.common.actions,
                  align: 'right',
                  render: (row) =>
                    row.status === 'SUBMITTED' ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => void accept(row)}
                          disabled={decision.isPending}
                        >
                          {S.applications.accept}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setRejecting(row)}
                          disabled={decision.isPending}
                        >
                          {S.applications.refuse}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[12px] text-muted">{S.common.decided}</span>
                    ),
                },
              ]}
              rows={applications.data?.items ?? []}
              getRowKey={(row) => row.id}
              className="rounded-none border-0"
              rowClassName="h-[60px]"
              emptyState={<EmptyState title={S.applications.title} message={S.applications.empty} />}
            />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={applications.data?.total ?? 0}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <ReasonDialog
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={S.applications.rejectTitle}
        label={S.applications.rejectReason}
        description={S.applications.rejectBody}
        confirmLabel={S.applications.rejectConfirm}
        required
        onConfirm={reject}
      />
    </div>
  );
}
