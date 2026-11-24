import { useState } from 'react';
import {
  Button,
  ErrorState,
  PageHeader,
  ReasonDialog,
  Select,
  Skeleton,
  StatusPill,
  useToast,
} from '@/components/ui';
import type { AdminCompanySummary, VerificationStatus } from '@/api/identity';
import { normalizeError } from '@/lib/errors';
import { pageCount, PAGE_SIZE } from '@/lib/pagination';
import { getStatusInfo } from '@/lib/status';
import { CompanyLocation } from '../components/CompanyLocation';
import { useAdminCompanies, useCompanyLocation, useRejectCompany, useVerifyCompany } from '../hooks';
import { S } from '../strings';

const FILTERS: VerificationStatus[] = ['pending', 'active', 'rejected'];

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] leading-[15px] text-muted">{label}</p>
      <p className="mt-0.5 text-table-body leading-[17px] text-forest-900">{value}</p>
    </div>
  );
}

interface CompanyDetailsProps {
  company: AdminCompanySummary;
  isVerifying: boolean;
  onVerify(): void;
  onReject(): void;
}

/** Right-hand panel of 24:285. The public profile exposes address but not phone (contract). */
function CompanyDetails({ company, isVerifying, onVerify, onReject }: CompanyDetailsProps) {
  const location = useCompanyLocation(company);
  return (
    <aside className="flex min-h-[610px] flex-col rounded-panel bg-mint p-5">
      <h2 className="text-[16px] font-semibold leading-[19px] text-forest-900">
        {S.verification.detailsTitle}
      </h2>
      <div className="mt-[27px] space-y-6">
        <DetailField label={S.verification.details.company} value={company.name} />
        <DetailField label={S.verification.details.email} value={company.email} />
        <DetailField label={S.verification.details.phone} value={S.verification.notProvided} />
        <DetailField
          label={S.verification.details.location}
          value={location ?? S.verification.notProvided}
        />
      </div>
      <div className="mt-[116px] space-y-3">
        <Button
          className="h-10 w-full rounded-[10px] text-[13px] font-medium"
          isLoading={isVerifying}
          onClick={onVerify}
        >
          {S.verification.verify}
        </Button>
        <Button
          variant="secondary"
          className="h-10 w-full rounded-[10px] text-[13px] font-medium"
          disabled={isVerifying}
          onClick={onReject}
        >
          {S.verification.reject}
        </Button>
      </div>
    </aside>
  );
}

/** Platform — Company Verification, Figma 24:285. */
export function PlatformCompanyVerificationPage() {
  const toast = useToast();
  const [status, setStatus] = useState<VerificationStatus>('pending');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);

  const companies = useAdminCompanies(status, page);
  const verify = useVerifyCompany();
  const reject = useRejectCompany();

  const rows = companies.data?.items ?? [];
  const total = companies.data?.total ?? 0;
  const selected = rows.find((company) => company.id === selectedId) ?? rows[0] ?? null;

  const changeStatus = (next: VerificationStatus) => {
    setStatus(next);
    setPage(1);
    setSelectedId(null);
  };

  const handleVerify = async () => {
    if (!selected) return;
    try {
      await verify.mutateAsync(selected.id);
      toast.success(S.verification.verified);
      setSelectedId(null);
    } catch (error) {
      toast.error(normalizeError(error).message);
    }
  };

  const handleReject = async (reason: string) => {
    if (!selected) return;
    await reject.mutateAsync({ companyId: selected.id, reason });
    toast.success(S.verification.rejected);
    setSelectedId(null);
  };

  return (
    <div className="max-w-content">
      <PageHeader
        title={S.verification.title}
        subtitle={S.verification.subtitle}
        action={
          <Select
            aria-label={S.verification.filterAria}
            className="h-10 w-full max-w-full text-[13px] sm:w-[220px]"
            value={status}
            onChange={(event) => changeStatus(event.target.value as VerificationStatus)}
          >
            {FILTERS.map((value) => (
              <option key={value} value={value}>
                {getStatusInfo('verification', value).label}
              </option>
            ))}
          </Select>
        }
      />

      <div className="mt-[34px] grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex min-h-[610px] flex-col rounded-panel bg-mint px-5 pt-[30px] lg:pb-5">
          {companies.isError ? (
            <ErrorState error={companies.error} onRetry={() => void companies.refetch()} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
              <colgroup>
                <col className="w-[27%]" />
                <col className="w-[18%]" />
                <col />
              </colgroup>
              <thead>
                <tr className="border-b border-line text-[13px] font-medium text-muted">
                  <th className="pb-2 font-medium">{S.verification.columns.company}</th>
                  <th className="pb-2 font-medium">{S.verification.columns.location}</th>
                  <th className="pb-2 font-medium">{S.verification.columns.status}</th>
                </tr>
              </thead>
              <tbody>
                {companies.isLoading &&
                  [0, 1, 2].map((row) => (
                    <tr key={row}>
                      <td colSpan={3} className="pt-4">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))}
                {!companies.isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-16 text-center">
                      <p className="text-table-body font-semibold text-forest-900">
                        {S.verification.emptyTitle}
                      </p>
                      <p className="mt-1 text-[12px] text-muted">{S.verification.emptyMessage}</p>
                    </td>
                  </tr>
                )}
                {rows.map((company) => (
                  <tr
                    key={company.id}
                    tabIndex={0}
                    aria-selected={company.id === selected?.id}
                    onClick={() => setSelectedId(company.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedId(company.id);
                      }
                    }}
                    className="h-[60px] cursor-pointer hover:bg-line/40 focus-visible:bg-line/40 focus-visible:outline-none"
                  >
                      <td className="text-table-body text-forest-900">{company.name}</td>
                      <td className="text-table-body text-forest-900">
                        <CompanyLocation company={company} />
                      </td>
                      <td>
                        <StatusPill domain="verification" value={company.verification_status} />
                      </td>
                    </tr>
                ))}
              </tbody>
              </table>
            </div>
          )}

          {total > PAGE_SIZE && (
            <div className="mt-auto flex items-center justify-between border-t border-line pt-4 text-[12px] text-muted">
              <span>
                {S.common.page} {page} {S.common.of} {pageCount(total)}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  {S.common.previous}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= pageCount(total)}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {S.common.next}
                </Button>
              </div>
            </div>
          )}
        </section>

        {companies.isLoading ? (
          <Skeleton className="min-h-[610px] rounded-panel" />
        ) : selected ? (
          <CompanyDetails
            company={selected}
            isVerifying={verify.isPending}
            onVerify={() => void handleVerify()}
            onReject={() => setRejectOpen(true)}
          />
        ) : (
          <aside className="flex min-h-[610px] items-start rounded-panel bg-mint p-5">
            <p className="text-[13px] text-muted">{S.verification.selectPrompt}</p>
          </aside>
        )}
      </div>

      <ReasonDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={S.verification.rejectTitle}
        label={S.verification.rejectReasonLabel}
        confirmLabel={S.verification.rejectConfirm}
        required
        onConfirm={handleReject}
      />
    </div>
  );
}
