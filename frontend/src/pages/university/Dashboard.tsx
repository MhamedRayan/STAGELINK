import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Users, Clock, UserCheck, GraduationCap, ArrowRight } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { apiRequest } from '../../api/client';
import { StatCard } from '../../components/ui/StatCard';
import { SectionCard } from '../../components/ui/SectionCard';
import { Table, Column } from '../../components/ui/Table';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { formatDate } from '../../utils/formatters';
import { resolveUserName } from '../../demo/directory';

interface ApplicationItem {
  id: string;
  offer_id: string;
  student_user_id: string;
  company_user_id: string;
  status: string;
  created_at: string;
  offer_title?: string;
  company_name?: string;
  student_name?: string;
}

interface InternshipItem {
  id: string;
  student_user_id: string;
  supervisor_user_id?: string;
  status: string;
}

export const UniversityDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { search } = useOutletContext<{ search?: string }>() || {};

  const [pendingApplications, setPendingApplications] = useState<ApplicationItem[]>([]);
  const [totalStudentsCount, setTotalStudentsCount] = useState<number>(0);
  const [unassignedCount, setUnassignedCount] = useState<number>(0);
  const [activeInternshipsCount, setActiveInternshipsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboard() {
      setIsLoading(true);
      try {
        const [appsRes, internRes] = await Promise.all([
          apiRequest<{ results: ApplicationItem[] }>('/svc/applications/api/applications/', {
            params: { status: 'COMPANY_ACCEPTED' },
          }),
          apiRequest<{ results: InternshipItem[] }>('/svc/internships/api/internships/', {
            params: { limit: 100 },
          }),
        ]);

        if (!isMounted) return;

        const apps = appsRes.results || [];
        const internships = internRes.results || [];

        // Derived student count: distinct student_user_id across apps & internships per design-plan §3.4
        const studentIds = new Set<string>();
        apps.forEach((a) => studentIds.add(a.student_user_id));
        internships.forEach((i) => studentIds.add(i.student_user_id));
        setTotalStudentsCount(studentIds.size);

        // Active internships & unassigned supervisors
        const active = internships.filter(
          (i) => i.status === 'confirmed' || i.status === 'in_progress'
        );
        setActiveInternshipsCount(active.length);

        const unassigned = active.filter((i) => !i.supervisor_user_id);
        setUnassignedCount(unassigned.length);

        // Enrich pending apps with titles and company names
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

            return {
              ...app,
              offer_title,
              company_name,
              student_name: resolveUserName(app.student_user_id, 'Student'),
            };
          })
        );

        if (isMounted) {
          setPendingApplications(enriched);
        }
      } catch (err) {
        console.error('Failed to load university dashboard:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredApps = pendingApplications.filter((app) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      app.student_name?.toLowerCase().includes(q) ||
      app.offer_title?.toLowerCase().includes(q) ||
      app.company_name?.toLowerCase().includes(q)
    );
  });

  const columns: Column<ApplicationItem>[] = [
    {
      header: 'Student',
      accessorKey: 'student_name',
      className: 'font-semibold text-forest-900',
    },
    {
      header: 'Internship Offer',
      accessorKey: 'offer_title',
      className: 'text-mutedText',
    },
    {
      header: 'Host Company',
      accessorKey: 'company_name',
      className: 'text-mutedText',
    },
    {
      header: 'Company Accepted on',
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
          variant="ghost"
          onClick={() => navigate(`/app/university/applications/${item.id}`)}
          className="text-xs text-surface-700"
        >
          Review →
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-forest-900 tracking-tight">
          University Administration
        </h1>
        <p className="text-xs text-mutedText mt-1">
          Welcome, {user?.name || 'Administrator'}. Validate placements, assign academic supervisors, and monitor student progress.
        </p>
      </div>

      {/* 4-up Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Students with Activity"
          value={isLoading ? '-' : totalStudentsCount}
          hint="Participating in placements"
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          label="Awaiting Academic Validation"
          value={isLoading ? '-' : pendingApplications.length}
          hint="Company accepted"
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          label="Unassigned Internships"
          value={isLoading ? '-' : unassignedCount}
          hint="Needs supervisor assignment"
          icon={<UserCheck className="w-5 h-5" />}
        />
        <StatCard
          label="Active Internships"
          value={isLoading ? '-' : activeInternshipsCount}
          hint="Confirmed & in progress"
          icon={<GraduationCap className="w-5 h-5" />}
        />
      </div>

      {/* Applications Awaiting Validation */}
      <SectionCard
        title="Applications Awaiting University Validation"
        subtitle="Placements approved by host companies requiring institutional validation"
        action={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/app/university/applications')}
            className="text-xs text-surface-700"
          >
            View all applications <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        }
      >
        <Table
          columns={columns}
          data={filteredApps.slice(0, 5)}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          emptyMessage="No applications currently awaiting university validation."
        />
      </SectionCard>
    </div>
  );
};
