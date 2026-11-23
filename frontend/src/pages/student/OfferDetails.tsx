import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Users, Calendar, Building2, AlertCircle } from 'lucide-react';
import { apiRequest, ApiError } from '../../api/client';
import { formatDate } from '../../utils/formatters';
import { resolveUserName } from '../../demo/directory';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';

interface OfferDetail {
  id: string;
  company_user_id: string;
  title: string;
  description: string;
  requirements?: string;
  location: string;
  capacity: number;
  deadline: string;
  status: string;
  created_at: string;
}

interface CompanyProfile {
  legal_name?: string;
  address?: string;
  website?: string;
  description?: string;
}

export const StudentOfferDetails: React.FC = () => {
  const { offerId } = useParams<{ offerId: string }>();
  const navigate = useNavigate();

  const [offer, setOffer] = useState<OfferDetail | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [hasApplied, setHasApplied] = useState<boolean>(false);
  const [existingAppId, setExistingAppId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Apply Modal state (Δ mandatory addition per design-plan §3.2)
  const [isApplyModalOpen, setIsApplyModalOpen] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Prefill default dates (today + 30 days and today + 120 days)
  useEffect(() => {
    const now = new Date();
    const dStart = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const dEnd = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);

    const formatISO = (d: Date) => d.toISOString().split('T')[0];
    setStartDate(formatISO(dStart));
    setEndDate(formatISO(dEnd));
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!offerId) return;
      setIsLoading(true);
      try {
        const offerData = await apiRequest<OfferDetail>(
          `/svc/offers/api/offers/${offerId}/`
        );

        if (!isMounted) return;
        setOffer(offerData);

        // Check if student has already applied
        try {
          const appsData = await apiRequest<{ results: any[] }>(
            '/svc/applications/api/applications/'
          );
          const found = (appsData.results || []).find((a) => a.offer_id === offerId);
          if (found) {
            setHasApplied(true);
            setExistingAppId(found.id);
          }
        } catch {
          // Non-blocking check
        }

        // Fetch company profile
        try {
          const compData = await apiRequest<CompanyProfile>(
            `/svc/identity/api/companies/${offerData.company_user_id}/profile/`
          );
          if (isMounted) setCompany(compData);
        } catch {
          // Optional
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Offer could not be loaded');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [offerId]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerId) return;
    setModalError(null);

    if (new Date(startDate) >= new Date(endDate)) {
      setModalError('Internship start date must be before end date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiRequest<{ id: string }>('/svc/applications/api/applications/', {
        method: 'POST',
        body: JSON.stringify({
          offer_id: offerId,
          start_date: startDate,
          end_date: endDate,
        }),
      });

      setIsApplyModalOpen(false);
      navigate(`/app/student/applications/${res.id}`);
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'DUPLICATE_APPLICATION') {
          setModalError('You have already applied for this offer.');
        } else if (err.code === 'OFFER_UNAVAILABLE') {
          setModalError('This offer is no longer open for applications.');
        } else if (err.code === 'CAPACITY_FULL') {
          setModalError('This offer has reached its maximum capacity.');
        } else if (err.code === 'INTERNSHIP_CONFLICT') {
          setModalError('You already have an active or confirmed internship.');
        } else {
          setModalError(err.message || 'Application failed.');
        }
      } else {
        setModalError('Network error. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center items-center">
        <div className="w-8 h-8 border-3 border-surface-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-lg font-bold text-forest-900 mb-2">Offer Not Found</h2>
        <p className="text-xs text-mutedText mb-4">{error || 'This offer does not exist.'}</p>
        <Link to="/app/student/offers">
          <Button variant="outline" size="sm">
            ← Back to Browse Offers
          </Button>
        </Link>
      </div>
    );
  }

  const isDeadlinePassed = new Date(offer.deadline) < new Date();
  const isAvailable = offer.status === 'published' && !isDeadlinePassed;
  const companyDisplayName =
    company?.legal_name || resolveUserName(offer.company_user_id, 'Company');

  return (
    <div className="space-y-6">
      <Link
        to="/app/student/offers"
        className="inline-flex items-center text-xs font-semibold text-surface-700 hover:underline"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Browse Offers
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl p-8 border border-mint-300/60 shadow-xs">
            <div className="text-xs font-semibold text-surface-600 mb-1">
              {companyDisplayName} • {offer.location}
            </div>
            <h1 className="text-2xl font-bold text-forest-900 mb-4">{offer.title}</h1>

            <div className="flex flex-wrap gap-4 py-4 border-y border-mint-200/60 mb-6 text-xs text-mutedText">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-surface-600" />
                {offer.location}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-surface-600" />
                {offer.capacity} places
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-surface-600" />
                Deadline: {formatDate(offer.deadline)}
              </span>
            </div>

            <div className="space-y-6 text-xs text-forest-900 leading-relaxed">
              <div>
                <h2 className="text-sm font-bold text-forest-900 mb-2 uppercase tracking-wider text-mutedText">
                  Description
                </h2>
                <p className="whitespace-pre-line">{offer.description}</p>
              </div>

              {offer.requirements && (
                <div>
                  <h2 className="text-sm font-bold text-forest-900 mb-2 uppercase tracking-wider text-mutedText">
                    Required Skills & Qualifications
                  </h2>
                  <p className="whitespace-pre-line">{offer.requirements}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CTA Card */}
        <div className="space-y-6">
          <div className="bg-mint rounded-xl p-6 border border-mint-300/60 shadow-xs">
            <h3 className="text-sm font-bold text-forest-900 mb-2">Apply for this Internship</h3>
            <p className="text-xs text-mutedText mb-4 leading-relaxed">
              Submit your proposed internship start and end dates. Your application will be reviewed by {companyDisplayName} and your university administration.
            </p>

            {hasApplied ? (
              <div className="space-y-3">
                <div className="p-3 bg-white/80 rounded-lg text-xs text-surface-700 font-medium border border-mint-300 flex items-center gap-2">
                  <span>✓ You have already applied for this position.</span>
                </div>
                {existingAppId && (
                  <Button
                    variant="outline"
                    className="w-full bg-white"
                    onClick={() => navigate(`/app/student/applications/${existingAppId}`)}
                  >
                    View Application Status
                  </Button>
                )}
              </div>
            ) : !isAvailable ? (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs border border-red-200">
                {isDeadlinePassed ? 'The application deadline has passed.' : 'This offer is not open for applications.'}
              </div>
            ) : (
              <Button
                className="w-full"
                onClick={() => setIsApplyModalOpen(true)}
              >
                Submit Application
              </Button>
            )}
          </div>

          <div className="bg-white rounded-xl p-6 border border-mint-300/60 shadow-xs">
            <h3 className="text-sm font-bold text-forest-900 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-surface-600" />
              Company Overview
            </h3>
            <p className="text-xs font-semibold text-forest-900 mb-1">{companyDisplayName}</p>
            {company?.address && (
              <p className="text-xs text-mutedText mb-2">{company.address}</p>
            )}
            {company?.website && (
              <a
                href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-surface-700 hover:underline block mb-3 truncate"
              >
                {company.website}
              </a>
            )}
            {company?.description && (
              <p className="text-xs text-mutedText leading-relaxed pt-2 border-t border-mint-200">
                {company.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Mandatory Apply Modal */}
      <Modal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        title="Submit Internship Application"
      >
        <form onSubmit={handleApply} className="space-y-4">
          <p className="text-xs text-mutedText">
            Please indicate your proposed availability period for <span className="font-semibold text-forest-900">{offer.title}</span>.
          </p>

          {modalError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs flex items-center gap-2 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <Input
            label="Proposed Start Date"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <Input
            label="Proposed End Date"
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-mint-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsApplyModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Confirm & Submit
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
