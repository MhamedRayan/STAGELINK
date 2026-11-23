import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Edit3, CheckCircle, Ban, Trash2, AlertCircle } from 'lucide-react';
import { apiRequest, ApiError } from '../../api/client';
import { formatDate } from '../../utils/formatters';
import { Table, Column } from '../../components/ui/Table';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';

interface OfferItem {
  id: string;
  title: string;
  capacity: number;
  deadline: string;
  status: string;
  created_at: string;
}

interface OffersResponse {
  count: number;
  results: OfferItem[];
}

export const CompanyMyOffers: React.FC = () => {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Delete Draft Modal
  const [offerToDelete, setOfferToDelete] = useState<OfferItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Close Offer Confirmation Modal
  const [offerToClose, setOfferToClose] = useState<OfferItem | null>(null);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  const loadOffers = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<OffersResponse>('/svc/offers/api/offers/', {
        params: {
          mine: true,
          status: statusFilter || undefined,
          page,
          page_size: 20,
        },
      });
      setOffers(data.results || []);
      setTotalCount(data.count || 0);
    } catch (err: any) {
      console.error('Failed to load offers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOffers();
  }, [page, statusFilter]);

  const handlePublish = async (offer: OfferItem) => {
    setActionError(null);
    try {
      await apiRequest(`/svc/offers/api/offers/${offer.id}/publish/`, {
        method: 'POST',
      });
      loadOffers();
    } catch (err: any) {
      setActionError(err.message || 'Failed to publish offer.');
    }
  };

  const handleClose = async () => {
    if (!offerToClose) return;
    setActionError(null);
    setIsClosing(true);
    try {
      await apiRequest(`/svc/offers/api/offers/${offerToClose.id}/close/`, {
        method: 'POST',
      });
      setOfferToClose(null);
      loadOffers();
    } catch (err: any) {
      setActionError(err.message || 'Failed to close offer.');
    } finally {
      setIsClosing(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!offerToDelete) return;
    setActionError(null);
    setIsDeleting(true);
    try {
      await apiRequest(`/svc/offers/api/offers/${offerToDelete.id}/`, {
        method: 'DELETE',
      });
      setOfferToDelete(null);
      loadOffers();
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        setActionError('Cannot delete a published or active offer.');
      } else {
        setActionError(err.message || 'Failed to delete offer.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<OfferItem>[] = [
    {
      header: 'Offer Title',
      accessorKey: 'title',
      className: 'font-semibold text-forest-900',
    },
    {
      header: 'Places',
      cell: (item) => `${item.capacity} places`,
      className: 'text-mutedText',
    },
    {
      header: 'Application Deadline',
      cell: (item) => formatDate(item.deadline),
      className: 'text-mutedText',
    },
    {
      header: 'Status',
      cell: (item) => <StatusPill status={item.status} type="offer" />,
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (item) => (
        <div className="flex items-center justify-end gap-1.5">
          {item.status === 'draft' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handlePublish(item)}
              className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 h-8"
              title="Publish draft to make it live for students"
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Publish
            </Button>
          )}

          {item.status !== 'closed' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate(`/app/company/offers/${item.id}/edit`)}
              className="text-xs h-8"
              title="Edit offer details"
            >
              <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
          )}

          {item.status === 'published' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOfferToClose(item)}
              className="text-xs text-amber-700 hover:bg-amber-50 h-8"
              title="Close offer to stop incoming applications"
            >
              <Ban className="w-3.5 h-3.5 mr-1" /> Close
            </Button>
          )}

          {item.status === 'draft' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOfferToDelete(item)}
              className="text-xs text-red-600 hover:bg-red-50 h-8"
              title="Delete draft"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest-900 tracking-tight">My Offers</h1>
          <p className="text-xs text-mutedText mt-1">
            Manage your company listings, publish drafts, and control intake.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-white border border-mint-300 rounded-lg text-forest-900 focus:outline-none focus:ring-2 focus:ring-surface-600"
          >
            <option value="">All Statuses</option>
            <option value="draft">Drafts</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
          </select>

          <Button onClick={() => navigate('/app/company/offers/new')}>
            <PlusCircle className="w-4 h-4 mr-2" /> Post Internship
          </Button>
        </div>
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
          data={offers}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          emptyMessage="No offers created yet. Click 'Post Internship' to create your first listing."
        />

        <Pagination
          totalItems={totalCount}
          pageSize={20}
          currentPage={page}
          onPageChange={setPage}
        />
      </div>

      {/* Close Offer Confirmation Modal */}
      <Modal
        isOpen={!!offerToClose}
        onClose={() => setOfferToClose(null)}
        title="Close Internship Offer"
      >
        <div className="space-y-4">
          <p className="text-xs text-mutedText">
            Are you sure you want to close{' '}
            <span className="font-semibold text-forest-900">{offerToClose?.title}</span>?
            Students will no longer be able to submit applications.
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-mint-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOfferToClose(null)}
            >
              Keep Open
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleClose}
              isLoading={isClosing}
            >
              Confirm Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Draft Modal */}
      <Modal
        isOpen={!!offerToDelete}
        onClose={() => setOfferToDelete(null)}
        title="Delete Draft Offer"
      >
        <div className="space-y-4">
          <p className="text-xs text-mutedText">
            Are you sure you want to permanently delete this draft offer? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-mint-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOfferToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteDraft}
              isLoading={isDeleting}
            >
              Delete Draft
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
