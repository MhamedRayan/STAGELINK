import React, { useState, useEffect } from 'react';
import { Download, AlertCircle, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { apiRequest, downloadAuthenticatedFile, ApiError } from '../../api/client';
import { formatDateTime, formatFileSize } from '../../utils/formatters';
import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { SectionCard } from '../../components/ui/SectionCard';
import { StatusPill } from '../../components/ui/StatusPill';

interface SubmissionItem {
  id: string;
  internship_id: string;
  version: number;
  filename: string;
  file_size: number;
  status: string;
  rejection_reason?: string;
  created_at: string;
}

export const StudentFinalSubmission: React.FC = () => {
  const [internshipId, setInternshipId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const internRes = await apiRequest<{ results: any[] }>(
          '/svc/internships/api/internships/',
          { params: { mine: true } }
        );

        if (!isMounted) return;
        const current = (internRes.results || [])[0];

        if (current) {
          setInternshipId(current.id);
          const subs = await apiRequest<SubmissionItem[]>(
            `/svc/internships/api/internships/${current.id}/submissions/`
          );
          if (isMounted) {
            setSubmissions(Array.isArray(subs) ? subs : []);
          }
        }
      } catch (err) {
        console.error('Failed to load submissions:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpload = async () => {
    if (!internshipId || !selectedFile) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      await apiRequest(
        `/svc/internships/api/internships/${internshipId}/submissions/`,
        {
          method: 'POST',
          body: formData,
        }
      );

      setSuccessMessage('Final work submitted successfully for supervisor review.');
      setSelectedFile(null);

      // Refresh submissions
      const updated = await apiRequest<SubmissionItem[]>(
        `/svc/internships/api/internships/${internshipId}/submissions/`
      );
      setSubmissions(Array.isArray(updated) ? updated : []);
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'SUBMISSION_ALREADY_PENDING') {
          setErrorMessage('A submission is already pending review by your supervisor.');
        } else if (err.code === 'SUBMISSION_ALREADY_APPROVED') {
          setErrorMessage('Your submission has already been approved.');
        } else {
          setErrorMessage(err.message || 'File upload failed.');
        }
      } else {
        setErrorMessage('Failed to upload file.');
      }
    } finally {
      setIsUploading(false);
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

  if (!internshipId) {
    return (
      <div className="py-16 text-center bg-white rounded-xl border border-mint-200 p-8">
        <h2 className="text-base font-bold text-forest-900 mb-1">No Active Internship</h2>
        <p className="text-xs text-mutedText">
          You must have a confirmed internship before submitting final project reports.
        </p>
      </div>
    );
  }

  // Check upload eligibility: allowed only when no submissions or latest was rejected
  const latestSub = submissions.length > 0 ? submissions[submissions.length - 1] : null;
  const canUpload = !latestSub || latestSub.status === 'REJECTED';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-forest-900 tracking-tight">Final Submission</h1>
        <p className="text-xs text-mutedText mt-1">
          Upload your final internship report and presentation files for supervisor review (Max 10 MB).
        </p>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-lg border border-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Latest Rejection Feedback Card if applicable */}
      {latestSub?.status === 'REJECTED' && (
        <div className="bg-red-50/70 border border-red-200 rounded-xl p-5 text-forest-900">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-red-950 mb-1">
                Resubmission Required (Version {latestSub.version})
              </h3>
              <p className="text-xs text-red-900/80 mb-2">
                Your supervisor requested revisions on your submitted work.
              </p>
              {latestSub.rejection_reason && (
                <div className="p-3 bg-white/80 rounded-lg text-xs border border-red-200">
                  <span className="font-semibold text-red-950">Feedback: </span>
                  <span>{latestSub.rejection_reason}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Dropzone */}
      {canUpload ? (
        <SectionCard title="Submit New Version">
          <div className="space-y-4">
            <FileDropzone
              onFileSelect={(file) => setSelectedFile(file)}
              maxSizeMB={10}
            />

            <div className="flex justify-end">
              <Button
                onClick={handleUpload}
                disabled={!selectedFile}
                isLoading={isUploading}
              >
                Submit Final Work
              </Button>
            </div>
          </div>
        </SectionCard>
      ) : (
        <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-900">
          {latestSub?.status === 'APPROVED' ? (
            <span className="font-medium">
              ✓ Your final submission has been approved! Your supervisor will record your evaluation grade shortly.
            </span>
          ) : (
            <span className="font-medium">
              ⏳ Version {latestSub?.version} is currently under review by your academic supervisor. Resubmissions are locked until review is completed.
            </span>
          )}
        </div>
      )}

      {/* Submissions History Table */}
      <SectionCard title="Submission History">
        {submissions.length === 0 ? (
          <p className="text-xs text-mutedText py-4">No submissions uploaded yet.</p>
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
                      <span className="text-mutedText font-normal truncate max-w-xs">
                        {sub.filename}
                      </span>
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
                    title="Download submission file"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" /> Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
};
