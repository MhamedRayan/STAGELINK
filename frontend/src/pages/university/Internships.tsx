import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import { formatPeriod } from '../../utils/formatters';
import { resolveUserName } from '../../demo/directory';
import { Table, Column } from '../../components/ui/Table';
import { StatusPill } from '../../components/ui/StatusPill';
import { Pagination } from '../../components/ui/Pagination';

interface InternshipRecord {
  id: string;
  offer_id: string;
  student_user_id: string;
  company_user_id: string;
  supervisor_user_id?: string;
  status: string;
  start_date: string;
  end_date: string;
  offer_title?: string;
  company_name?: string;
  student_name?: string;
  supervisor_name?: string;
}

export const UniversityInternships: React.FC = () => {
  const [internships, setInternships] = useState<InternshipRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const limit = 20;

  useEffect(() => {
    let isMounted = true;
    async function loadInternships() {
      setIsLoading(true);
      try {
        const data = await apiRequest<{ results: InternshipRecord[]; pagination: { total: number } }>(
          '/svc/internships/api/internships/',
          {
            params: {
              limit,
              offset,
              status: statusFilter || undefined,
            },
          }
        );

        if (!isMounted) return;
        const items = data.results || [];
        setTotalCount(data.pagination?.total || items.length);

        const enriched = await Promise.all(
          items.map(async (i) => {
            let offer_title = `Offer · ${i.offer_id.slice(0, 6)}`;
            let company_name = resolveUserName(i.company_user_id, 'Company');

            try {
              const offer = await apiRequest<{ title: string; company_user_id: string }>(
                `/svc/offers/api/offers/${i.offer_id}/`
              );
              offer_title = offer.title;
              const comp = await apiRequest<{ legal_name?: string }>(
                `/svc/identity/api/companies/${offer.company_user_id}/profile/`
              );
              if (comp.legal_name) company_name = comp.legal_name;
            } catch {
              // fallback
            }

            return {
              ...i,
              offer_title,
              company_name,
              student_name: resolveUserName(i.student_user_id, 'Student'),
              supervisor_name: i.supervisor_user_id
                ? resolveUserName(i.supervisor_user_id, 'Supervisor')
                : 'Unassigned',
            };
          })
        );

        if (isMounted) {
          setInternships(enriched);
        }
      } catch (err) {
        console.error('Failed to load internships:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadInternships();
    return () => {
      isMounted = false;
    };
  }, [offset, statusFilter]);

  const columns: Column<InternshipRecord>[] = [
    {
      header: 'Student',
      accessorKey: 'student_name',
      className: 'font-semibold text-forest-900',
    },
    {
      header: 'Company',
      accessorKey: 'company_name',
      className: 'text-mutedText',
    },
    {
      header: 'Placement Offer',
      accessorKey: 'offer_title',
      className: 'text-mutedText',
    },
    {
      header: 'Internship Period',
      cell: (item) => formatPeriod(item.start_date, item.end_date),
      className: 'text-xs text-mutedText',
    },
    {
      header: 'Status',
      cell: (item) => <StatusPill status={item.status} type="internship" />,
    },
    {
      header: 'Assigned Supervisor',
      accessorKey: 'supervisor_name',
      className: 'text-xs text-forest-900 font-medium',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest-900 tracking-tight">Internships</h1>
          <p className="text-xs text-mutedText mt-1">
            Comprehensive lifecycle monitoring of all active, completed, and cancelled placements.
          </p>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setOffset(0);
          }}
          className="px-3 py-2 text-xs bg-white border border-mint-300 rounded-lg text-forest-900 focus:outline-none focus:ring-2 focus:ring-surface-600"
        >
          <option value="">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-mint-300/60 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={internships}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          emptyMessage="No internships found."
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
