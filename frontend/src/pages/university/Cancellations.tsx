import React, { useState, useEffect } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { formatDate } from '../../utils/formatters';
import { resolveUserName } from '../../demo/directory';
import { Table, Column } from '../../components/ui/Table';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';

interface CancellationRecord {
  id: string;
  internship_id: string;
  internship_title: string;
  requested_by_user_id: string;
  requested_by_name: string;
  reason: string;
  status: string;
  created_at: string;
}

export const UniversityCancellations: React.FC = () => {
  const [cancellations, setCancellations] = useState<CancellationRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reject Modal state
  const [rejectingItem, setRejectingItem] = useState<CancellationRecord | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadCancellations = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch internships (bounded to first 100 per design-plan §3.4)
      const internRes = await apiRequest<{ results: any[] }>(
        '/svc/internships/api/internships/',
        { params: { limit: 100 } }
      );

      const items = internRes.results || [];
      const aggregated: CancellationRecord[] = [];

      await Promise.all(
        items.map(async (i) => {
          try {
            const reqs = await apiRequest<any[]>(
              `/svc/internships/api/internships/${i.id}/cancellation-requests/`
            );
            if (Array.isArray(reqs)) {
              reqs.forEach((r) => {
                aggregated.push({
                  ...r,
                  internship_id: i.id,
                  internship_title: `Internship · ${i.id.slice(0, 6)}`,
                  requested_by_name: resolveUserName(r.requested_by_user_id, 'Requester'),
                });
              });
            }
          } catch {
            // silent
          }
        })
      );

      setCancellations(aggregated);
    } catch (err: any) {
      console.error('Failed to load cancellation requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCancellations();
  }, []);

  const handleApprove = async (record: CancellationRecord) => {
    setActionError(null);
    try {
      await apiRequest(
        `/svc/internships/api/internships/${record.internship_id}/cancellation-requests/${record.id}/approve/`,
        { method: 'POST' }
      );
      loadCancellations();
    } catch (err: any) {
      setActionError(err.message || 'Approval failed.');
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItem) return;
    setModalError(null);

    if (!rejectReason.trim()) {
      setModalError('Please specify the reason for refusing cancellation.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(
        `/svc/internships/api/internships/${rejectingItem.internship_id}/cancellation-requests/${rejectingItem.id}/reject/`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: rejectReason }),
        }
      );
      setRejectingItem(null);
      setRejectReason('');
      loadCancellations();
    } catch (err: any) {
      setModalError(err.message || 'Rejection failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<CancellationRecord>[] = [
    {
      header: 'Placement',
      accessorKey: 'internship_title',
      className: 'font-semibold text-forest-900',
    },
    {
      header: 'Requested By',
      accessorKey: 'requested_by_name',
      className: 'text-mutedText',
    },
    {
      header: 'Requested on',
      cell: (item) => formatDate(item.created_at),
      className: 'text-mutedText',
    },
    {
      header: 'Reason',
      accessorKey: 'reason',
      className: 'text-forest-900 max-w-sm truncate text-xs',
    },
    {
      header: 'Status',
      cell: (item) => <StatusPill status={item.status} type="cancellation" />,
    },
    {
      header: 'University Decision',
      className: 'text-right',
      cell: (item) => (
        <div className="flex items-center justify-end gap-2">
          {item.status === 'pending' ? (
            <>
              <Button
                size="sm"
                onClick={() => handleApprove(item)}
                className="bg-forest-900 text-inverseText text-xs h-8 px-3"
              >
                <Check className="w-3.5 h-3.5 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRejectingItem(item);
                  setRejectReason('');
                }}
                className="text-red-600 border-red-300 hover:bg-red-50 text-xs h-8 px-3"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Reject
              </Button>
            </>
          ) : (
            <span className="text-xs text-mutedText">Processed</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-forest-900 tracking-tight">
          Cancellation Requests
        </h1>
        <p className="text-xs text-mutedText mt-1">
          Review and decide on early placement cancellation requests submitted by students or companies.
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
          data={cancellations}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          emptyMessage="No cancellation requests submitted."
        />
      </div>

      {/* Reject Modal */}
      <Modal
        isOpen={!!rejectingItem}
        onClose={() => setRejectingItem(null)}
        title="Refuse Cancellation Request"
      >
        <form onSubmit={handleConfirmReject} className="space-y-4">
          <p className="text-xs text-mutedText">
            Provide the administrative reason why this cancellation request is rejected. The internship will remain active.
          </p>

          {modalError && (
            <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {modalError}
            </div>
          )}

          <Textarea
            label="Mandatory Reason"
            required
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Contractual agreement cannot be voided without supervisor arbitration..."
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-mint-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectingItem(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isSubmitting}
            >
              Confirm Rejection
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
