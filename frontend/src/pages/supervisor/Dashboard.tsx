import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Users, GraduationCap, Clock, Award, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { apiRequest } from '../../api/client';
import { StatCard } from '../../components/ui/StatCard';
import { SectionCard } from '../../components/ui/SectionCard';
import { Table, Column } from '../../components/ui/Table';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { resolveUserName } from '../../demo/directory';

interface SupervisorInternship {
  id: string;
  offer_id: string;
  student_user_id: string;
  company_user_id: string;
  status: string;
  start_date: string;
  end_date: string;
  offer_title?: string;
  company_name?: string;
  student_name?: string;
  latestSubmissionStatus?: string;
  hasEvaluation?: boolean;
}

export const SupervisorDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { search } = useOutletContext<{ search?: string }>() || {};

  const [internships, setInternships] = useState<SupervisorInternship[]>([]);
  const [pendingReviewsCount, setPendingReviewsCount] = useState<number>(0);
  const [evaluationsToCompleteCount, setEvaluationsToCompleteCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadSupervisorDashboard() {
      setIsLoading(true);
      try {
        const res = await apiRequest<{ results: any[] }>(
          '/svc/internships/api/internships/',
          { params: { mine: true, limit: 50 } }
        );

        if (!isMounted) return;
        const items = res.results || [];

        let pendingReviews = 0;
        let evaluationsToComplete = 0;

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

            // Check submissions and evaluation per internship (design-plan §3.5)
            let latestSubmissionStatus: string | undefined;
            let hasEvaluation = false;

            try {
              const subs = await apiRequest<any[]>(
                `/svc/internships/api/internships/${i.id}/submissions/`
              );
              if (Array.isArray(subs) && subs.length > 0) {
                const latest = subs[subs.length - 1];
                latestSubmissionStatus = latest.status;
                if (latest.status === 'SUBMITTED') {
                  pendingReviews += 1;
                }
              }
            } catch {
              // silent
            }

            try {
              const evalData = await apiRequest<any>(
                `/svc/internships/api/internships/${i.id}/evaluation/`
              );
              if (evalData && evalData.grade !== undefined) {
                hasEvaluation = true;
              }
            } catch {
              // no evaluation yet
            }

            if (latestSubmissionStatus === 'APPROVED' && !hasEvaluation) {
              evaluationsToComplete += 1;
            }

            return {
              ...i,
              offer_title,
              company_name,
              student_name: resolveUserName(i.student_user_id, 'Student'),
              latestSubmissionStatus,
              hasEvaluation,
            };
          })
        );

        if (isMounted) {
          setInternships(enriched);
          setPendingReviewsCount(pendingReviews);
          setEvaluationsToCompleteCount(evaluationsToComplete);
        }
      } catch (err) {
        console.error('Failed to load supervisor dashboard:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadSupervisorDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const filtered = internships.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.student_name?.toLowerCase().includes(q) ||
      item.offer_title?.toLowerCase().includes(q) ||
      item.company_name?.toLowerCase().includes(q)
    );
  });

  const distinctStudents = new Set(internships.map((i) => i.student_user_id)).size;
  const activeInternships = internships.filter(
    (i) => i.status === 'confirmed' || i.status === 'in_progress'
  ).length;

  const columns: Column<SupervisorInternship>[] = [
    {
      header: 'Assigned Student',
      accessorKey: 'student_name',
      className: 'font-semibold text-forest-900',
    },
    {
      header: 'Host Company',
      accessorKey: 'company_name',
      className: 'text-mutedText',
    },
    {
      header: 'Internship Role',
      accessorKey: 'offer_title',
      className: 'text-mutedText',
    },
    {
      header: 'Placement Status',
      cell: (item) => <StatusPill status={item.status} type="internship" />,
    },
    {
      header: 'Review State',
      cell: (item) => (
        <span className="text-xs font-medium">
          {item.hasEvaluation ? (
            <span className="text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Evaluated
            </span>
          ) : item.latestSubmissionStatus === 'SUBMITTED' ? (
            <span className="text-amber-700 flex items-center gap-1 font-semibold">
              <Clock className="w-3.5 h-3.5" /> Pending Review
            </span>
          ) : item.latestSubmissionStatus === 'APPROVED' ? (
            <span className="text-blue-700 flex items-center gap-1">
              <Award className="w-3.5 h-3.5" /> Awaiting Score
            </span>
          ) : (
            <span className="text-mutedText">In Progress</span>
          )}
        </span>
      ),
    },
    {
      header: 'Action',
      className: 'text-right',
      cell: (item) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate(`/app/supervisor/students/${item.id}`)}
          className="text-xs text-surface-700 hover:text-forest-900"
        >
          View Profile →
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-forest-900 tracking-tight">
          Supervisor Dashboard
        </h1>
        <p className="text-xs text-mutedText mt-1">
          Welcome, {user?.name || 'Professor'}. Monitor student progress, review project deliverables, and record final evaluations.
        </p>
      </div>

      {/* 4-up Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="My Students"
          value={isLoading ? '-' : distinctStudents}
          hint="Assigned under supervision"
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          label="Active Internships"
          value={isLoading ? '-' : activeInternships}
          hint="Confirmed & in progress"
          icon={<GraduationCap className="w-5 h-5" />}
        />
        <StatCard
          label="Pending Deliverable Reviews"
          value={isLoading ? '-' : pendingReviewsCount}
          hint={pendingReviewsCount > 0 ? 'Action required!' : 'None pending'}
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          label="Evaluations to Complete"
          value={isLoading ? '-' : evaluationsToCompleteCount}
          hint="Approved reports awaiting score"
          icon={<Award className="w-5 h-5" />}
        />
      </div>

      {/* Assigned Students Table */}
      <SectionCard
        title="My Assigned Students"
        subtitle="Students currently completing placements under your academic supervision"
        action={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/app/supervisor/students')}
            className="text-xs text-surface-700"
          >
            View all students <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        }
      >
        <Table
          columns={columns}
          data={filtered}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          emptyMessage="No students currently assigned to your supervision."
        />
      </SectionCard>
    </div>
  );
};
