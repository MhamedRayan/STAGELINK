import React, { useState, useEffect } from 'react';
import { UserCheck, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { formatDate } from '../../utils/formatters';
import { resolveUserName, getDemoDirectoryUsers } from '../../demo/directory';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Select, Input } from '../../components/ui/Input';

interface InternshipItem {
  id: string;
  offer_id: string;
  student_user_id: string;
  company_user_id: string;
  supervisor_user_id?: string;
  status: string;
  created_at: string;
  offer_title?: string;
  company_name?: string;
  student_name?: string;
  supervisor_name?: string;
}

export const UniversitySupervisorAssignment: React.FC = () => {
  const [internships, setInternships] = useState<InternshipItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal Assignment state
  const [selectedInternship, setSelectedInternship] = useState<InternshipItem | null>(null);
  const [supervisorId, setSupervisorId] = useState<string>('');
  const [customSupervisorUuid, setCustomSupervisorUuid] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const demoUsers = getDemoDirectoryUsers();
  const supervisorsList = Object.entries(demoUsers)
    .filter(([_, u]) => u.role === 'supervisor')
    .map(([id, u]) => ({
      value: id,
      label: `${u.name} (${u.department || 'Faculty'})`,
    }));

  const loadInternships = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ results: InternshipItem[] }>(
        '/svc/internships/api/internships/',
        { params: { limit: 100 } }
      );

      const items = (res.results || []).filter(
        (i) => i.status === 'confirmed' || i.status === 'in_progress'
      );

      const enriched = await Promise.all(
        items.map(async (i) => {
          let offer_title = `Internship · ${i.offer_id.slice(0, 6)}`;
          let company_name = resolveUserName(i.company_user_id, 'Company');

          try {
            const offer = await apiRequest<{ title: string; company_user_id: string }>(
              `/svc/offers/api/offers/${i.offer_id}/`
            );
            offer_title = offer.title;
            const comp = await apiRequest<{ legal_name?: string }>(
              `/svc/identity/api/companies/${offer.company_user_id}/profile/`
            );
            if (comp.legal_name) company_name = comp.legal_name;
          } catch {
            // fallback
          }

          return {
            ...i,
            offer_title,
            company_name,
            student_name: resolveUserName(i.student_user_id, 'Student'),
            supervisor_name: i.supervisor_user_id
              ? resolveUserName(i.supervisor_user_id, 'Supervisor')
              : 'Unassigned',
          };
        })
      );

      setInternships(enriched);
    } catch (err: any) {
      setActionError(err.message || 'Failed to load internships.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInternships();
    if (supervisorsList.length > 0) {
      setSupervisorId(supervisorsList[0].value);
    }
  }, []);

  const handleOpenAssignModal = (internship: InternshipItem) => {
    setSelectedInternship(internship);
    setSupervisorId(internship.supervisor_user_id || supervisorsList[0]?.value || 'custom');
    setCustomSupervisorUuid('');
    setReassignReason('');
    setModalError(null);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInternship) return;
    setModalError(null);

    const targetSupervisorId =
      supervisorId === 'custom' ? customSupervisorUuid.trim() : supervisorId;

    if (!targetSupervisorId) {
      setModalError('Please select or enter a supervisor ID.');
      return;
    }

    // Reassignment requires a reason per contracts/internships.yaml
    const isReassignment = Boolean(selectedInternship.supervisor_user_id);
    if (isReassignment && !reassignReason.trim()) {
      setModalError('Please provide a reason for reassigning the supervisor.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(
        `/svc/internships/api/internships/${selectedInternship.id}/assign-supervisor/`,
        {
          method: 'POST',
          body: JSON.stringify({
            supervisor_user_id: targetSupervisorId,
            reason: isReassignment ? reassignReason : undefined,
          }),
        }
      );
      setSelectedInternship(null);
      loadInternships();
    } catch (err: any) {
      setModalError(err.message || 'Failed to assign supervisor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<InternshipItem>[] = [
    {
      header: 'Student',
      accessorKey: 'student_name',
      className: 'font-semibold text-forest-900',
    },
    {
      header: 'Host Company',
      accessorKey: 'company_name',
      className: 'text-mutedText',
    },
    {
      header: 'Internship Offer',
      accessorKey: 'offer_title',
      className: 'text-mutedText',
    },
    {
      header: 'Confirmed on',
      cell: (item) => formatDate(item.created_at),
      className: 'text-mutedText',
    },
    {
      header: 'Assigned Supervisor',
      cell: (item) => (
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-md ${
            item.supervisor_user_id
              ? 'bg-mint-100 text-forest-900 border border-mint-300'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}
        >
          {item.supervisor_name}
        </span>
      ),
    },
    {
      header: 'Action',
      className: 'text-right',
      cell: (item) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleOpenAssignModal(item)}
          className="text-xs"
        >
          <UserCheck className="w-3.5 h-3.5 mr-1" />
          {item.supervisor_user_id ? 'Reassign' : 'Assign'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-forest-900 tracking-tight">
          Supervisor Assignment
        </h1>
        <p className="text-xs text-mutedText mt-1">
          Assign an academic supervisor to each confirmed internship to guide the student and evaluate their final submission.
        </p>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-mint-300/60 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={internships}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          emptyMessage="No confirmed internships currently active."
        />
      </div>

      {/* Assignment Modal */}
      <Modal
        isOpen={!!selectedInternship}
        onClose={() => setSelectedInternship(null)}
        title={
          selectedInternship?.supervisor_user_id
            ? 'Reassign Academic Supervisor'
            : 'Assign Academic Supervisor'
        }
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <p className="text-xs text-mutedText">
            Assigning supervisor for{' '}
            <span className="font-semibold text-forest-900">{selectedInternship?.student_name}</span>{' '}
            at{' '}
            <span className="font-semibold text-forest-900">{selectedInternship?.company_name}</span>.
          </p>

          {modalError && (
            <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {modalError}
            </div>
          )}

          <Select
            label="Select Supervisor"
            value={supervisorId}
            onChange={(e) => setSupervisorId(e.target.value)}
            options={[
              ...supervisorsList,
              { label: 'Enter specific Supervisor UUID...', value: 'custom' },
            ]}
          />

          {supervisorId === 'custom' && (
            <Input
              label="Supervisor UUID"
              required
              placeholder="e.g. 00000000-0000-0000-0000-000000000003"
              value={customSupervisorUuid}
              onChange={(e) => setCustomSupervisorUuid(e.target.value)}
            />
          )}

          {selectedInternship?.supervisor_user_id && (
            <Input
              label="Reassignment Reason (Mandatory)"
              required
              value={reassignReason}
              onChange={(e) => setReassignReason(e.target.value)}
              placeholder="e.g. Workload balancing, faculty leave, or specialty alignment..."
            />
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-mint-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedInternship(null)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Confirm Assignment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
