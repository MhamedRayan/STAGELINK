import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Briefcase, FileText, GraduationCap, Bell, ArrowRight } from 'lucide-react';
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
}

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { search } = useOutletContext<{ search?: string }>() || {};

  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [activeInternship, setActiveInternship] = useState<any | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const firstName = user?.name ? user.name.split(' ')[0] : 'Student';

  useEffect(() => {
    let isMounted = true;
    async function loadDashboard() {
      setIsLoading(true);
      try {
        const [appsRes, internRes, notifRes] = await Promise.allSettled([
          apiRequest<{ results: ApplicationItem[] }>('/svc/applications/api/applications/'),
          apiRequest<{ results: any[] }>('/svc/internships/api/internships/', {
            params: { mine: true },
          }),
          apiRequest<{ unread_count: number }>('/svc/notifications/api/notifications/unread-count/'),
        ]);

        if (!isMounted) return;

        let apps: ApplicationItem[] = [];
        if (appsRes.status === 'fulfilled' && appsRes.value.results) {
          apps = appsRes.value.results;
        }

        if (internRes.status === 'fulfilled' && internRes.value.results) {
          const ongoing = internRes.value.results.find(
            (i) => i.status === 'confirmed' || i.status === 'in_progress'
          );
          setActiveInternship(ongoing || null);
        }

        if (notifRes.status === 'fulfilled' && notifRes.value.unread_count !== undefined) {
          setUnreadCount(notifRes.value.unread_count);
        }

        // Enrich offer titles and company names
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
              // Graceful fallback
            }
            return { ...app, offer_title, company_name };
          })
        );

        if (isMounted) {
          setApplications(enriched);
        }
      } catch (err) {
        console.error('Failed to load student dashboard:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter applications by top-bar search if present (per design-plan §3.2)
  const filteredApps = applications.filter((app) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      app.offer_title?.toLowerCase().includes(q) ||
      app.company_name?.toLowerCase().includes(q) ||
      app.status.toLowerCase().includes(q)
    );
  });

  const activeAppsCount = applications.filter((a) =>
    ['SUBMITTED', 'COMPANY_ACCEPTED', 'UNIVERSITY_VALIDATED'].includes(a.status)
  ).length;

  const awaitingDecisionCount = applications.filter(
    (a) => a.status === 'UNIVERSITY_VALIDATED'
  ).length;

  const currentInternshipStatus = activeInternship
    ? activeInternship.status === 'confirmed'
      ? 'Confirmed'
      : 'In Progress'
    : 'None';

  const columns: Column<ApplicationItem>[] = [
    {
      header: 'Offer',
      accessorKey: 'offer_title',
      className: 'font-medium text-forest-900',
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
          variant="ghost"
          onClick={() => navigate(`/app/student/applications/${item.id}`)}
          className="text-xs text-surface-700 hover:text-forest-900"
        >
          View Details →
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome & Header */}
      <div>
        <h1 className="text-2xl font-bold text-forest-900 tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="text-xs text-mutedText mt-1">
          Monitor your application lifecycle and track your internship progress.
        </p>
      </div>

      {/* 4-up Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Applications"
          value={isLoading ? '-' : activeAppsCount}
          hint="In review or awaiting decision"
          icon={<FileText className="w-5 h-5" />}
        />
        <StatCard
          label="Awaiting My Decision"
          value={isLoading ? '-' : awaitingDecisionCount}
          hint={awaitingDecisionCount > 0 ? 'Action required!' : 'None pending'}
          icon={<Briefcase className="w-5 h-5" />}
        />
        <StatCard
          label="Current Internship"
          value={isLoading ? '-' : currentInternshipStatus}
          hint={activeInternship ? 'Active placement' : 'Not started'}
          icon={<GraduationCap className="w-5 h-5" />}
        />
        <StatCard
          label="Unread Notifications"
          value={isLoading ? '-' : unreadCount}
          hint="System updates"
          icon={<Bell className="w-5 h-5" />}
        />
      </div>

      {/* Quick Actions Row */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => navigate('/app/student/offers')}
          className="bg-forest-900 text-inverseText"
        >
          <Briefcase className="w-4 h-4 mr-2" /> Browse Offers
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate('/app/student/applications')}
        >
          <FileText className="w-4 h-4 mr-2" /> View My Applications
        </Button>
        {activeInternship && (
          <Button
            variant="outline"
            onClick={() => navigate('/app/student/internship/submission')}
          >
            <GraduationCap className="w-4 h-4 mr-2" /> Submit Final Work
          </Button>
        )}
      </div>

      {/* Recent Applications Table */}
      <SectionCard
        title="My Applications"
        subtitle="Recent applications submitted to company offers"
        action={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/app/student/applications')}
            className="text-xs text-surface-700"
          >
            View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        }
      >
        <Table
          columns={columns}
          data={filteredApps.slice(0, 5)}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          emptyMessage="No applications found. Start exploring available offers to submit an application."
        />
      </SectionCard>
    </div>
  );
};
