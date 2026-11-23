import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApplications } from '@/lib/queries';
import { usePageSearch } from '@/lib/search';
import { applicationStatuses, statusMeta } from '@/lib/status';
import { formatDate } from '@/lib/format';
import { CompanyName } from '@/components/CompanyName';
import { OfferTitle } from '@/components/EntityName';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  Pagination,
  Select,
  StatusPill,
  Table,
  Td,
  Th,
} from '@/components/ui';
import type { ApplicationStatus } from '@/lib/api/types';

const PAGE_SIZE = 20;

export function MyApplicationsPage() {
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  const [page, setPage] = useState(1);
  const { search } = usePageSearch();

  useEffect(() => {
    setPage(1);
  }, [status, search]);

  const { data, isLoading, isError, refetch } = useApplications({
    status: status || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const rows = (data?.results ?? []).filter((row) => {
    if (!search.trim()) return true;
    const meta = statusMeta(applicationStatuses, row.status);
    return meta.label.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div>
      <PageHeader
        title="My Applications"
        subtitle="Accept or decline an offer only after the university has validated it."
        action={
          <Link to="/app/student/offers">
            <Button>Browse offers</Button>
          </Link>
        }
      />

      <div className="mb-5 w-64">
        <label htmlFor="status-filter" className="sr-only">
          Filter by status
        </label>
        <Select
          id="status-filter"
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

      {isLoading ? (
        <LoadingBlock label="Loading applications…" />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : !data || data.results.length === 0 ? (
        <EmptyState
          title="No applications found"
          description="When you apply to an offer it appears here with its current status."
          action={
            <Link to="/app/student/offers">
              <Button size="sm">Browse offers</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="rounded-card border border-forest-900/5 bg-white p-6 shadow-sm">
            <Table>
              <thead>
                <tr>
                  <Th>Offer</Th>
                  <Th>Company</Th>
                  <Th>Applied on</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td className="font-semibold text-forest-900">
                      <OfferTitle offerId={row.offer_id} />
                    </Td>
                    <Td>
                      <CompanyName companyUserId={row.company_user_id} />
                    </Td>
                    <Td className="text-muted">{formatDate(row.created_at)}</Td>
                    <Td>
                      <StatusPill meta={statusMeta(applicationStatuses, row.status)} />
                    </Td>
                    <Td className="text-right">
                      <Link
                        to={`/app/student/applications/${row.id}`}
                        className="text-xs font-semibold text-forest-900 underline"
                      >
                        View
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={data.pagination.total}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
