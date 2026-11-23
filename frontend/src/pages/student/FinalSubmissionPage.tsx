import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { internshipsApi } from '@/lib/api/internships';
import { useInternships, useSubmissions } from '@/lib/queries';
import { formatBytes, formatDate, formatDateTime } from '@/lib/format';
import { submissionStatuses, statusMeta } from '@/lib/status';
import { useToast } from '@/components/Toast';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  StatusPill,
  Table,
  Td,
  Th,
} from '@/components/ui';

const ALLOWED = ['.pdf', '.docx', '.pptx', '.jpg', '.jpeg', '.png', '.csv'];
const MAX_BYTES = 10 * 1024 * 1024;

export function FinalSubmissionPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const internships = useInternships({ mine: true, limit: 100 });
  const internship = (internships.data?.results ?? []).find((item) =>
    ['confirmed', 'in_progress', 'completed'].includes(item.status),
  );
  const submissions = useSubmissions(internship?.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: () => internshipsApi.uploadSubmission(internship!.id, file as File),
    onSuccess: () => {
      toast.success('Final work submitted for review.');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      void queryClient.invalidateQueries({ queryKey: ['submissions', internship?.id] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not upload the file.');
    },
  });

  if (internships.isLoading) return <LoadingBlock label="Loading internship…" />;
  if (internships.isError) return <ErrorState onRetry={() => void internships.refetch()} />;
  if (!internship) {
    return (
      <div>
        <PageHeader title="Final Submission" subtitle="Upload your final work for review." />
        <EmptyState
          title="No active internship"
          description="Final work can be submitted once your internship is confirmed."
          action={
            <Link to="/app/student/internship">
              <Button size="sm">View my internship</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const versions = [...(submissions.data?.results ?? [])].sort((a, b) => b.version - a.version);
  const latest = versions[0];
  const canUpload = !latest || latest.status === 'REJECTED';

  function chooseFile(selected: File | null) {
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    const extension = selected.name.slice(selected.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED.includes(extension)) {
      setError(`Unsupported file type. Use ${ALLOWED.join(', ')}.`);
      setFile(null);
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError('The file is larger than the 10 MB limit.');
      setFile(null);
      return;
    }
    setFile(selected);
  }

  return (
    <div>
      <PageHeader
        title="Final Submission"
        subtitle="Accepted formats: PDF, DOCX, PPTX, JPG, PNG, CSV. Maximum 10 MB."
      />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-forest-900">Submit final work</h2>
            {latest && (
              <div className="mt-3 rounded-lg bg-mint px-4 py-3 text-sm">
                <p className="font-semibold text-forest-900">
                  Latest version {latest.version} — {statusMeta(submissionStatuses, latest.status).label}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Uploaded {formatDateTime(latest.created_at)} • {formatBytes(latest.size_bytes)}
                </p>
                {latest.review_reason && (
                  <p className="mt-2 text-xs text-danger">
                    Supervisor feedback: {latest.review_reason}
                  </p>
                )}
              </div>
            )}

            {canUpload ? (
              <div className="mt-4">
                <div
                  className="rounded-card border-2 border-dashed border-sage/70 bg-canvas px-6 py-10 text-center"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    chooseFile(event.dataTransfer.files?.[0] ?? null);
                  }}
                >
                  <p className="text-sm font-semibold text-forest-900">
                    Drag a file here, or choose one from your computer
                  </p>
                  <p className="mt-1 text-xs text-muted">One file, up to 10 MB.</p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept={ALLOWED.join(',')}
                    className="sr-only"
                    id="submission-file"
                    onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={() => inputRef.current?.click()}
                  >
                    Choose file
                  </Button>
                  {file && (
                    <p className="mt-3 text-xs text-forest-900">
                      Selected: <span className="font-semibold">{file.name}</span> (
                      {formatBytes(file.size)})
                    </p>
                  )}
                </div>

                {error && (
                  <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
                    {error}
                  </p>
                )}

                <Button
                  className="mt-4"
                  disabled={!file || upload.isPending}
                  onClick={() => {
                    setError(null);
                    upload.mutate();
                  }}
                >
                  {upload.isPending ? 'Uploading…' : 'Submit final work'}
                </Button>
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-warning">
                {latest?.status === 'APPROVED'
                  ? 'Your final work has been approved. No further upload is needed.'
                  : 'Your latest version is awaiting review. You can upload again only if it is rejected.'}
              </p>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-forest-900">Submitted files</h2>
            {submissions.isLoading ? (
              <p className="mt-3 text-sm text-muted">Loading files…</p>
            ) : versions.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No file has been submitted yet.</p>
            ) : (
              <div className="mt-4">
                <Table>
                  <thead>
                    <tr>
                      <Th>Version</Th>
                      <Th>File</Th>
                      <Th>Uploaded</Th>
                      <Th>Status</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((item) => (
                      <tr key={item.id}>
                        <Td className="font-semibold text-forest-900">v{item.version}</Td>
                        <Td>
                          <span className="block max-w-[220px] truncate">{item.original_filename}</span>
                          <span className="text-xs text-muted">{formatBytes(item.size_bytes)}</span>
                        </Td>
                        <Td className="text-muted">{formatDate(item.created_at)}</Td>
                        <Td>
                          <StatusPill meta={statusMeta(submissionStatuses, item.status)} />
                        </Td>
                        <Td className="text-right">
                          <button
                            type="button"
                            className="text-xs font-semibold text-forest-900 underline"
                            onClick={() =>
                              void internshipsApi.downloadSubmission(
                                internship.id,
                                item.id,
                                item.original_filename,
                              )
                            }
                          >
                            Download
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card muted>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Submission rules
            </h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-forest-900/80">
              <li>• Only the file is stored; comments and repository links are not accepted.</li>
              <li>• A new version is allowed only when none exists or the latest was rejected.</li>
              <li>• The supervisor&apos;s approval completes the review stage.</li>
            </ul>
          </Card>
          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Internship
            </h2>
            <p className="mt-2 text-xs text-muted">
              {formatDate(internship.start_date)} → {formatDate(internship.end_date)}
            </p>
            <Link
              to="/app/student/internship"
              className="mt-3 inline-block text-xs font-semibold text-forest-900 underline"
            >
              Back to my internship
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
