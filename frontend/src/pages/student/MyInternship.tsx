import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  UserCheck,
  UploadCloud,
  Award,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { formatDate, formatPeriod } from '../../utils/formatters';
import { resolveUserName } from '../../demo/directory';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { SectionCard } from '../../components/ui/SectionCard';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';

interface InternshipDetail {
  id: string;
  offer_id: string;
  student_user_id: string;
  company_user_id: string;
  supervisor_user_id?: string;
  status: string;
  start_date: string;
  end_date: string;
  created_at: string;
  offer_title?: string;
  company_name?: string;
}

interface CancellationRequest {
  id: string;
  internship_id: string;
  requested_by_user_id: string;
  reason: string;
  status: string;
  created_at: string;
}

export const StudentMyInternship: React.FC = () => {
  const navigate = useNavigate();
  const [internship, setInternship] = useState<InternshipDetail | null>(null);
  const [cancellation, setCancellation] = useState<CancellationRequest | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Cancellation Modal state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadInternship() {
      setIsLoading(true);
      try {
        const res = await apiRequest<{ results: InternshipDetail[] }>(
          '/svc/internships/api/internships/',
          { params: { mine: true } }
        );

        if (!isMounted) return;
        const current = (res.results || [])[0];

        if (current) {
          // Resolve offer and company title
          let offer_title = `Internship · ${current.offer_id.slice(0, 6)}`;
          let company_name = resolveUserName(current.company_user_id, 'Company');

          try {
            const offer = await apiRequest<{ title: string; company_user_id: string }>(
              `/svc/offers/api/offers/${current.offer_id}/`
            );
            offer_title = offer.title;
            const compProfile = await apiRequest<{ legal_name?: string }>(
              `/svc/identity/api/companies/${offer.company_user_id}/profile/`
            );
            if (compProfile.legal_name) company_name = compProfile.legal_name;
          } catch {
            // fallback
          }

          setInternship({ ...current, offer_title, company_name });

          // Load cancellation requests
          try {
            const reqs = await apiRequest<CancellationRequest[]>(
              `/svc/internships/api/internships/${current.id}/cancellation-requests/`
            );
            if (Array.isArray(reqs) && reqs.length > 0) {
              setCancellation(reqs[0]);
            }
          } catch {
            // Non-blocking
          }
        }
      } catch (err) {
        console.error('Failed to load internship:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadInternship();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRequestCancellation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!internship) return;
    setCancelError(null);

    if (!cancelReason.trim()) {
      setCancelError('Please provide a reason for the cancellation request.');
      return;
    }

    setIsSubmittingCancel(true);
    try {
      const newReq = await apiRequest<CancellationRequest>(
        `/svc/internships/api/internships/${internship.id}/cancellation-requests/`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: cancelReason }),
        }
      );
      setCancellation(newReq);
      setIsCancelModalOpen(false);
    } catch (err: any) {
      setCancelError(err.message || 'Failed to submit cancellation request.');
    } finally {
      setIsSubmittingCancel(false);
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
      <div className="py-16 text-center bg-white rounded-xl border border-mint-200 p-8">
        <GraduationCap className="w-12 h-12 text-mutedText/60 mx-auto mb-3" />
        <h2 className="text-base font-bold text-forest-900 mb-1">No Active Internship Found</h2>
        <p className="text-xs text-mutedText max-w-md mx-auto mb-6">
          Once your application has been validated by both the company and the university, and accepted by you, your confirmed internship placement will appear here.
        </p>
        <Button onClick={() => navigate('/app/student/offers')}>
          Browse Available Offers
        </Button>
      </div>
    );
  }

  // Lifecycle steps
  const steps = [
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
  ];

  const getStepStatus = (stepKey: string) => {
    if (internship.status === 'cancelled') return 'cancelled';
    const order = ['confirmed', 'in_progress', 'completed'];
    const currentIdx = order.indexOf(internship.status);
    const stepIdx = order.indexOf(stepKey);

    if (stepIdx < currentIdx) return 'complete';
    if (stepIdx === currentIdx) return 'current';
    return 'upcoming';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-surface-600 mb-1">{internship.company_name}</div>
          <h1 className="text-2xl font-bold text-forest-900 tracking-tight">{internship.offer_title}</h1>
          <p className="text-xs text-mutedText mt-1">
            Period: {formatPeriod(internship.start_date, internship.end_date)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StatusPill status={internship.status} type="internship" className="text-sm px-3.5 py-1" />
        </div>
      </div>

      {/* Lifecycle Stepper */}
      <div className="bg-white rounded-xl p-6 border border-mint-300/60 shadow-xs">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-mutedText mb-6">
          Internship Progress
        </h2>

        {internship.status === 'cancelled' ? (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg text-xs border border-red-200 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>This internship has been officially cancelled.</span>
          </div>
        ) : (
          <div className="flex items-center justify-between max-w-xl mx-auto">
            {steps.map((step, idx) => {
              const status = getStepStatus(step.key);
              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                        status === 'complete'
                          ? 'bg-emerald-600 text-white'
                          : status === 'current'
                          ? 'bg-forest-900 text-white ring-4 ring-mint'
                          : 'bg-mint-200 text-mutedText'
                      }`}
                    >
                      {status === 'complete' ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                    </div>
                    <span className="text-xs font-medium text-forest-900 mt-2">
                      {step.label}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-4 ${
                        status === 'complete' ? 'bg-emerald-600' : 'bg-mint-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Supervisor Card */}
        <SectionCard title="Assigned Academic Supervisor">
          {internship.supervisor_user_id ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-surface-700 font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-forest-900">
                    {resolveUserName(internship.supervisor_user_id, 'Supervisor')}
                  </h4>
                  <p className="text-xs text-mutedText">Academic Supervisor</p>
                </div>
              </div>
              <p className="text-xs text-mutedText leading-relaxed pt-2 border-t border-mint-200">
                Your supervisor reviews your final project report and records your evaluation grade.
              </p>
            </div>
          ) : (
            <div className="text-xs text-mutedText py-4">
              <Clock className="w-5 h-5 text-amber-500 mb-2" />
              <span>Supervisor pending assignment by the university administrator.</span>
            </div>
          )}
        </SectionCard>

        {/* Actions Card */}
        <SectionCard title="Work & Deliverables">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-mint-50/50 rounded-lg border border-mint-200">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-surface-600" />
                <span className="text-xs font-semibold text-forest-900">Final Report Submission</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/app/student/internship/submission')}
                className="text-xs"
              >
                Upload Report
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 bg-mint-50/50 rounded-lg border border-mint-200">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-surface-600" />
                <span className="text-xs font-semibold text-forest-900">Evaluation & Grade</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/app/student/internship/evaluation')}
                className="text-xs"
              >
                View Grade
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Cancellation Panel */}
      <SectionCard title="Cancellation Request">
        {cancellation ? (
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-xs text-forest-900 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-amber-950">
                Request Status: {cancellation.status.toUpperCase()}
              </span>
              <span className="text-mutedText">{formatDate(cancellation.created_at)}</span>
            </div>
            <p className="text-mutedText">Reason submitted: "{cancellation.reason}"</p>
            <p className="text-[11px] text-amber-900/80">
              The university administrator is reviewing this request.
            </p>
          </div>
        ) : internship.status !== 'cancelled' && internship.status !== 'completed' ? (
          <div className="flex items-center justify-between">
            <p className="text-xs text-mutedText max-w-lg">
              If unforeseen circumstances prevent you from continuing your placement, you may request a cancellation for review by your university.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCancelModalOpen(true)}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Request Cancellation
            </Button>
          </div>
        ) : (
          <p className="text-xs text-mutedText">No cancellation actions available.</p>
        )}
      </SectionCard>

      {/* Cancellation Request Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Submit Cancellation Request"
      >
        <form onSubmit={handleRequestCancellation} className="space-y-4">
          <p className="text-xs text-mutedText">
            Please explain the reason for requesting to cancel this internship. Your request will be reviewed by university administration.
          </p>

          {cancelError && (
            <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {cancelError}
            </div>
          )}

          <Textarea
            label="Mandatory Reason"
            required
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={4}
            placeholder="Please detail why the internship cannot continue (1-500 characters)..."
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-mint-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCancelModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isSubmittingCancel}
            >
              Submit to University
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
