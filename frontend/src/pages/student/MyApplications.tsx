import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { formatDate } from '../../utils/formatters';
import { resolveUserName } from '../../demo/directory';
import { Table, Column } from '../../components/ui/Table';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';

interface ApplicationItem {
  id: string;
  offer_id: string;
  student_user_id: string;
  company_user_id: string;
  status: string;
  start_date: string;
  end_date: string;
  created_at: string;
  offer_title?: string;
  company_name?: string;
}

export const StudentMyApplications: React.FC = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const limit = 20;

  useEffect(() => {
    let isMounted = true;
    async function loadApplications() {
      setIsLoading(true);
      try {
        const data = await apiRequest<{ results: ApplicationItem[]; pagination: { total: number } }>(
          '/svc/applications/api/applications/',
          {
            params: {
              limit,
              offset,
              status: statusFilter || undefined,
            },
          }
        );

        if (!isMounted) return;
        const apps = data.results || [];
        setTotalCount(data.pagination?.total || apps.length);

        // Enrich with titles and company names
        const enriched = await Promise.all(
          apps.map(async (app) => {
            let offer_title = `Offer · ${app.offer_id.slice(0, 6)}`;
            let company_name = resolveUserName(app.company_user_id, 'Company');
            try {
              const offer = await apiRequest<{ title: string; company_user_id: string }>(
                `/svc/offers/api/offers/${app.offer_id}/`
              );
              offer_title = offer.title;
              const compProfile = await apiRequest<{ legal_name?: string }>(
                `/svc/identity/api/companies/${offer.company_user_id}/profile/`
              );
              if (compProfile.legal_name) company_name = compProfile.legal_name;
            } catch {
              // fallback
            }
            return { ...app, offer_title, company_name };
          })
        );

        if (isMounted) {
          setApplications(enriched);
        }
      } catch (err) {
        console.error('Failed to load applications:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadApplications();
    return () => {
      isMounted = false;
    };
  }, [offset, statusFilter]);

  const columns: Column<ApplicationItem>[] = [
    {
      header: 'Offer',
      accessorKey: 'offer_title',
      className: 'font-semibold text-forest-900',
    },
    {
      header: 'Company',
      accessorKey: 'company_name',
      className: 'text-mutedText',
    },
    {
      header: 'Applied on',
      cell: (item) => formatDate(item.created_at),
      className: 'text-mutedText',
    },
    {
      header: 'Status',
      cell: (item) => <StatusPill status={item.status} type="application" />,
    },
    {
      header: 'Action',
      className: 'text-right',
      cell: (item) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/app/student/applications/${item.id}`)}
          className="text-xs"
        >
          View Details
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest-900 tracking-tight">My Applications</h1>
          <p className="text-xs text-mutedText mt-1">
            Accept or decline placements once validated by your university administration.
          </p>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setOffset(0);
          }}
          className="px-3 py-2 text-xs bg-white border border-mint-300 rounded-lg text-forest-900 focus:outline-none focus:ring-2 focus:ring-surface-600"
        >
          <option value="">All Statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="COMPANY_ACCEPTED">Pending Uni Validation</option>
          <option value="UNIVERSITY_VALIDATED">Awaiting My Decision</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="COMPANY_REJECTED">Company Rejected</option>
          <option value="UNIVERSITY_REJECTED">University Rejected</option>
          <option value="STUDENT_DECLINED">Declined</option>
          <option value="WITHDRAWN">Withdrawn</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-mint-300/60 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={applications}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          emptyMessage="No applications found. Explore available offers to submit one."
        />

        <Pagination
          totalItems={totalCount}
          pageSize={limit}
          currentPage={Math.floor(offset / limit) + 1}
          onPageChange={(page) => setOffset((page - 1) * limit)}
        />
      </div>
    </div>
  );
};
