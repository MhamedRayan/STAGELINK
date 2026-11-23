import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { formatPeriod } from '../../utils/formatters';
import { resolveUserName } from '../../demo/directory';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { SectionCard } from '../../components/ui/SectionCard';

interface InternshipData {
  id: string;
  offer_id: string;
  student_user_id: string;
  company_user_id: string;
  status: string;
  start_date: string;
  end_date: string;
}

export const SupervisorInternshipProgress: React.FC = () => {
  const { internshipId } = useParams<{ internshipId: string }>();
  const navigate = useNavigate();

  const [internship, setInternship] = useState<InternshipData | null>(null);
  const [offerTitle, setOfferTitle] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const loadData = async () => {
    if (!internshipId) return;
    setIsLoading(true);
    try {
      const data = await apiRequest<InternshipData>(
        `/svc/internships/api/internships/${internshipId}/`
      );
      setInternship(data);

      try {
        const offer = await apiRequest<{ title: string; company_user_id: string }>(
          `/svc/offers/api/offers/${data.offer_id}/`
        );
        setOfferTitle(offer.title);
        const comp = await apiRequest<{ legal_name?: string }>(
          `/svc/identity/api/companies/${offer.company_user_id}/profile/`
        );
        setCompanyName(comp.legal_name || resolveUserName(offer.company_user_id, 'Company'));
      } catch {
        setOfferTitle(`Offer · ${data.offer_id.slice(0, 6)}`);
        setCompanyName(resolveUserName(data.company_user_id, 'Company'));
      }
    } catch (err: any) {
      console.error('Failed to load internship:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [internshipId]);

  const handleStart = async () => {
    if (!internshipId) return;
    setActionError(null);
    setIsUpdating(true);
    try {
      await apiRequest(`/svc/internships/api/internships/${internshipId}/start/`, {
        method: 'POST',
      });
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to start internship.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleComplete = async () => {
    if (!internshipId) return;
    setActionError(null);
    setIsUpdating(true);
    try {
      await apiRequest(`/svc/internships/api/internships/${internshipId}/complete/`, {
        method: 'POST',
      });
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to complete internship.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center items-center">
        <div className="w-8 h-8 border-3 border-surface-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!internship) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-lg font-bold text-forest-900 mb-2">Internship Not Found</h2>
        <Link to="/app/supervisor/students">
          <Button variant="outline" size="sm">
            ← Back to Students
          </Button>
        </Link>
      </div>
    );
  }

  const studentName = resolveUserName(internship.student_user_id, 'Student');

  return (
    <div className="space-y-6">
      <Link
        to={`/app/supervisor/students/${internship.id}`}
        className="inline-flex items-center text-xs font-semibold text-surface-700 hover:underline"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Student Profile
      </Link>

      {actionError && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-mint-300/60 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-surface-600 mb-1 block">
            Internship Lifecycle Progress
          </span>
          <h1 className="text-xl font-bold text-forest-900">{offerTitle}</h1>
          <p className="text-xs text-mutedText mt-1">
            Student: <span className="font-semibold text-forest-900">{studentName}</span> • Host: <span className="font-semibold text-forest-900">{companyName}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StatusPill status={internship.status} type="internship" className="text-sm px-3.5 py-1" />
        </div>
      </div>

      {/* Lifecycle Actions */}
      <SectionCard title="Lifecycle Controls">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-mint-50/50 rounded-lg border border-mint-200">
          <div>
            <h4 className="text-sm font-semibold text-forest-900">
              Current State: {internship.status.toUpperCase()}
            </h4>
            <p className="text-xs text-mutedText mt-0.5">
              Period: {formatPeriod(internship.start_date, internship.end_date)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {internship.status === 'confirmed' && (
              <Button onClick={handleStart} isLoading={isUpdating} size="sm">
                <Play className="w-3.5 h-3.5 mr-1.5" /> Start Placement (In Progress)
              </Button>
            )}

            {internship.status === 'in_progress' && (
              <Button onClick={handleComplete} isLoading={isUpdating} size="sm" variant="outline">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Mark Completed
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => navigate(`/app/supervisor/reviews/${internship.id}`)}
              className="bg-forest-900 text-inverseText"
            >
              Review Deliverables & Grade →
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
