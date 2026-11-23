import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { formatDate } from '../../utils/formatters';
import { SectionCard } from '../../components/ui/SectionCard';
import { Table, Column } from '../../components/ui/Table';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { Textarea, Select } from '../../components/ui/Input';

interface OngoingInternship {
  id: string;
  offer_id: string;
  student_user_id: string;
  status: string;
  start_date: string;
  end_date: string;
  offer_title?: string;
}

interface CancellationRecord {
  id: string;
  internship_id: string;
  internship_title: string;
  requested_by_user_id: string;
  reason: string;
  status: string;
  created_at: string;
}

export const CompanyCancellations: React.FC = () => {
  const [internships, setInternships] = useState<OngoingInternship[]>([]);
  const [cancellations, setCancellations] = useState<CancellationRecord[]>([]);
  const [selectedInternshipId, setSelectedInternshipId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch company's internships (mine=true)
      const internRes = await apiRequest<{ results: OngoingInternship[] }>(
        '/svc/internships/api/internships/',
        { params: { mine: true, limit: 100 } }
      );

      const items = internRes.results || [];
      const ongoing = items.filter((i) => i.status === 'confirmed' || i.status === 'in_progress');

      // 2. Fetch offer titles
      const enrichedInternships = await Promise.all(
        ongoing.map(async (i) => {
          try {
            const offer = await apiRequest<{ title: string }>(
              `/svc/offers/api/offers/${i.offer_id}/`
            );
            return { ...i, offer_title: offer.title };
          } catch {
            return { ...i, offer_title: `Internship · ${i.id.slice(0, 6)}` };
          }
        })
      );
      setInternships(enrichedInternships);
      if (enrichedInternships.length > 0 && !selectedInternshipId) {
        setSelectedInternshipId(enrichedInternships[0].id);
      }

      // 3. Client-side aggregation of cancellation requests (bounded to first 100 per design-plan §3.3)
      const reqList: CancellationRecord[] = [];
      await Promise.all(
        items.map(async (i) => {
          try {
            const reqs = await apiRequest<any[]>(
              `/svc/internships/api/internships/${i.id}/cancellation-requests/`
            );
            if (Array.isArray(reqs)) {
              reqs.forEach((r) => {
                reqList.push({
                  ...r,
                  internship_id: i.id,
                  internship_title: i.offer_title || `Internship · ${i.id.slice(0, 6)}`,
                });
              });
            }
          } catch {
            // silent catch
          }
        })
      );

      setCancellations(reqList);
    } catch (err) {
      console.error('Failed to load company cancellations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmitCancellation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInternshipId) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!reason.trim()) {
      setErrorMessage('Please provide a mandatory reason explaining the cancellation.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(
        `/svc/internships/api/internships/${selectedInternshipId}/cancellation-requests/`,
        {
          method: 'POST',
          body: JSON.stringify({ reason }),
        }
      );
      setSuccessMessage('Cancellation request submitted to university administration for review.');
      setReason('');
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit cancellation request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<CancellationRecord>[] = [
    {
      header: 'Internship Placement',
      accessorKey: 'internship_title',
      className: 'font-semibold text-forest-900',
    },
    {
      header: 'Requested on',
      cell: (item) => formatDate(item.created_at),
      className: 'text-mutedText',
    },
    {
      header: 'Submitted Reason',
      accessorKey: 'reason',
      className: 'text-forest-900 max-w-sm truncate',
    },
    {
      header: 'Status',
      cell: (item) => <StatusPill status={item.status} type="cancellation" />,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-forest-900 tracking-tight">Cancellations</h1>
        <p className="text-xs text-mutedText mt-1">
          Request early termination of an ongoing placement. Requests require approval by the university administration.
        </p>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-lg border border-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Request Form */}
      <SectionCard title="Submit a Cancellation Request">
        {internships.length === 0 ? (
          <p className="text-xs text-mutedText py-2">
            You currently have no confirmed or in-progress internships eligible for cancellation.
          </p>
        ) : (
          <form onSubmit={handleSubmitCancellation} className="space-y-4 max-w-2xl">
            <Select
              label="Select Placement"
              value={selectedInternshipId}
              onChange={(e) => setSelectedInternshipId(e.target.value)}
              options={internships.map((i) => ({
                label: `${i.offer_title || 'Internship'} (${formatDate(i.start_date)} - ${formatDate(i.end_date)})`,
                value: i.id,
              }))}
            />

            <Textarea
              label="Mandatory Reason"
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State the reasons for this cancellation request (e.g. project cancellation, organizational restructure)..."
            />

            <div className="flex justify-end">
              <Button type="submit" variant="danger" isLoading={isSubmitting}>
                <AlertTriangle className="w-4 h-4 mr-1.5" /> Submit to University
              </Button>
            </div>
          </form>
        )}
      </SectionCard>

      {/* History Table */}
      <SectionCard title="Requests You Submitted">
        <Table
          columns={columns}
          data={cancellations}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          emptyMessage="No cancellation requests submitted."
        />
      </SectionCard>
    </div>
  );
};
