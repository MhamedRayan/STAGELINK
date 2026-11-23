import React, { useState, useEffect } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { formatDate } from '../../utils/formatters';
import { resolveUserName } from '../../demo/directory';
import { Table, Column } from '../../components/ui/Table';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';

interface ApplicationItem {
  id: string;
  offer_id: string;
  student_user_id: string;
  status: string;
  created_at: string;
  offer_title?: string;
  student_name?: string;
}

export const CompanyIncomingRequests: React.FC = () => {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reject Modal state
  const [rejectingApp, setRejectingApp] = useState<ApplicationItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [rejectModalError, setRejectModalError] = useState<string | null>(null);

  const limit = 20;

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const [appsRes, offersRes] = await Promise.all([
        apiRequest<{ results: ApplicationItem[]; pagination: { total: number } }>(
          '/svc/applications/api/applications/',
          {
            params: {
              limit,
              offset,
              status: statusFilter || undefined,
            },
          }
        ),
        apiRequest<{ results: { id: string; title: string }[] }>('/svc/offers/api/offers/', {
          params: { mine: true },
        }),
      ]);

      const myOffers = offersRes.results || [];
      const apps = appsRes.results || [];
      setTotalCount(appsRes.pagination?.total || apps.length);

      const enriched = apps.map((app) => {
        const matched = myOffers.find((o) => o.id === app.offer_id);
        return {
          ...app,
          offer_title: matched?.title || `Offer · ${app.offer_id.slice(0, 6)}`,
          student_name: resolveUserName(app.student_user_id, 'Student'),
        };
      });

      setApplications(enriched);
    } catch (err: any) {
      console.error('Failed to load applications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [offset, statusFilter]);

  const handleAccept = async (app: ApplicationItem) => {
    setActionError(null);
    try {
      await apiRequest(`/svc/applications/api/applications/${app.id}/company-decision/`, {
        method: 'POST',
        body: JSON.stringify({ decision: 'ACCEPT' }),
      });
      loadRequests();
    } catch (err: any) {
      setActionError(err.message || 'Failed to accept application.');
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingApp) return;
    setRejectModalError(null);

    if (!rejectReason.trim()) {
      setRejectModalError('Please provide a mandatory reason for declining this applicant.');
      return;
    }

    setIsRejecting(true);
    try {
      await apiRequest(
        `/svc/applications/api/applications/${rejectingApp.id}/company-decision/`,
        {
          method: 'POST',
          body: JSON.stringify({
            decision: 'REJECT',
            reason: rejectReason,
          }),
        }
      );
      setRejectingApp(null);
      setRejectReason('');
      loadRequests();
    } catch (err: any) {
      setRejectModalError(err.message || 'Failed to decline application.');
    } finally {
      setIsRejecting(false);
    }
  };

  const columns: Column<ApplicationItem>[] = [
    {
      header: 'Applicant',
      accessorKey: 'student_name',
      className: 'font-semibold text-forest-900',
    },
    {
      header: 'Applied For',
      accessorKey: 'offer_title',
      className: 'text-mutedText',
    },
    {
      header: 'Submitted on',
      cell: (item) => formatDate(item.created_at),
      className: 'text-mutedText',
    },
    {
      header: 'Status',
      cell: (item) => <StatusPill status={item.status} type="application" />,
    },
    {
      header: 'Decisions / Actions',
      className: 'text-right',
      cell: (item) => (
        <div className="flex items-center justify-end gap-2">
          {item.status === 'SUBMITTED' ? (
            <>
              <Button
                size="sm"
                onClick={() => handleAccept(item)}
                className="bg-forest-900 text-inverseText text-xs h-8 px-3"
              >
                <Check className="w-3.5 h-3.5 mr-1" /> Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRejectingApp(item);
                  setRejectReason('');
                }}
                className="text-red-600 border-red-300 hover:bg-red-50 text-xs h-8 px-3"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Refuse
              </Button>
            </>
          ) : (
            <span className="text-xs text-mutedText">Decided</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest-900 tracking-tight">Incoming Requests</h1>
          <p className="text-xs text-mutedText mt-1">
            Review student candidates and decide on placements. Accepted requests move to university validation.
          </p>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setOffset(0);
          }}
          className="px-3 py-2 text-xs bg-white border border-mint-300 rounded-lg text-forest-900 focus:outline-none focus:ring-2 focus:ring-surface-600"
        >
          <option value="">All Statuses</option>
          <option value="SUBMITTED">Awaiting Decision (Submitted)</option>
          <option value="COMPANY_ACCEPTED">Accepted by You</option>
          <option value="UNIVERSITY_VALIDATED">Validated by University</option>
          <option value="CONFIRMED">Confirmed Placements</option>
          <option value="COMPANY_REJECTED">Declined by You</option>
        </select>
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
          data={applications}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          emptyMessage="No applications received matching your selection."
        />

        <Pagination
          totalItems={totalCount}
          pageSize={limit}
          currentPage={Math.floor(offset / limit) + 1}
          onPageChange={(page) => setOffset((page - 1) * limit)}
        />
      </div>

      {/* Refuse Modal */}
      <Modal
        isOpen={!!rejectingApp}
        onClose={() => setRejectingApp(null)}
        title="Decline Candidate Application"
      >
        <form onSubmit={handleConfirmReject} className="space-y-4">
          <p className="text-xs text-mutedText">
            Provide feedback explaining why this candidate was not selected for{' '}
            <span className="font-semibold text-forest-900">{rejectingApp?.offer_title}</span>.
            This reason will be shared directly with the student.
          </p>

          {rejectModalError && (
            <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {rejectModalError}
            </div>
          )}

          <Textarea
            label="Mandatory Reason"
            required
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Position filled, prerequisite qualifications not met, or scheduling misalignment..."
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-mint-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectingApp(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isRejecting}
            >
              Confirm Decline
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
