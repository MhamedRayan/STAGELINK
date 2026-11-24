import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { normalizeError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { fallbackLabel } from '@/lib/ids';
import type { Internship } from '@/api/internships';
import { StudentNameCell } from '../components/NameCells';
import {
  isAssignableInternship,
  useAssignSupervisor,
  useUniversityAssignments,
  useUniversityInternship,
  useUniversitySupervisorOptions,
} from '../hooks';
import { S } from '../strings';

/** University Supervisor Assignment — Figma 28:876. Picker uses the live scoped roster. */
export function UniversityAssignmentsPage() {
  const toast = useToast();
  const assignments = useUniversityAssignments();
  const assign = useAssignSupervisor();
  const supervisorOptions = useUniversitySupervisorOptions();
  const supervisors = useMemo(() => supervisorOptions.data ?? [], [supervisorOptions.data]);
  const [searchParams, setSearchParams] = useSearchParams();
  const targetId = searchParams.get('internship') ?? undefined;
  const isTargetListed = Boolean(
    targetId && assignments.data?.some((item) => item.id === targetId),
  );
  const fallback = useUniversityInternship(
    targetId && assignments.data && !isTargetListed ? targetId : undefined,
  );
  const [selected, setSelected] = useState<Internship | null>(null);
  const [supervisorId, setSupervisorId] = useState('');
  const [customId, setCustomId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const handledTarget = useRef<string | null>(null);

  const open = useCallback(
    (internship: Internship) => {
      setSelected(internship);
      setSupervisorId(
        internship.supervisor_user_id ?? (supervisors[0] ? supervisors[0].id : 'custom'),
      );
      setCustomId('');
      setReason('');
      setError(null);
    },
    [supervisors],
  );

  // Deep link from an Internships row: open that placement once, then drop the param.
  useEffect(() => {
    if (!targetId || handledTarget.current === targetId) return;
    if (!assignments.data || !supervisorOptions.isFetched) return;
    if (!isTargetListed && !fallback.isFetched) return;
    handledTarget.current = targetId;
    const row = assignments.data.find((item) => item.id === targetId) ?? fallback.data;
    if (row && isAssignableInternship(row.status)) {
      open(row);
    } else {
      toast.error(S.assignments.unavailable);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('internship');
    setSearchParams(next, { replace: true });
  }, [
    targetId,
    assignments.data,
    supervisorOptions.isFetched,
    isTargetListed,
    fallback.isFetched,
    fallback.data,
    open,
    searchParams,
    setSearchParams,
    toast,
  ]);

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
                      {user.name}
                    </option>
                  ))}
                  {selected.supervisor_user_id &&
                    !supervisors.some((user) => user.id === selected.supervisor_user_id) && (
                      <option value={selected.supervisor_user_id}>
                        {fallbackLabel('supervisor', selected.supervisor_user_id)}
                      </option>
                    )}
                  <option value="custom">{S.assignments.custom}</option>
                </Select>
              </Field>
            )}
            {supervisorOptions.isError && (
              <p role="alert" className="text-[12px] leading-4 text-pill-danger-fg">
                {S.assignments.optionsError}
              </p>
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
