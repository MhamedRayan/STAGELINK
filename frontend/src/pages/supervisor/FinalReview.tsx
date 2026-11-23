import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Check, X, Download, Award, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiRequest, downloadAuthenticatedFile, ApiError } from '../../api/client';
import { formatDateTime, formatFileSize, formatGrade } from '../../utils/formatters';
import { resolveUserName } from '../../demo/directory';
import { SectionCard } from '../../components/ui/SectionCard';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea } from '../../components/ui/Input';

interface SubmissionItem {
  id: string;
  version: number;
  filename: string;
  file_size: number;
  status: string;
  rejection_reason?: string;
  created_at: string;
}

interface EvaluationData {
  id: string;
  grade: string;
  comment?: string;
  created_at: string;
}

export const SupervisorFinalReview: React.FC = () => {
  const { internshipId } = useParams<{ internshipId: string }>();

  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [studentName, setStudentName] = useState<string>('');
  const [offerTitle, setOfferTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Rejection modal state
  const [rejectingSub, setRejectingSub] = useState<SubmissionItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [rejectModalError, setRejectModalError] = useState<string | null>(null);

  // Evaluation form state
  const [grade, setGrade] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [isSubmittingEvaluation, setIsSubmittingEvaluation] = useState<boolean>(false);

  const loadData = async () => {
    if (!internshipId) return;
    setIsLoading(true);
    try {
      const intern = await apiRequest<any>(
        `/svc/internships/api/internships/${internshipId}/`
      );
      setStudentName(resolveUserName(intern.student_user_id, 'Student'));

      try {
        const off = await apiRequest<{ title: string }>(
          `/svc/offers/api/offers/${intern.offer_id}/`
        );
        setOfferTitle(off.title);
      } catch {
        setOfferTitle(`Placement · ${intern.offer_id.slice(0, 6)}`);
      }

      // Submissions
      const subs = await apiRequest<SubmissionItem[]>(
        `/svc/internships/api/internships/${internshipId}/submissions/`
      );
      setSubmissions(Array.isArray(subs) ? subs : []);

      // Evaluation
      try {
        const evalData = await apiRequest<EvaluationData>(
          `/svc/internships/api/internships/${internshipId}/evaluation/`
        );
        if (evalData && evalData.grade !== undefined) {
          setEvaluation(evalData);
          setGrade(evalData.grade);
          setComment(evalData.comment || '');
        }
      } catch {
        // no evaluation yet
      }
    } catch (err: any) {
      console.error('Failed to load review data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [internshipId]);

  const handleApproveSubmission = async (sub: SubmissionItem) => {
    if (!internshipId) return;
    setActionError(null);
    setSuccessMessage(null);
    try {
      await apiRequest(
        `/svc/internships/api/internships/${internshipId}/submissions/${sub.id}/approve/`,
        { method: 'POST' }
      );
      setSuccessMessage(`Version ${sub.version} approved! You can now record the final score.`);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve submission.');
    }
  };

  const handleConfirmRejectSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!internshipId || !rejectingSub) return;
    setRejectModalError(null);

    if (!rejectionReason.trim()) {
      setRejectModalError('Please provide a mandatory reason for requesting resubmission.');
      return;
    }

    setIsRejecting(true);
    try {
      await apiRequest(
        `/svc/internships/api/internships/${internshipId}/submissions/${rejectingSub.id}/reject/`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: rejectionReason }),
        }
      );
      setRejectingSub(null);
      setRejectionReason('');
      setSuccessMessage(`Requested resubmission for Version ${rejectingSub.version}.`);
      loadData();
    } catch (err: any) {
      setRejectModalError(err.message || 'Failed to request resubmission.');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!internshipId) return;
    setActionError(null);
    setSuccessMessage(null);

    const numericGrade = parseFloat(grade);
    if (isNaN(numericGrade) || numericGrade < 0 || numericGrade > 20) {
      setActionError('Grade must be a valid number between 0 and 20.');
      return;
    }

    // Format to string with 2 decimals e.g. "17.50" per design-plan §3.5
    const formattedGrade = numericGrade.toFixed(2);

    setIsSubmittingEvaluation(true);
    try {
      const recorded = await apiRequest<EvaluationData>(
        `/svc/internships/api/internships/${internshipId}/evaluation/`,
        {
          method: 'POST',
          body: JSON.stringify({
            grade: formattedGrade,
            comment: comment || undefined,
          }),
        }
      );
      setEvaluation(recorded);
      setSuccessMessage('Final evaluation recorded! Internship is marked completed.');
      loadData();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Failed to record evaluation.');
      }
    } finally {
      setIsSubmittingEvaluation(false);
    }
  };

  const handleDownload = async (sub: SubmissionItem) => {
    if (!internshipId) return;
    try {
      await downloadAuthenticatedFile(
        `/svc/internships/api/internships/${internshipId}/submissions/${sub.id}/download/`,
        sub.filename || `submission-v${sub.version}.pdf`
      );
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center items-center">
        <div className="w-8 h-8 border-3 border-surface-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isApproved = submissions.some((s) => s.status === 'APPROVED');

  return (
    <div className="space-y-6">
      <Link
        to={`/app/supervisor/students/${internshipId}`}
        className="inline-flex items-center text-xs font-semibold text-surface-700 hover:underline"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Student Profile
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-forest-900 tracking-tight">
          Final Review & Evaluation
        </h1>
        <p className="text-xs text-mutedText mt-1">
          Review deliverables for <span className="font-semibold text-forest-900">{studentName}</span> ({offerTitle}).
        </p>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-lg border border-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Deliverables Review Section */}
      <SectionCard title="Submitted Deliverables">
        {submissions.length === 0 ? (
          <p className="text-xs text-mutedText py-4">No submissions received yet.</p>
        ) : (
          <div className="divide-y divide-mint-200">
            {submissions.map((sub) => (
              <div
                key={sub.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-mint flex items-center justify-center text-surface-700 font-bold shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-forest-900 flex items-center gap-2">
                      <span>Version {sub.version}</span>
                      <span className="text-mutedText font-normal truncate max-w-sm">
                        {sub.filename}
                      </span>
                    </div>
                    <div className="text-[11px] text-mutedText">
                      Uploaded: {formatDateTime(sub.created_at)} • {formatFileSize(sub.file_size)}
                    </div>
                    {sub.rejection_reason && (
                      <p className="text-[11px] text-red-700 mt-1 italic">
                        Feedback: "{sub.rejection_reason}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-12 sm:ml-0">
                  <StatusPill status={sub.status} type="submission" />

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(sub)}
                    className="text-xs h-8"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" /> Download
                  </Button>

                  {sub.status === 'SUBMITTED' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleApproveSubmission(sub)}
                        className="bg-forest-900 text-inverseText text-xs h-8 px-3"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRejectingSub(sub);
                          setRejectionReason('');
                        }}
                        className="text-red-600 border-red-300 hover:bg-red-50 text-xs h-8 px-3"
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Resubmission Required
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Evaluation Section */}
      <SectionCard title="Academic Evaluation & Final Score (0 - 20)">
        {!isApproved && !evaluation ? (
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              Evaluation scoring unlocks once a final report version has been officially approved.
            </span>
          </div>
        ) : (
          <form onSubmit={handleSaveEvaluation} className="space-y-4 max-w-xl">
            <div className="flex items-center gap-4">
              <div className="w-48">
                <Input
                  label="Score (out of 20)"
                  type="number"
                  step="0.25"
                  min="0"
                  max="20"
                  required
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="e.g. 17.50"
                />
              </div>
              {evaluation && (
                <div className="mt-4 text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Grade Saved: {formatGrade(evaluation.grade)}
                </div>
              )}
            </div>

            <Textarea
              label="Evaluation Comments & Remarks (Optional)"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Provide academic feedback and assessment comments for the student and administration..."
            />

            <div className="pt-2">
              <Button type="submit" isLoading={isSubmittingEvaluation}>
                <Award className="w-4 h-4 mr-1.5" />
                {evaluation ? 'Update Evaluation Score' : 'Record Evaluation & Complete Internship'}
              </Button>
            </div>
          </form>
        )}
      </SectionCard>

      {/* Reject Submission Modal */}
      <Modal
        isOpen={!!rejectingSub}
        onClose={() => setRejectingSub(null)}
        title={`Request Resubmission (Version ${rejectingSub?.version})`}
      >
        <form onSubmit={handleConfirmRejectSubmission} className="space-y-4">
          <p className="text-xs text-mutedText">
            Provide actionable feedback for the student detailing the revisions and corrections required before resubmission.
          </p>

          {rejectModalError && (
            <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {rejectModalError}
            </div>
          )}

          <Textarea
            label="Mandatory Revision Notes"
            required
            rows={4}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="e.g. Chapter 3 lacks experimental benchmarks, report formatting does not adhere to guidelines..."
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-mint-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectingSub(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isRejecting}
            >
              Confirm Resubmission Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
