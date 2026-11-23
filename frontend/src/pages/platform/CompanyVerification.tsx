import React, { useState, useEffect } from 'react';
import { Building2, Check, X, AlertCircle, ExternalLink } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { formatDate } from '../../utils/formatters';
import { Table, Column } from '../../components/ui/Table';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';

interface CompanyItem {
  user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  verification_status: string;
  legal_name?: string;
  address?: string;
  contact_person?: string;
  phone?: string;
  website?: string;
  description?: string;
  rejection_reason?: string;
  created_at: string;
}

interface CompaniesResponse {
  count: number;
  results: CompanyItem[];
}

export const PlatformCompanyVerification: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Detail / Review Drawer state
  const [selectedCompany, setSelectedCompany] = useState<CompanyItem | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Reject modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [rejectModalError, setRejectModalError] = useState<string | null>(null);

  const loadCompanies = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<CompaniesResponse>(
        '/svc/identity/api/admin/companies/',
        {
          params: {
            page,
            status: statusFilter || undefined,
          },
        }
      );
      setCompanies(data.results || []);
      setTotalCount(data.count || 0);
    } catch (err: any) {
      console.error('Failed to load companies:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, [page, statusFilter]);

  const handleVerify = async (company: CompanyItem) => {
    setActionError(null);
    setIsVerifying(true);
    try {
      await apiRequest(
        `/svc/identity/api/admin/companies/${company.user_id}/verify/`,
        { method: 'POST' }
      );
      setSelectedCompany(null);
      loadCompanies();
    } catch (err: any) {
      setActionError(err.message || 'Failed to verify company.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    setRejectModalError(null);

    if (!rejectReason.trim()) {
      setRejectModalError('Please specify the reason for rejecting company verification.');
      return;
    }

    setIsRejecting(true);
    try {
      await apiRequest(
        `/svc/identity/api/admin/companies/${selectedCompany.user_id}/reject/`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: rejectReason }),
        }
      );
      setIsRejectModalOpen(false);
      setSelectedCompany(null);
      setRejectReason('');
      loadCompanies();
    } catch (err: any) {
      setRejectModalError(err.message || 'Failed to reject verification.');
    } finally {
      setIsRejecting(false);
    }
  };

  const columns: Column<CompanyItem>[] = [
    {
      header: 'Company Name',
      cell: (item) => (
        <div>
          <div className="font-semibold text-forest-900">{item.name || item.legal_name}</div>
          <div className="text-[11px] text-mutedText">{item.email}</div>
        </div>
      ),
    },
    {
      header: 'Contact / Location',
      cell: (item) => (
        <div className="text-xs text-mutedText">
          <div>{item.contact_person || 'Not provided'}</div>
          <div>{item.address || 'No address'}</div>
        </div>
      ),
    },
    {
      header: 'Registered',
      cell: (item) => formatDate(item.created_at),
      className: 'text-mutedText text-xs',
    },
    {
      header: 'Status',
      cell: (item) => <StatusPill status={item.verification_status} type="verification" />,
    },
    {
      header: 'Action',
      className: 'text-right',
      cell: (item) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSelectedCompany(item)}
          className="text-xs"
        >
          Inspect & Decide
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest-900 tracking-tight">
            Company Verification
          </h1>
          <p className="text-xs text-mutedText mt-1">
            Companies stay inactive until manually verified and activated by the platform administrator.
          </p>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-xs bg-white border border-mint-300 rounded-lg text-forest-900 focus:outline-none focus:ring-2 focus:ring-surface-600"
        >
          <option value="pending">Pending Verification</option>
          <option value="active">Active (Verified)</option>
          <option value="rejected">Rejected</option>
          <option value="">All Companies</option>
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
          data={companies}
          keyExtractor={(item) => item.user_id}
          isLoading={isLoading}
          emptyMessage="No companies found matching the filter."
        />

        <Pagination
          totalItems={totalCount}
          pageSize={20}
          currentPage={page}
          onPageChange={setPage}
        />
      </div>

      {/* Inspect & Decide Modal */}
      <Modal
        isOpen={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
        title="Company Verification Details"
        maxWidth="lg"
      >
        {selectedCompany && (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-mint flex items-center justify-center text-surface-700 font-bold shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-forest-900">
                    {selectedCompany.name || selectedCompany.legal_name}
                  </h3>
                  <StatusPill status={selectedCompany.verification_status} type="verification" />
                </div>
                <p className="text-xs text-mutedText">{selectedCompany.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs p-4 bg-mint-50/50 rounded-xl border border-mint-200">
              <div>
                <span className="text-mutedText">Legal Entity Name</span>
                <p className="font-semibold text-forest-900">{selectedCompany.legal_name || 'Not provided'}</p>
              </div>
              <div>
                <span className="text-mutedText">Contact Person</span>
                <p className="font-semibold text-forest-900">{selectedCompany.contact_person || 'Not provided'}</p>
              </div>
              <div>
                <span className="text-mutedText">Phone</span>
                <p className="font-semibold text-forest-900">{selectedCompany.phone || 'Not provided'}</p>
              </div>
              <div>
                <span className="text-mutedText">Website</span>
                {selectedCompany.website ? (
                  <a
                    href={selectedCompany.website.startsWith('http') ? selectedCompany.website : `https://${selectedCompany.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-surface-700 hover:underline flex items-center gap-1"
                  >
                    {selectedCompany.website} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="font-semibold text-forest-900">Not provided</p>
                )}
              </div>
              <div className="md:col-span-2">
                <span className="text-mutedText">Physical Address</span>
                <p className="font-semibold text-forest-900">{selectedCompany.address || 'Not provided'}</p>
              </div>
              {selectedCompany.description && (
                <div className="md:col-span-2 pt-2 border-t border-mint-200">
                  <span className="text-mutedText">Company Overview</span>
                  <p className="text-forest-900 mt-1 leading-relaxed whitespace-pre-line">{selectedCompany.description}</p>
                </div>
              )}
            </div>

            {selectedCompany.rejection_reason && (
              <div className="p-3 bg-red-50 text-red-800 text-xs rounded-lg border border-red-200">
                <span className="font-semibold">Previous Rejection Reason: </span>
                {selectedCompany.rejection_reason}
              </div>
            )}

            {/* Decision Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-mint-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCompany(null)}
              >
                Close
              </Button>

              <div className="flex items-center gap-3">
                {selectedCompany.verification_status !== 'rejected' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRejectModalOpen(true)}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Keep Inactive / Reject
                  </Button>
                )}

                {selectedCompany.verification_status !== 'active' && (
                  <Button
                    size="sm"
                    onClick={() => handleVerify(selectedCompany)}
                    isLoading={isVerifying}
                    className="bg-forest-900 text-inverseText"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" /> Verify & Activate
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Rejection Reason Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Company Registration"
      >
        <form onSubmit={handleConfirmReject} className="space-y-4">
          <p className="text-xs text-mutedText">
            Provide the administrative reason why this company registration is not approved. The reason will be stored on the company record.
          </p>

          {rejectModalError && (
            <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {rejectModalError}
            </div>
          )}

          <Textarea
            label="Mandatory Rejection Feedback"
            required
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Unverifiable business registration, duplicate company account, or invalid contact credentials..."
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-mint-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsRejectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isRejecting}
            >
              Confirm Rejection
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
