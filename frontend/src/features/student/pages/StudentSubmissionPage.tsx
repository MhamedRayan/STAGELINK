import { useCallback, useState } from 'react';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  FileDropzone,
  PageHeader,
  Skeleton,
  StatusPill,
  useToast,
} from '@/components/ui';
import { formatBytes, formatDateTime } from '@/lib/format';
import { normalizeError } from '@/lib/errors';
import {
  useDownloadSubmission,
  useMyInternships,
  useSubmissions,
  useUploadSubmission,
} from '../hooks';
import { S } from '../strings';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPT = ['.pdf', '.docx', '.pptx', '.jpg', '.jpeg', '.png', '.csv'];

/** Student Final Submission — Figma 25:1313. Only a file is uploaded (design-plan Δ). */
export function StudentSubmissionPage() {
  const toast = useToast();
  const internships = useMyInternships();
  const internship = internships.data?.items[0];
  const submissions = useSubmissions(internship?.id);
  const upload = useUploadSubmission();
  const download = useDownloadSubmission();
  const [inlineError, setInlineError] = useState<string | null>(null);

  const handleDownload = useCallback(
    async (submissionId: string, filename: string) => {
      try {
        await download.mutateAsync({ internshipId: internship?.id ?? '', submissionId, filename });
      } catch (error) {
        toast.error(normalizeError(error).message);
      }
    },
    [download, internship?.id, toast],
  );

  const handleSelect = useCallback(
    async (file: File) => {
      if (!internship) return;
      setInlineError(null);
      try {
        await upload.mutateAsync({ internshipId: internship.id, file });
        toast.success(S.submission.success);
      } catch (error) {
        const apiError = normalizeError(error);
        const message =
          apiError.code === 'submission_already_pending'
            ? S.submission.pendingError
            : apiError.code === 'submission_already_approved'
              ? S.submission.approvedError
              : apiError.message;
        setInlineError(message);
      }
    },
    [internship, toast, upload],
  );

  if (internships.isError) {
    return <ErrorState error={internships.error} onRetry={() => void internships.refetch()} />;
  }
  if (internships.isLoading) {
    return <Skeleton className="h-[600px] rounded-panel" />;
  }
  if (!internship) {
    return (
      <div className="max-w-content">
        <PageHeader title={S.submission.title} />
        <EmptyState title={S.submission.noInternship} message={S.submission.noInternshipBody} />
      </div>
    );
  }

  const rows = submissions.data ?? [];
  const latest = rows[0];
  const canUpload = (!latest || latest.status === 'REJECTED') && internship.status === 'in_progress';
  const rejection = rows.find((item) => item.status === 'REJECTED');

  return (
    <div className="max-w-content">
      <PageHeader title={S.submission.title} subtitle={S.submission.subtitle} />

      {submissions.isError ? (
        <div className="mt-6">
          <ErrorState error={submissions.error} onRetry={() => void submissions.refetch()} />
        </div>
      ) : submissions.isLoading ? (
        <Skeleton className="mt-6 h-[360px] rounded-panel" />
      ) : (
        <>
          {latest?.status === 'APPROVED' && (
            <section className="mt-6 rounded-panel bg-mint p-5">
              <p className="text-[13px] text-ink">{S.submission.approved}</p>
            </section>
          )}
          {latest?.status === 'SUBMITTED' && (
            <section className="mt-6 rounded-panel bg-mint p-5">
              <p className="text-[13px] text-ink">
                v{latest.version} {S.submission.underReview}
              </p>
            </section>
          )}
          {rejection?.review_reason && (
            <section className="mt-5 rounded-panel bg-mint p-5">
              <h2 className="text-[16px] font-semibold text-forest-900">
                {S.submission.revisionTitle} {rejection.version})
              </h2>
              <p className="mt-2 text-[13px] text-ink">{S.submission.revisionBody}</p>
              <p className="mt-2 text-[13px] font-medium text-forest-900">
                {S.submission.feedback} {rejection.review_reason}
              </p>
            </section>
          )}

          <section className="mt-5 rounded-panel bg-mint p-5">
            <h2 className="text-[16px] font-semibold text-forest-900">
              {canUpload
                ? latest
                  ? S.submission.newVersion
                  : S.submission.submit
                : S.submission.title}
            </h2>
            <div className="mt-4 max-w-[560px]">
              {canUpload ? (
                <FileDropzone
                  accept={ACCEPT}
                  maxBytes={MAX_UPLOAD_BYTES}
                  onSelect={(file) => void handleSelect(file)}
                  error={inlineError ?? undefined}
                />
              ) : (
                <p className="text-[13px] text-muted">
                  {latest?.status === 'APPROVED' ? S.submission.approved : S.submission.notStarted}
                </p>
              )}
              {upload.isPending && (
                <p className="mt-2 text-[12px] text-muted" role="status">
                  {S.submission.uploading}
                </p>
              )}
            </div>
          </section>

          <section className="mt-5 rounded-panel bg-mint p-5">
            <h2 className="text-[16px] font-semibold text-forest-900">{S.submission.history}</h2>
            <div className="mt-4">
              <DataTable
                columns={[
                  {
                    key: 'version',
                    header: S.submission.version,
                    render: (row) => `v${row.version}`,
                    width: '100px',
                  },
                  {
                    key: 'uploaded',
                    header: S.submission.uploadedOn,
                    render: (row) => formatDateTime(row.created_at),
                  },
                  {
                    key: 'size',
                    header: S.submission.size,
                    render: (row) => formatBytes(row.size_bytes),
                    width: '120px',
                  },
                  {
                    key: 'status',
                    header: S.applications.status,
                    render: (row) => <StatusPill domain="submission" value={row.status} />,
                  },
                  {
                    key: 'download',
                    header: S.submission.download,
                    align: 'right',
                    render: (row) => (
                      <Button
                        variant="link"
                        onClick={() => void handleDownload(row.id, row.original_filename)}
                      >
                        {row.original_filename}
                      </Button>
                    ),
                  },
                ]}
                rows={rows}
                getRowKey={(row) => row.id}
                emptyState={<p className="py-8 text-center text-[13px] text-muted">{S.submission.historyEmpty}</p>}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
