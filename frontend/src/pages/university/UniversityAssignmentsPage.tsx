import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { internshipsApi } from '@/lib/api/internships';
import type { Internship } from '@/lib/api/types';
import { useInternships } from '@/lib/queries';
import { listDirectoryUsers, displayUserName } from '@/lib/demo/directory';
import { formatDate } from '@/lib/format';
import { internshipStatuses, statusMeta } from '@/lib/status';
import { CompanyName } from '@/components/CompanyName';
import { OfferTitle, StudentName, SupervisorName } from '@/components/EntityName';
import { useToast } from '@/components/Toast';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  StatusPill,
  Table,
  Td,
  Th,
} from '@/components/ui';

export function UniversityAssignmentsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const internships = useInternships({ limit: 100 });
  const [selected, setSelected] = useState<Internship | null>(null);
  const [supervisorId, setSupervisorId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const supervisors = useMemo(() => listDirectoryUsers('supervisor'), []);

  const rows = (internships.data?.results ?? []).filter((item) =>
    ['confirmed', 'in_progress'].includes(item.status),
  );

  const assign = useMutation({
    mutationFn: () =>
      internshipsApi.assignSupervisor(
        selected!.id,
        supervisorId.trim(),
        selected!.supervisor_user_id ? reason.trim() || undefined : undefined,
      ),
    onSuccess: () => {
      toast.success('Supervisor assigned.');
      setSelected(null);
      setSupervisorId('');
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['internships'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not assign the supervisor.');
    },
  });

  return (
    <div>
      <PageHeader
        title="Supervisor Assignment"
        subtitle="Assign a supervisor to each confirmed internship. Reassignments require a reason."
      />

      {internships.isLoading ? (
        <LoadingBlock label="Loading internships…" />
      ) : internships.isError ? (
        <ErrorState onRetry={() => void internships.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No internships need a supervisor"
          description="Confirmed and in-progress internships appear here."
        />
      ) : (
        <div className="rounded-card border border-forest-900/5 bg-white p-6 shadow-sm">
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Company</Th>
                <Th>Internship</Th>
                <Th>Confirmed on</Th>
                <Th>Status</Th>
                <Th>Supervisor</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((internship) => (
                <tr key={internship.id}>
                  <Td className="font-semibold text-forest-900">
                    <StudentName userId={internship.student_user_id} />
                  </Td>
                  <Td>
                    <CompanyName companyUserId={internship.company_user_id} />
                  </Td>
                  <Td>
                    <OfferTitle offerId={internship.offer_id} />
                  </Td>
                  <Td className="text-muted">{formatDate(internship.created_at)}</Td>
                  <Td>
                    <StatusPill meta={statusMeta(internshipStatuses, internship.status)} />
                  </Td>
                  <Td>
                    <SupervisorName userId={internship.supervisor_user_id} />
                  </Td>
                  <Td className="text-right">
                    <button
                      type="button"
                      className="text-xs font-semibold text-forest-900 underline"
                      onClick={() => {
                        setError(null);
                        setSelected(internship);
                        setSupervisorId(internship.supervisor_user_id ?? '');
                        setReason('');
                      }}
                    >
                      {internship.supervisor_user_id ? 'Reassign' : 'Assign supervisor'}
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <Modal
        open={Boolean(selected)}
        title={selected?.supervisor_user_id ? 'Reassign supervisor' : 'Assign supervisor'}
        onClose={() => setSelected(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button
              disabled={!supervisorId.trim() || assign.isPending}
              onClick={() => {
                setError(null);
                assign.mutate();
              }}
            >
              {assign.isPending ? 'Saving…' : 'Save assignment'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {selected && (
            <p className="rounded-lg bg-mint px-4 py-3 text-sm text-forest-900">
              <span className="font-semibold">
                <StudentName userId={selected.student_user_id} />
              </span>{' '}
              • <OfferTitle offerId={selected.offer_id} />
            </p>
          )}

          <Field
            label="Supervisor user ID"
            htmlFor="supervisor-id"
            hint={
              supervisors.length > 0
                ? 'Choose a supervisor from the demo directory or paste a UUID.'
                : 'Paste the supervisor UUID. A directory is not exposed by the API.'
            }
            required
          >
            <Input
              id="supervisor-id"
              list="supervisor-options"
              value={supervisorId}
              onChange={(event) => setSupervisorId(event.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
            <datalist id="supervisor-options">
              {supervisors.map((supervisor) => (
                <option key={supervisor.id} value={supervisor.id}>
                  {supervisor.name}
                </option>
              ))}
            </datalist>
          </Field>

          {supervisorId && displayUserName(supervisorId, 'Supervisor') && (
            <p className="text-xs text-muted">
              Selected: {displayUserName(supervisorId, 'Supervisor')}
            </p>
          )}

          {selected?.supervisor_user_id && (
            <Field label="Reason for reassignment" htmlFor="reassign-reason" required>
              <Input
                id="reassign-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why is the supervisor changing?"
              />
            </Field>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
