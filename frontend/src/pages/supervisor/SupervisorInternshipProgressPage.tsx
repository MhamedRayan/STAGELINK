import { Link, useParams } from 'react-router-dom';
import {
  useCompanyProfile,
  useInternship,
  useOffer,
  useSubmissions,
} from '@/lib/queries';
import { internshipsApi } from '@/lib/api/internships';
import { displayUserName } from '@/lib/demo/directory';
import { formatBytes, formatDate } from '@/lib/format';
import { internshipStatuses, statusMeta, submissionStatuses } from '@/lib/status';
import {
  Card,
  ErrorState,
  LoadingBlock,
  PageHeader,
  StatusPill,
  Table,
  Td,
  Th,
} from '@/components/ui';

const STEPS = ['confirmed', 'in_progress', 'completed'];

export function SupervisorInternshipProgressPage() {
  const { internshipId } = useParams<{ internshipId: string }>();
  const internship = useInternship(internshipId);
  const offer = useOffer(internship.data?.offer_id);
  const company = useCompanyProfile(internship.data?.company_user_id);
  const submissions = useSubmissions(internshipId);

  if (internship.isLoading) return <LoadingBlock label="Loading internship…" />;
  if (internship.isError || !internship.data) {
    return (
      <ErrorState
        message="This internship could not be loaded."
        onRetry={() => void internship.refetch()}
      />
    );
  }

  const record = internship.data;
  const stepIndex = STEPS.indexOf(record.status);
  const versions = [...(submissions.data?.results ?? [])].sort((a, b) => b.version - a.version);

  return (
    <div>
      <Link
        to={`/app/supervisor/students/${record.id}`}
        className="mb-5 inline-flex text-sm font-semibold text-muted hover:text-forest-900"
      >
        ← Back to student profile
      </Link>

      <PageHeader
        title={offer.data?.title ?? 'Internship'}
        subtitle={`${company.data?.legal_name || 'Company'} • ${formatDate(
          record.start_date,
        )} → ${formatDate(record.end_date)}`}
        action={<StatusPill meta={statusMeta(internshipStatuses, record.status)} />}
      />

      <Card className="mb-6">
        <div className="flex items-center">
          {STEPS.map((step, index) => {
            const reached = stepIndex >= index;
            return (
              <div key={step} className="flex flex-1 items-center last:flex-none">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      reached
                        ? 'grid h-7 w-7 place-items-center rounded-full bg-forest-900 text-xs font-bold text-inverse'
                        : 'grid h-7 w-7 place-items-center rounded-full bg-mint text-xs font-bold text-muted'
                    }
                  >
                    {index + 1}
                  </span>
                  <span
                    className={
                      reached ? 'text-xs font-semibold text-forest-900' : 'text-xs text-muted'
                    }
                  >
                    {statusMeta(internshipStatuses, step).label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <span
                    className={
                      stepIndex > index
                        ? 'mx-3 h-0.5 flex-1 bg-forest-900'
                        : 'mx-3 h-0.5 flex-1 bg-mint'
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-forest-900">Student contact</h2>
            <p className="mt-3 text-sm font-semibold text-forest-900">
              {displayUserName(record.student_user_id, 'Student')}
            </p>
            <p className="mt-1 text-xs text-muted">
              Student ID {record.student_user_id.slice(0, 8)}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              The API does not expose student email or phone. Academic details are not available
              to supervisors.
            </p>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-forest-900">Company contact</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted">Company</dt>
                <dd className="font-semibold text-forest-900">
                  {company.data?.legal_name || 'Company'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Address</dt>
                <dd className="text-forest-900/80">{company.data?.address || 'Not provided'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Website</dt>
                <dd className="truncate text-forest-900/80">
                  {company.data?.website || 'Not provided'}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-forest-900">Related files</h2>
            {versions.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                No submission has been uploaded for this internship yet.
              </p>
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
                    {versions.map((version) => (
                      <tr key={version.id}>
                        <Td className="font-semibold text-forest-900">v{version.version}</Td>
                        <Td>
                          <span className="block max-w-[220px] truncate">
                            {version.original_filename}
                          </span>
                          <span className="text-xs text-muted">
                            {formatBytes(version.size_bytes)}
                          </span>
                        </Td>
                        <Td className="text-muted">{formatDate(version.created_at)}</Td>
                        <Td>
                          <StatusPill meta={statusMeta(submissionStatuses, version.status)} />
                        </Td>
                        <Td className="text-right">
                          <button
                            type="button"
                            className="text-xs font-semibold text-forest-900 underline"
                            onClick={() =>
                              void internshipsApi.downloadSubmission(
                                record.id,
                                version.id,
                                version.original_filename,
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
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Actions</h2>
            <Link
              to={`/app/supervisor/reviews/${record.id}`}
              className="mt-3 block text-xs font-semibold text-forest-900 underline"
            >
              Open final review & evaluation
            </Link>
            <Link
              to={`/app/supervisor/students/${record.id}`}
              className="mt-2 block text-xs font-semibold text-forest-900 underline"
            >
              Back to student profile
            </Link>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted">Start date</dt>
                <dd className="font-semibold text-forest-900">{formatDate(record.start_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">End date</dt>
                <dd className="font-semibold text-forest-900">{formatDate(record.end_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Submissions</dt>
                <dd className="font-semibold text-forest-900">{versions.length}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
