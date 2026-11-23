import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Award,
  Download,
} from 'lucide-react';
import { apiRequest, downloadAuthenticatedFile } from '../../api/client';
import {
  formatDate,
  formatDateTime,
  formatPeriod,
  formatFileSize,
  formatGrade,
} from '../../utils/formatters';
import { resolveUserName, resolveUserMatricule } from '../../demo/directory';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { SectionCard } from '../../components/ui/SectionCard';

interface InternshipDetail {
  id: string;
  offer_id: string;
  student_user_id: string;
  company_user_id: string;
  status: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

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

export const SupervisorStudentProfile: React.FC = () => {
  const { internshipId } = useParams<{ internshipId: string }>();
  const navigate = useNavigate();

  const [internship, setInternship] = useState<InternshipDetail | null>(null);
  const [offerTitle, setOfferTitle] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'submissions' | 'evaluation' | 'history'>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!internshipId) return;
      setIsLoading(true);
      try {
        const internData = await apiRequest<InternshipDetail>(
          `/svc/internships/api/internships/${internshipId}/`
        );
        if (!isMounted) return;
        setInternship(internData);

        // Offer & Company
        try {
          const offer = await apiRequest<{ title: string; company_user_id: string }>(
            `/svc/offers/api/offers/${internData.offer_id}/`
          );
          setOfferTitle(offer.title);
          const comp = await apiRequest<{ legal_name?: string }>(
            `/svc/identity/api/companies/${offer.company_user_id}/profile/`
          );
          setCompanyName(comp.legal_name || resolveUserName(offer.company_user_id, 'Company'));
        } catch {
          setOfferTitle(`Offer · ${internData.offer_id.slice(0, 6)}`);
          setCompanyName(resolveUserName(internData.company_user_id, 'Company'));
        }

        // Submissions
        try {
          const subs = await apiRequest<SubmissionItem[]>(
            `/svc/internships/api/internships/${internshipId}/submissions/`
          );
          if (Array.isArray(subs)) setSubmissions(subs);
        } catch {
          // silent
        }

        // Evaluation
        try {
          const evalData = await apiRequest<EvaluationData>(
            `/svc/internships/api/internships/${internshipId}/evaluation/`
          );
          if (evalData && evalData.grade !== undefined) setEvaluation(evalData);
        } catch {
          // silent
        }

        // History
        try {
          const hist = await apiRequest<any[]>(
            `/svc/internships/api/internships/${internshipId}/history/`
          );
          if (Array.isArray(hist)) setHistory(hist);
        } catch {
          // silent
        }
      } catch (err: any) {
        console.error('Failed to load student profile:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [internshipId]);

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

  if (!internship) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-lg font-bold text-forest-900 mb-2">Student Not Found</h2>
        <Link to="/app/supervisor/students">
          <Button variant="outline" size="sm">
            ← Back to My Students
          </Button>
        </Link>
      </div>
    );
  }

  const studentName = resolveUserName(internship.student_user_id, 'Student');
  const matricule = resolveUserMatricule(internship.student_user_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/app/supervisor/students"
          className="inline-flex items-center text-xs font-semibold text-surface-700 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to My Students
        </Link>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => navigate(`/app/supervisor/reviews/${internship.id}`)}
            className="text-xs"
          >
            Review & Evaluation Panel →
          </Button>
        </div>
      </div>

      {/* Header Profile Card */}
      <div className="bg-white rounded-xl p-6 border border-mint-300/60 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-forest-900 text-mint font-bold text-lg flex items-center justify-center shrink-0">
            {studentName.charAt(0)}
          </div>
          <div>
            <div className="text-xs font-semibold text-surface-600 mb-0.5">
              Assigned Student • {offerTitle} at {companyName}
            </div>
            <h1 className="text-xl font-bold text-forest-900">{studentName}</h1>
            <p className="text-xs text-mutedText font-mono mt-0.5">Student ID: {matricule}</p>
          </div>
        </div>

        <div>
          <StatusPill status={internship.status} type="internship" className="text-sm px-3.5 py-1" />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-mint-200 flex gap-6 text-xs font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 transition-colors ${
            activeTab === 'overview'
              ? 'border-b-2 border-forest-900 text-forest-900 font-bold'
              : 'text-mutedText hover:text-forest-900'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('submissions')}
          className={`pb-3 transition-colors flex items-center gap-1.5 ${
            activeTab === 'submissions'
              ? 'border-b-2 border-forest-900 text-forest-900 font-bold'
              : 'text-mutedText hover:text-forest-900'
          }`}
        >
          Submissions ({submissions.length})
        </button>
        <button
          onClick={() => setActiveTab('evaluation')}
          className={`pb-3 transition-colors ${
            activeTab === 'evaluation'
              ? 'border-b-2 border-forest-900 text-forest-900 font-bold'
              : 'text-mutedText hover:text-forest-900'
          }`}
        >
          Evaluation {evaluation ? '✓' : ''}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 transition-colors ${
            activeTab === 'history'
              ? 'border-b-2 border-forest-900 text-forest-900 font-bold'
              : 'text-mutedText hover:text-forest-900'
          }`}
        >
          History
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SectionCard title="Placement Details">
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-mint-200">
                <span className="text-mutedText">Internship Period</span>
                <span className="font-semibold text-forest-900">
                  {formatPeriod(internship.start_date, internship.end_date)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-mint-200">
                <span className="text-mutedText">Host Organisation</span>
                <span className="font-semibold text-forest-900">{companyName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-mint-200">
                <span className="text-mutedText">Position Role</span>
                <span className="font-semibold text-forest-900">{offerTitle}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-mutedText">Assigned On</span>
                <span className="font-semibold text-forest-900">{formatDate(internship.created_at)}</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Supervisor Progress Actions">
            <p className="text-xs text-mutedText leading-relaxed mb-4">
              Review submitted draft files, grant feedback or approval, and record the final academic evaluation score out of 20.
            </p>
            <Button
              onClick={() => navigate(`/app/supervisor/reviews/${internship.id}`)}
              className="w-full"
            >
              Open Final Review & Evaluation
            </Button>
          </SectionCard>
        </div>
      )}

      {activeTab === 'submissions' && (
        <SectionCard title="Deliverables & Submissions">
          {submissions.length === 0 ? (
            <p className="text-xs text-mutedText py-4">Student has not uploaded any submissions yet.</p>
          ) : (
            <div className="divide-y divide-mint-200">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-mint flex items-center justify-center text-surface-700 font-bold shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-forest-900 flex items-center gap-2">
                        <span>Version {sub.version}</span>
                        <span className="text-mutedText font-normal truncate max-w-xs">{sub.filename}</span>
                      </div>
                      <div className="text-[11px] text-mutedText">
                        Uploaded on {formatDateTime(sub.created_at)} • {formatFileSize(sub.file_size)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-11 sm:ml-0">
                    <StatusPill status={sub.status} type="submission" />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(sub)}
                      className="text-xs"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" /> Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {activeTab === 'evaluation' && (
        <SectionCard title="Evaluation & Academic Grade">
          {evaluation ? (
            <div className="space-y-4">
              <div className="p-4 bg-mint rounded-xl border border-mint-300 flex items-center justify-between">
                <div>
                  <div className="text-xs text-mutedText mb-1">Final Score Recorded</div>
                  <div className="text-3xl font-extrabold text-forest-900">
                    {formatGrade(evaluation.grade)}
                  </div>
                </div>
                <Award className="w-10 h-10 text-surface-700" />
              </div>
              {evaluation.comment && (
                <div className="text-xs p-4 bg-white rounded-lg border border-mint-200 text-forest-900">
                  <span className="font-semibold block mb-1">Your Written Remarks:</span>
                  <p className="text-mutedText whitespace-pre-line leading-relaxed">
                    "{evaluation.comment}"
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-mutedText">
              <Award className="w-8 h-8 text-mutedText/50 mx-auto mb-2" />
              <span>No evaluation recorded yet for this student.</span>
              <div className="mt-4">
                <Button
                  size="sm"
                  onClick={() => navigate(`/app/supervisor/reviews/${internship.id}`)}
                >
                  Go to Evaluation Panel
                </Button>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {activeTab === 'history' && (
        <SectionCard title="Internship Status Transitions">
          {history.length === 0 ? (
            <p className="text-xs text-mutedText py-2">No history recorded.</p>
          ) : (
            <div className="space-y-4">
              {history.map((h, idx) => (
                <div key={idx} className="flex items-start gap-3 text-xs">
                  <div className="w-2 h-2 rounded-full bg-surface-600 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-forest-900">
                      {h.to_status?.replace(/_/g, ' ') || 'Status changed'}{' '}
                      <span className="text-mutedText font-normal">
                        ({formatDateTime(h.created_at)})
                      </span>
                    </div>
                    {h.reason && <p className="text-mutedText mt-0.5 italic">"{h.reason}"</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
};
