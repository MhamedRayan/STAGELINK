import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useCompanyProfile,
  useEvaluation,
  useInternship,
  useInternshipHistory,
  useOffer,
  useSubmissions,
} from '@/lib/queries';
import { internshipsApi } from '@/lib/api/internships';
import { displayUserName } from '@/lib/demo/directory';
import { formatBytes, formatDate, formatDateTime, formatGrade } from '@/lib/format';
import { internshipStatuses, statusMeta, submissionStatuses } from '@/lib/status';
import {
  Card,
  ErrorState,
  LoadingBlock,
  PageHeader,
  StatCard,
  StatusPill,
  Table,
  Td,
  Th,
} from '@/components/ui';

const TABS = ['Overview', 'Internship', 'Submissions', 'Evaluation', 'History'] as const;
type Tab = (typeof TABS)[number];

export function SupervisorStudentPage() {
  const { internshipId } = useParams<{ internshipId: string }>();
  const [tab, setTab] = useState<Tab>('Overview');
  const internship = useInternship(internshipId);
  const offer = useOffer(internship.data?.offer_id);
  const company = useCompanyProfile(internship.data?.company_user_id);
  const submissions = useSubmissions(internshipId);
  const evaluation = useEvaluation(internshipId);
  const history = useInternshipHistory(internshipId);

  if (internship.isLoading) return <LoadingBlock label="Loading student…" />;
  if (internship.isError || !internship.data) {
    return <ErrorState message="This student could not be loaded." onRetry={() => void internship.refetch()} />;
  }

  const record = internship.data;
  const studentName = displayUserName(record.student_user_id, 'Student');
  const versions = [...(submissions.data?.results ?? [])].sort((a, b) => b.version - a.version);

  return (
    <div>
      <Link
        to="/app/supervisor/students"
        className="mb-5 inline-flex text-sm font-semibold text-muted hover:text-forest-900"
      >
        ← Back to my students
      </Link>

      <PageHeader
        title={studentName}
        subtitle={`Assigned student • ${offer.data?.title ?? 'Internship'} at ${
          company.data?.legal_name || 'Company'
        }`}
        action={<StatusPill meta={statusMeta(internshipStatuses, record.status)} />}
      />

      <div className="mb-6 flex gap-1 border-b border-forest-900/10">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={
              tab === item
                ? 'border-b-2 border-forest-900 px-4 py-2.5 text-sm font-semibold text-forest-900'
                : 'px-4 py-2.5 text-sm font-medium text-muted hover:text-forest-900'
            }
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid grid-cols-3 gap-6">
          <Card className="col-span-2">
            <h2 className="text-lg font-semibold text-forest-900">Student</h2>
            <p className="mt-3 text-sm font-semibold text-forest-900">{studentName}</p>
            <p className="mt-1 text-xs text-muted">Student ID {record.student_user_id.slice(0, 8)}</p>
            <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted">Offer</p>
                <p className="font-semibold text-forest-900">{offer.data?.title ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Company</p>
                <p className="font-semibold text-forest-900">{company.data?.legal_name || 'Company'}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Period</p>
                <p className="font-semibold text-forest-900">
                  {formatDate(record.start_date)} → {formatDate(record.end_date)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Location</p>
                <p className="font-semibold text-forest-900">{offer.data?.location ?? '—'}</p>
              </div>
            </div>
          </Card>
          <Card muted>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Progress</h2>
            <p className="mt-3 text-sm text-forest-900/80">
              {versions.length} submission version{versions.length === 1 ? '' : 's'}
            </p>
            <p className="mt-1 text-sm text-forest-900/80">
              {evaluation.data
                ? `Final grade ${formatGrade(evaluation.data.grade)} / 20`
                : 'Evaluation not recorded yet'}
            </p>
            <Link
              to={`/app/supervisor/reviews/${record.id}`}
              className="mt-4 inline-block text-xs font-semibold text-forest-900 underline"
            >
              Open final review
            </Link>
          </Card>
        </div>
      )}

      {tab === 'Internship' && (
        <div className="grid grid-cols-3 gap-6">
          <Card className="col-span-2">
            <h2 className="text-lg font-semibold text-forest-900">Placement details</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted">Status</p>
                <StatusPill meta={statusMeta(internshipStatuses, record.status)} />
              </div>
              <div>
                <p className="text-xs text-muted">Confirmed on</p>
                <p className="font-semibold text-forest-900">{formatDate(record.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Start</p>
                <p className="font-semibold text-forest-900">{formatDate(record.start_date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">End</p>
                <p className="font-semibold text-forest-900">{formatDate(record.end_date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Company address</p>
                <p className="text-forest-900/80">{company.data?.address || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Company website</p>
                <p className="truncate text-forest-900/80">{company.data?.website || 'Not provided'}</p>
              </div>
            </div>
          </Card>
          <Card muted>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Internship progress
            </h2>
            <Link
              to={`/app/supervisor/internships/${record.id}`}
              className="mt-3 inline-block text-xs font-semibold text-forest-900 underline"
            >
              Open progress page
            </Link>
          </Card>
        </div>
      )}

      {tab === 'Submissions' && (
        <Card>
          <h2 className="text-lg font-semibold text-forest-900">Submitted work</h2>
          {versions.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No submission has been uploaded.</p>
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
                        <span className="block max-w-[240px] truncate">{version.original_filename}</span>
                        <span className="text-xs text-muted">{formatBytes(version.size_bytes)}</span>
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
      )}

      {tab === 'Evaluation' && (
        <Card>
          <h2 className="text-lg font-semibold text-forest-900">Evaluation</h2>
          {evaluation.isLoading ? (
            <p className="mt-3 text-sm text-muted">Loading evaluation…</p>
          ) : evaluation.data ? (
            <div className="mt-3">
              <p className="text-2xl font-bold text-forest-900">
                {formatGrade(evaluation.data.grade)} / 20
              </p>
              <p className="mt-1 text-xs text-muted">
                Recorded {formatDateTime(evaluation.data.created_at)}
              </p>
              <p className="mt-3 whitespace-pre-line text-sm text-forest-900/80">
                {evaluation.data.comment || 'No comment provided.'}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">
              The evaluation tab is available once a final grade is recorded.
            </p>
          )}
        </Card>
      )}

      {tab === 'History' && (
        <Card>
          <h2 className="text-lg font-semibold text-forest-900">History</h2>
          {history.isLoading ? (
            <p className="mt-3 text-sm text-muted">Loading history…</p>
          ) : (history.data?.results.length ?? 0) === 0 ? (
            <p className="mt-3 text-sm text-muted">No history recorded.</p>
          ) : (
            <ol className="mt-4 space-y-4">
              {history.data?.results.map((entry) => {
                const record = entry as {
                  id?: string;
                  action?: string;
                  at?: string;
                  reason?: string;
                };
                return (
                  <li key={record.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sage" />
                    <div>
                      <p className="text-sm font-semibold text-forest-900">
                        {(record.action ?? 'updated').replaceAll('_', ' ')}
                      </p>
                      <p className="text-xs text-muted">{formatDateTime(record.at)}</p>
                      {record.reason && (
                        <p className="mt-1 text-xs text-forest-900/75">{record.reason}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      )}

      <div className="mt-6 grid grid-cols-3 gap-5">
        <StatCard label="Submissions" value={versions.length} />
        <StatCard
          label="Approved"
          value={versions.filter((version) => version.status === 'APPROVED').length}
        />
        <StatCard
          label="Pending review"
          value={versions.filter((version) => version.status === 'SUBMITTED').length}
        />
      </div>
    </div>
  );
}
