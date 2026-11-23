import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Briefcase, Users, Clock, CheckCircle2, PlusCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { apiRequest } from '../../api/client';
import { StatCard } from '../../components/ui/StatCard';
import { SectionCard } from '../../components/ui/SectionCard';
import { Table, Column } from '../../components/ui/Table';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { formatDate } from '../../utils/formatters';
import { resolveUserName } from '../../demo/directory';

interface OfferItem {
  id: string;
  title: string;
  status: string;
  capacity: number;
  deadline: string;
}

interface ApplicationItem {
  id: string;
  offer_id: string;
  student_user_id: string;
  status: string;
  created_at: string;
  offer_title?: string;
  student_name?: string;
}

export const CompanyDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { search } = useOutletContext<{ search?: string }>() || {};

  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboard() {
      setIsLoading(true);
      try {
        const [offersRes, appsRes] = await Promise.allSettled([
          apiRequest<{ results: OfferItem[] }>('/svc/offers/api/offers/', {
            params: { mine: true },
          }),
          apiRequest<{ results: ApplicationItem[] }>('/svc/applications/api/applications/'),
        ]);

        if (!isMounted) return;

        let myOffers: OfferItem[] = [];
        if (offersRes.status === 'fulfilled' && offersRes.value.results) {
          myOffers = offersRes.value.results;
          setOffers(myOffers);
        }

        if (appsRes.status === 'fulfilled' && appsRes.value.results) {
          const apps = appsRes.value.results;
          // Enrich with offer titles and student names
          const enriched = apps.map((app) => {
            const matchedOffer = myOffers.find((o) => o.id === app.offer_id);
            return {
              ...app,
              offer_title: matchedOffer?.title || `Offer · ${app.offer_id.slice(0, 6)}`,
              student_name: resolveUserName(app.student_user_id, 'Student'),
            };
          });
          setApplications(enriched);
        }
      } catch (err) {
        console.error('Failed to load company dashboard:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter applications by search if provided
  const filteredApps = applications.filter((app) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      app.student_name?.toLowerCase().includes(q) ||
      app.offer_title?.toLowerCase().includes(q) ||
      app.status.toLowerCase().includes(q)
    );
  });

  const activeOffers = offers.filter((o) => o.status === 'published');
  const activeOffersCount = activeOffers.length;
  const totalPlaces = activeOffers.reduce((sum, o) => sum + (o.capacity || 0), 0);
  const pendingValidationCount = applications.filter(
    (a) => a.status === 'COMPANY_ACCEPTED'
  ).length;
  const awaitingStudentCount = applications.filter(
    (a) => a.status === 'UNIVERSITY_VALIDATED'
  ).length;

  const columns: Column<ApplicationItem>[] = [
    {
      header: 'Applicant',
      accessorKey: 'student_name',
      className: 'font-semibold text-forest-900',
    },
    {
      header: 'Internship Offer',
      accessorKey: 'offer_title',
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
      cell: () => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate('/app/company/applications')}
          className="text-xs text-surface-700"
        >
          Review →
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest-900 tracking-tight">
            Company Dashboard
          </h1>
          <p className="text-xs text-mutedText mt-1">
            Welcome, {user?.name || 'Partner'}. Monitor your recruitment pipeline and active listings.
          </p>
        </div>

        <Button
          onClick={() => navigate('/app/company/offers/new')}
          className="shrink-0"
        >
          <PlusCircle className="w-4 h-4 mr-2" /> Post New Offer
        </Button>
      </div>

      {/* 4-up Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Offers"
          value={isLoading ? '-' : activeOffersCount}
          hint="Open for applications"
          icon={<Briefcase className="w-5 h-5" />}
        />
        <StatCard
          label="Total Available Places"
          value={isLoading ? '-' : totalPlaces}
          hint="Sum of published capacities"
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          label="Pending Uni Validation"
          value={isLoading ? '-' : pendingValidationCount}
          hint="Accepted by you"
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          label="Awaiting Student Decision"
          value={isLoading ? '-' : awaitingStudentCount}
          hint="Validated by university"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
      </div>

      {/* Recent Applications Table */}
      <SectionCard
        title="Recent Applications"
        subtitle="Students who have applied to your internship opportunities"
        action={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/app/company/applications')}
            className="text-xs text-surface-700"
          >
            View all requests <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        }
      >
        <Table
          columns={columns}
          data={filteredApps.slice(0, 5)}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          emptyMessage="No applications received yet. Post and publish offers to start receiving candidate applications."
        />
      </SectionCard>
    </div>
  );
};
