import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import { CompanyNameCell, OfferTitleCell } from '@/features/student/components/NameCells';
import type { Internship } from '@/api/internships';
import { formatDate } from '@/lib/format';
import { StudentMatriculeCell, StudentNameCell } from '../components/NameCells';
import { useSupervisorInternships } from '../hooks';
import { S } from '../strings';

/** Supervisor My Students — Figma 27:186. */
export function SupervisorStudentsPage() {
  const internships = useSupervisorInternships();
  const showMatricule = import.meta.env.VITE_DEMO_DIRECTORY === '1';

  return (
    <div className="max-w-content">
      <PageHeader title={S.students.title} subtitle={S.students.subtitle} />

      <div className="mt-5">
        {internships.isError ? (
          <ErrorState error={internships.error} onRetry={() => void internships.refetch()} />
        ) : internships.isLoading ? (
          <Skeleton className="h-[420px] rounded-panel" />
        ) : (
          <DataTable
            columns={[
              {
                key: 'student',
                header: S.common.student,
                render: (row) => <StudentNameCell userId={row.student_user_id} />,
              },
              ...(showMatricule
                ? [
                    {
                      key: 'matricule',
                      header: S.students.id,
                      render: (row: Internship) => (
                        <StudentMatriculeCell userId={row.student_user_id} />
                      ),
                      width: '180px',
                    },
                  ]
                : []),
              {
                key: 'company',
                header: S.students.company,
                render: (row) => <CompanyNameCell companyId={row.company_user_id} />,
              },
              {
                key: 'offer',
                header: S.students.placement,
                render: (row) => <OfferTitleCell offerId={row.offer_id} />,
              },
              {
                key: 'period',
                header: S.common.period,
                render: (row) => `${formatDate(row.start_date)} → ${formatDate(row.end_date)}`,
                width: '210px',
              },
              {
                key: 'status',
                header: S.common.status,
                render: (row) => <StatusPill domain="internship" value={row.status} />,
              },
              {
                key: 'action',
                header: S.common.action,
                align: 'right',
                render: (row) => (
                  <Link
                    to={ROUTES.supervisor.studentProfile(row.id)}
                    className="text-[13px] font-medium text-surface-600 hover:underline"
                  >
                    {S.students.view}
                  </Link>
                ),
              },
            ]}
            rows={internships.data?.items ?? []}
            getRowKey={(row) => row.id}
            emptyState={<EmptyState title={S.students.title} message={S.students.empty} />}
          />
        )}
      </div>
    </div>
  );
}
