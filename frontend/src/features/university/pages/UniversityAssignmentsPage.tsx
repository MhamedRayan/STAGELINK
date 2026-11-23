import { useState } from 'react';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatusPill,
  Textarea,
  useToast,
} from '@/components/ui';
import { CompanyNameCell, OfferTitleCell } from '@/features/student/components/NameCells';
import { demoDirectoryUsers } from '@/features/directory/users';
import { normalizeError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { Internship } from '@/api/internships';
import { StudentNameCell } from '../components/NameCells';
import { useAssignSupervisor, useUniversityAssignments } from '../hooks';
import { S } from '../strings';

/** University Supervisor Assignment — Figma 28:876. Demo picker only when the directory is on. */
export function UniversityAssignmentsPage() {
  const toast = useToast();
  const assignments = useUniversityAssignments();
  const assign = useAssignSupervisor();
  const supervisors = demoDirectoryUsers('supervisor');
  const [selected, setSelected] = useState<Internship | null>(null);
  const [supervisorId, setSupervisorId] = useState('');
  const [customId, setCustomId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const open = (internship: Internship) => {
    setSelected(internship);
    setSupervisorId(
      internship.supervisor_user_id ?? (supervisors[0] ? supervisors[0].id : 'custom'),
    );
    setCustomId('');
    setReason('');
    setError(null);
  };

  const close = () => {
    if (!assign.isPending) setSelected(null);
  };

  const confirm = async () => {
    if (!selected) return;
    const target = supervisorId === 'custom' ? customId.trim() : supervisorId;
    if (!target) {
      setError(S.assignments.selectError);
      return;
    }
    const isReassignment = Boolean(selected.supervisor_user_id);
    if (isReassignment && !reason.trim()) {
      setError(S.assignments.reasonError);
      return;
    }
    setError(null);
    try {
      await assign.mutateAsync({
        internshipId: selected.id,
        supervisorUserId: target,
        reason: isReassignment ? reason : undefined,
      });
      toast.success(S.assignments.success);
      setSelected(null);
    } catch (caught) {
      setError(normalizeError(caught).message);
    }
  };

  return (
    <div className="max-w-content">
      <PageHeader title={S.assignments.title} subtitle={S.assignments.subtitle} />

      <div className="mt-5">
        {assignments.isError ? (
          <ErrorState error={assignments.error} onRetry={() => void assignments.refetch()} />
        ) : assignments.isLoading ? (
          <Skeleton className="h-[420px] rounded-panel" />
        ) : (
          <DataTable
            columns={[
              {
                key: 'student',
                header: S.common.student,
                render: (row) => <StudentNameCell userId={row.student_user_id} />,
              },
              {
                key: 'company',
                header: S.common.company,
                render: (row) => <CompanyNameCell companyId={row.company_user_id} />,
              },
              {
                key: 'offer',
                header: S.common.offer,
                render: (row) => <OfferTitleCell offerId={row.offer_id} />,
              },
              {
                key: 'date',
                header: S.assignments.confirmedOn,
                render: (row) => formatDate(row.created_at),
                width: '140px',
              },
              {
                key: 'status',
                header: S.common.status,
                render: (row) => <StatusPill domain="internship" value={row.status} />,
              },
              {
                key: 'action',
                header: S.common.action,
                align: 'right',
                render: (row) => (
                  <Button variant="secondary" size="sm" onClick={() => open(row)}>
                    {row.supervisor_user_id ? S.assignments.reassign : S.assignments.assign}
                  </Button>
                ),
              },
            ]}
            rows={assignments.data ?? []}
            getRowKey={(row) => row.id}
            emptyState={<EmptyState title={S.assignments.title} message={S.assignments.empty} />}
          />
        )}
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={close}
        title={
          selected?.supervisor_user_id ? S.assignments.modalReassign : S.assignments.modalAssign
        }
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={assign.isPending}>
              {S.common.cancel}
            </Button>
            <Button onClick={() => void confirm()} isLoading={assign.isPending}>
              {S.assignments.confirm}
            </Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <p className="text-[13px] leading-5 text-ink">
              {S.assignments.modalPrefix} <StudentNameCell userId={selected.student_user_id} />{' '}
              {S.assignments.modalMiddle} <CompanyNameCell companyId={selected.company_user_id} />.
            </p>
            {supervisors.length > 0 && (
              <Field label={S.assignments.picker}>
                <Select value={supervisorId} onChange={(event) => setSupervisorId(event.target.value)}>
                  {supervisors.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.department ?? S.supervisors.faculty})
                    </option>
                  ))}
                  {selected.supervisor_user_id &&
                    !supervisors.some((user) => user.id === selected.supervisor_user_id) && (
                      <option value={selected.supervisor_user_id}>
                        {selected.supervisor_user_id}
                      </option>
                    )}
                  <option value="custom">{S.assignments.custom}</option>
                </Select>
              </Field>
            )}
            {(supervisorId === 'custom' || supervisors.length === 0) && (
              <Field label={S.assignments.custom}>
                <Input
                  value={customId}
                  onChange={(event) => setCustomId(event.target.value)}
                  placeholder={S.assignments.customPlaceholder}
                />
              </Field>
            )}
            {selected.supervisor_user_id && (
              <Field label={S.assignments.reason}>
                <Textarea
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={S.assignments.reasonPlaceholder}
                />
              </Field>
            )}
            {error && (
              <p role="alert" className="text-[12px] leading-4 text-pill-danger-fg">
                {error}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
