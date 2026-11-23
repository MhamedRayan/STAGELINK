import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { resolveUserName, resolveUserMatricule } from '../../demo/directory';
import { formatPeriod } from '../../utils/formatters';
import { Table, Column } from '../../components/ui/Table';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';

interface StudentRecord {
  internship_id: string;
  student_user_id: string;
  student_name: string;
  matricule: string;
  company_name: string;
  offer_title: string;
  status: string;
  start_date: string;
  end_date: string;
}

export const SupervisorMyStudents: React.FC = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadMyStudents() {
      setIsLoading(true);
      try {
        const res = await apiRequest<{ results: any[] }>(
          '/svc/internships/api/internships/',
          { params: { mine: true, limit: 100 } }
        );

        if (!isMounted) return;
        const items = res.results || [];

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
              internship_id: i.id,
              student_user_id: i.student_user_id,
              student_name: resolveUserName(i.student_user_id, 'Student'),
              matricule: resolveUserMatricule(i.student_user_id),
              company_name,
              offer_title,
              status: i.status,
              start_date: i.start_date,
              end_date: i.end_date,
            };
          })
        );

        if (isMounted) {
          setStudents(enriched);
        }
      } catch (err) {
        console.error('Failed to load students:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadMyStudents();
    return () => {
      isMounted = false;
    };
  }, []);

  const columns: Column<StudentRecord>[] = [
    {
      header: 'Student',
      accessorKey: 'student_name',
      className: 'font-semibold text-forest-900',
    },
    {
      header: 'Student ID (Matricule)',
      accessorKey: 'matricule',
      className: 'text-mutedText font-mono text-xs',
    },
    {
      header: 'Host Company',
      accessorKey: 'company_name',
      className: 'text-mutedText',
    },
    {
      header: 'Internship Placement',
      accessorKey: 'offer_title',
      className: 'text-mutedText',
    },
    {
      header: 'Period',
      cell: (item) => formatPeriod(item.start_date, item.end_date),
      className: 'text-xs text-mutedText',
    },
    {
      header: 'Status',
      cell: (item) => <StatusPill status={item.status} type="internship" />,
    },
    {
      header: 'Action',
      className: 'text-right',
      cell: (item) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/app/supervisor/students/${item.internship_id}`)}
          className="text-xs"
        >
          View Student Profile
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-forest-900 tracking-tight">My Students</h1>
        <p className="text-xs text-mutedText mt-1">
          Only students currently or previously assigned to your supervision are listed.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-mint-300/60 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={students}
          keyExtractor={(item) => item.internship_id}
          isLoading={isLoading}
          emptyMessage="No students currently assigned to you."
        />
      </div>
    </div>
  );
};
