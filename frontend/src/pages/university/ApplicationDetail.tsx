import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Check, X, Building2, User, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { formatDate, formatDateTime, formatPeriod } from '../../utils/formatters';
import { resolveUserName } from '../../demo/directory';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { SectionCard } from '../../components/ui/SectionCard';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';

interface ApplicationDetail {
  id: string;
  offer_id: string;
  student_user_id: string;
  company_user_id: string;
  status: string;
  start_date: string;
  end_date: string;
  created_at: string;
  company_reason?: string;
  university_reason?: string;
}

interface OfferData {
  title: string;
  location: string;
  capacity: number;
  description: string;
  company_user_id: string;
}

interface HistoryItem {
  from_status: string;
  to_status: string;
  reason?: string;
  created_at: string;
}

export const UniversityApplicationDetail: React.FC = () => {
  const { applicationId } = useParams<{ applicationId: string }>();

  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [companyName, setCompanyName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reject Modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [rejectModalError, setRejectModalError] = useState<string | null>(null);

  const loadData = async () => {
    if (!applicationId) return;
    setIsLoading(true);
    try {
      const appData = await apiRequest<ApplicationDetail>(
        `/svc/applications/api/applications/${applicationId}/`
      );
      setApplication(appData);

      // Offer & Company details
      try {
        const off = await apiRequest<OfferData>(`/svc/offers/api/offers/${appData.offer_id}/`);
        setOffer(off);
        const comp = await apiRequest<{ legal_name?: string }>(
          `/svc/identity/api/companies/${off.company_user_id}/profile/`
        );
        setCompanyName(comp.legal_name || resolveUserName(off.company_user_id, 'Company'));
      } catch {
        setCompanyName(resolveUserName(appData.company_user_id, 'Company'));
      }

      // History
      try {
        const hist = await apiRequest<HistoryItem[]>(
          `/svc/applications/api/applications/${applicationId}/history/`
        );
        if (Array.isArray(hist)) setHistory(hist);
      } catch {
        // silent
      }
    } catch (err: any) {
      console.error('Failed to load application detail:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [applicationId]);

  const handleValidate = async () => {
    if (!applicationId) return;
    setActionError(null);
    setIsSubmitting(true);
    try {
      await apiRequest(`/svc/applications/api/applications/${applicationId}/university-decision/`, {
        method: 'POST',
        body: JSON.stringify({ decision: 'ACCEPT' }),
      });
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Validation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicationId) return;
    setRejectModalError(null);

    if (!rejectReason.trim()) {
      setRejectModalError('Please specify the academic reason for rejection.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(`/svc/applications/api/applications/${applicationId}/university-decision/`, {
        method: 'POST',
        body: JSON.stringify({
          decision: 'REJECT',
          reason: rejectReason,
        }),
      });
      setIsRejectModalOpen(false);
      setRejectReason('');
      loadData();
    } catch (err: any) {
      setRejectModalError(err.message || 'Rejection failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center items-center">
        <div className="w-8 h-8 border-3 border-surface-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-lg font-bold text-forest-900 mb-2">Application Not Found</h2>
        <Link to="/app/university/applications">
          <Button variant="outline" size="sm">
            ← Back to Applications
          </Button>
        </Link>
      </div>
    );
  }

  const studentName = resolveUserName(application.student_user_id, 'Student');

  return (
    <div className="space-y-6">
      <Link
        to="/app/university/applications"
        className="inline-flex items-center text-xs font-semibold text-surface-700 hover:underline"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Applications Queue
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
            Application Review
          </span>
          <h1 className="text-xl font-bold text-forest-900">
            {offer?.title || `Offer · ${application.offer_id.slice(0, 6)}`}
          </h1>
          <p className="text-xs text-mutedText mt-1">
            Submitted by <span className="font-semibold text-forest-900">{studentName}</span> to{' '}
            <span className="font-semibold text-forest-900">{companyName}</span>
          </p>
        </div>

        <div>
          <StatusPill status={application.status} type="application" className="text-sm px-3.5 py-1" />
        </div>
      </div>

      {/* Academic Validation Decision Box */}
      {application.status === 'COMPANY_ACCEPTED' && (
        <div className="bg-mint rounded-xl p-6 border border-mint-300 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-forest-900 mb-1">
                Institutional Academic Decision Required
              </h3>
              <p className="text-xs text-forest-900/80 leading-relaxed max-w-xl">
                The host company has accepted this student. Validate to confirm that this placement satisfies degree internship requirements, or reject with academic justification.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                onClick={handleValidate}
                isLoading={isSubmitting}
                className="bg-forest-900 text-inverseText"
              >
                <Check className="w-4 h-4 mr-1.5" /> Validate Application
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsRejectModalOpen(true)}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                <X className="w-4 h-4 mr-1.5" /> Reject Application
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Student Block */}
        <SectionCard title="Student Candidate">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-surface-700 font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-forest-900">{studentName}</h4>
                <p className="text-xs text-mutedText font-mono">ID: {application.student_user_id.slice(0, 8)}</p>
              </div>
            </div>
            <div className="pt-3 border-t border-mint-200 text-xs text-mutedText space-y-1">
              <div>
                Proposed Period:{' '}
                <span className="font-semibold text-forest-900">
                  {formatPeriod(application.start_date, application.end_date)}
                </span>
              </div>
              <div>Applied on: {formatDate(application.created_at)}</div>
            </div>
          </div>
        </SectionCard>

        {/* Offer & Company Block */}
        <SectionCard title="Host Organization & Position">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-mint flex items-center justify-center text-surface-700 font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-forest-900">{companyName}</h4>
                <p className="text-xs text-mutedText">{offer?.location || 'Algiers'}</p>
              </div>
            </div>
            <p className="text-xs text-mutedText line-clamp-3 leading-relaxed pt-2 border-t border-mint-200">
              {offer?.description}
            </p>
          </div>
        </SectionCard>
      </div>

      {/* History Timeline */}
      <SectionCard title="Application Status Transitions">
        {history.length === 0 ? (
          <p className="text-xs text-mutedText py-2">No history events recorded.</p>
        ) : (
          <div className="space-y-4">
            {history.map((h, idx) => (
              <div key={idx} className="flex items-start gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-surface-600 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-forest-900">
                    {h.to_status.replace(/_/g, ' ')}{' '}
                    <span className="text-mutedText font-normal">
                      ({formatDateTime(h.created_at)})
                    </span>
                  </div>
                  {h.reason && (
                    <p className="text-mutedText mt-0.5 italic">"{h.reason}"</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Reject Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Application"
      >
        <form onSubmit={handleConfirmReject} className="space-y-4">
          <p className="text-xs text-mutedText">
            Please provide an academic justification for rejecting this placement. This reason will be transmitted to both the student and the host company.
          </p>

          {rejectModalError && (
            <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {rejectModalError}
            </div>
          )}

          <Textarea
            label="Mandatory Academic Reason"
            required
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Schedule overlaps with mandatory examination period, or project mission does not satisfy curriculum requirements..."
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-mint-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsRejectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isSubmitting}
            >
              Confirm Rejection
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
