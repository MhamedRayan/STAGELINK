import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Clock, AlertCircle, Ban } from 'lucide-react';
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
  student_reason?: string;
  withdrawal_reason?: string;
}

interface HistoryItem {
  id: string;
  from_status: string;
  to_status: string;
  actor_user_id?: string;
  reason?: string;
  created_at: string;
}

export const StudentApplicationDetail: React.FC = () => {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();

  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [offerTitle, setOfferTitle] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Decision & Withdraw state
  const [isDecisionLoading, setIsDecisionLoading] = useState<boolean>(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState<boolean>(false);
  const [withdrawReason, setWithdrawReason] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!applicationId) return;
      setIsLoading(true);
      try {
        const [appData, histData] = await Promise.all([
          apiRequest<ApplicationDetail>(`/svc/applications/api/applications/${applicationId}/`),
          apiRequest<HistoryItem[]>(`/svc/applications/api/applications/${applicationId}/history/`).catch(
            () => []
          ),
        ]);

        if (!isMounted) return;
        setApplication(appData);
        setHistory(Array.isArray(histData) ? histData : []);

        // Resolve offer & company
        try {
          const offer = await apiRequest<{ title: string; company_user_id: string }>(
            `/svc/offers/api/offers/${appData.offer_id}/`
          );
          setOfferTitle(offer.title);
          const compProfile = await apiRequest<{ legal_name?: string }>(
            `/svc/identity/api/companies/${offer.company_user_id}/profile/`
          );
          setCompanyName(compProfile.legal_name || resolveUserName(offer.company_user_id, 'Company'));
        } catch {
          setOfferTitle(`Offer · ${appData.offer_id.slice(0, 6)}`);
          setCompanyName(resolveUserName(appData.company_user_id, 'Company'));
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Application not found');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [applicationId]);

  const handleStudentDecision = async (decision: 'ACCEPT' | 'DECLINE') => {
    if (!applicationId) return;
    setIsDecisionLoading(true);
    setActionError(null);
    try {
      await apiRequest(`/svc/applications/api/applications/${applicationId}/student-decision/`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      // Refresh
      const updated = await apiRequest<ApplicationDetail>(
        `/svc/applications/api/applications/${applicationId}/`
      );
      setApplication(updated);
      if (decision === 'ACCEPT') {
        navigate('/app/student/internship');
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit decision.');
    } finally {
      setIsDecisionLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicationId) return;
    setIsDecisionLoading(true);
    setActionError(null);
    try {
      await apiRequest(`/svc/applications/api/applications/${applicationId}/withdraw/`, {
        method: 'POST',
        body: JSON.stringify({ reason: withdrawReason || undefined }),
      });
      setIsWithdrawModalOpen(false);
      const updated = await apiRequest<ApplicationDetail>(
        `/svc/applications/api/applications/${applicationId}/`
      );
      setApplication(updated);
    } catch (err: any) {
      setActionError(err.message || 'Withdrawal failed.');
    } finally {
      setIsDecisionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center items-center">
        <div className="w-8 h-8 border-3 border-surface-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-lg font-bold text-forest-900 mb-2">Application Not Found</h2>
        <p className="text-xs text-mutedText mb-4">{error || 'Unable to display details.'}</p>
        <Link to="/app/student/applications">
          <Button variant="outline" size="sm">
            ← Back to My Applications
          </Button>
        </Link>
      </div>
    );
  }

  const canWithdraw = ['SUBMITTED', 'COMPANY_ACCEPTED', 'UNIVERSITY_VALIDATED', 'STUDENT_ACCEPTED'].includes(
    application.status
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/app/student/applications"
          className="inline-flex items-center text-xs font-semibold text-surface-700 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to My Applications
        </Link>

        {canWithdraw && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsWithdrawModalOpen(true)}
            className="text-xs text-red-600 border-red-300 hover:bg-red-50"
          >
            <Ban className="w-3.5 h-3.5 mr-1" /> Withdraw Application
          </Button>
        )}
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white rounded-xl p-6 border border-mint-300/60 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-surface-600 mb-1">{companyName}</div>
            <h1 className="text-xl font-bold text-forest-900">{offerTitle}</h1>
            <p className="text-xs text-mutedText mt-1">
              Internship Period: {formatPeriod(application.start_date, application.end_date)} • Applied on {formatDate(application.created_at)}
            </p>
          </div>

          <div>
            <StatusPill status={application.status} type="application" className="text-sm px-3.5 py-1" />
          </div>
        </div>
      </div>

      {/* State-Specific Action Panels */}
      {application.status === 'UNIVERSITY_VALIDATED' && (
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-6 text-forest-900">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-base font-bold text-blue-950 mb-1">
                Awaiting Your Final Decision
              </h3>
              <p className="text-xs text-blue-900/80 mb-4 leading-relaxed">
                Both {companyName} and your university administration have validated your placement for this internship. Accept to confirm your placement and begin the onboarding process.
              </p>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleStudentDecision('ACCEPT')}
                  isLoading={isDecisionLoading}
                  className="bg-forest-900 text-inverseText"
                >
                  Accept Internship Placement
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleStudentDecision('DECLINE')}
                  isLoading={isDecisionLoading}
                  className="border-blue-300 text-blue-900 hover:bg-blue-100/60"
                >
                  Decline Placement
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {application.status === 'COMPANY_ACCEPTED' && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-6 text-forest-900">
          <div className="flex items-start gap-3">
            <Clock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-amber-950 mb-1">
                Accepted by Company — Pending University Validation
              </h3>
              <p className="text-xs text-amber-900/80 leading-relaxed">
                {companyName} has reviewed and accepted your application! Your university administrator will now review and validate the academic requirements. You will be able to make your final decision once validated.
              </p>
            </div>
          </div>
        </div>
      )}

      {application.status === 'CONFIRMED' && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-6 text-forest-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-emerald-950 mb-1">
                  Internship Confirmed!
                </h3>
                <p className="text-xs text-emerald-900/80 leading-relaxed">
                  Congratulations! Your internship is confirmed. A university supervisor will be assigned to guide your internship.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => navigate('/app/student/internship')}
              className="bg-emerald-800 hover:bg-emerald-900 text-white shrink-0"
            >
              Go to My Internship →
            </Button>
          </div>
        </div>
      )}

      {application.status === 'COMPANY_REJECTED' && (
        <div className="bg-red-50/70 border border-red-200 rounded-xl p-6 text-forest-900">
          <div className="flex items-start gap-3">
            <XCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-red-950 mb-1">Application Declined by Company</h3>
              <p className="text-xs text-red-900/80 leading-relaxed mb-2">
                This application has been closed by {companyName}.
              </p>
              {application.company_reason && (
                <div className="mt-2 p-3 bg-white/80 rounded-lg text-xs border border-red-200">
                  <span className="font-semibold text-red-950">Feedback provided: </span>
                  <span className="text-forest-900">{application.company_reason}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {application.status === 'UNIVERSITY_REJECTED' && (
        <div className="bg-red-50/70 border border-red-200 rounded-xl p-6 text-forest-900">
          <div className="flex items-start gap-3">
            <XCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-red-950 mb-1">Rejected by University Administration</h3>
              <p className="text-xs text-red-900/80 leading-relaxed mb-2">
                The university administration did not validate this application.
              </p>
              {application.university_reason && (
                <div className="mt-2 p-3 bg-white/80 rounded-lg text-xs border border-red-200">
                  <span className="font-semibold text-red-950">Reason: </span>
                  <span className="text-forest-900">{application.university_reason}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {application.status === 'WITHDRAWN' && (
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-6 text-forest-900">
          <h3 className="text-sm font-bold text-slate-800 mb-1">Application Withdrawn</h3>
          <p className="text-xs text-slate-600">
            You withdrew this application on {formatDate(application.created_at)}.
          </p>
        </div>
      )}

      {/* History Timeline */}
      <SectionCard title="Application Lifecycle History">
        {history.length === 0 ? (
          <p className="text-xs text-mutedText">No status transitions recorded yet.</p>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-mint-300">
            {history.map((event, idx) => (
              <div key={idx} className="relative">
                <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-surface-600 ring-4 ring-white" />
                <div className="text-xs font-semibold text-forest-900 flex items-center gap-2">
                  <span>{event.to_status.replace(/_/g, ' ')}</span>
                  <span className="text-[11px] font-normal text-mutedText">
                    ({formatDateTime(event.created_at)})
                  </span>
                </div>
                {event.reason && (
                  <p className="text-xs text-mutedText mt-1 bg-mint-50/50 p-2 rounded-md border border-mint-200">
                    "{event.reason}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Withdraw Modal */}
      <Modal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        title="Withdraw Application"
      >
        <form onSubmit={handleWithdraw} className="space-y-4">
          <p className="text-xs text-mutedText">
            Are you sure you want to withdraw this application? This action cannot be undone.
          </p>
          <Textarea
            label="Optional Reason"
            value={withdrawReason}
            onChange={(e) => setWithdrawReason(e.target.value)}
            placeholder="e.g. Accepted another position or schedule conflict"
          />
          <div className="flex justify-end gap-3 pt-3 border-t border-mint-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsWithdrawModalOpen(false)}
            >
              Keep Application
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isDecisionLoading}
            >
              Confirm Withdrawal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
