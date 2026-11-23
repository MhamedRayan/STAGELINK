import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Users, Calendar, Building2 } from 'lucide-react';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { apiRequest } from '../../api/client';
import { formatDate } from '../../utils/formatters';
import { resolveUserName } from '../../demo/directory';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../auth/useAuth';

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

export const OfferDetails: React.FC = () => {
  const { offerId } = useParams<{ offerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [offer, setOffer] = useState<OfferDetail | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadDetail() {
      if (!offerId) return;
      setIsLoading(true);
      try {
        const offerData = await apiRequest<OfferDetail>(
          `/svc/offers/api/offers/${offerId}/`
        );
        if (isMounted) {
          setOffer(offerData);

          // Load public company profile
          try {
            const compData = await apiRequest<CompanyProfile>(
              `/svc/identity/api/companies/${offerData.company_user_id}/profile/`
            );
            if (isMounted) setCompany(compData);
          } catch {
            // Profile optional fallback
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Offer not found');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDetail();
    return () => {
      isMounted = false;
    };
  }, [offerId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col">
        <PublicHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-surface-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col">
        <PublicHeader />
        <div className="flex-1 max-w-content mx-auto w-full px-6 py-12 text-center">
          <h2 className="text-lg font-bold text-forest-900 mb-2">Offer Not Available</h2>
          <p className="text-xs text-mutedText mb-4">{error || 'This opportunity could not be found.'}</p>
          <Link to="/offers">
            <Button variant="outline" size="sm">
              ← Return to Browse Offers
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const companyDisplayName =
    company?.legal_name || resolveUserName(offer.company_user_id, 'Company');

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-content mx-auto w-full px-6 py-8">
        <Link
          to="/offers"
          className="inline-flex items-center text-xs font-semibold text-surface-700 hover:underline mb-6"
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
                  {offer.capacity} places available
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
                      Required Skills & Requirements
                    </h2>
                    <p className="whitespace-pre-line">{offer.requirements}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action & Company Card */}
          <div className="space-y-6">
            <div className="bg-mint rounded-xl p-6 border border-mint-300/60 shadow-xs">
              <h3 className="text-sm font-bold text-forest-900 mb-2">Apply for this Role</h3>
              <p className="text-xs text-mutedText mb-4">
                Students apply directly through their verified university portal.
              </p>

              {user?.role === 'student' ? (
                <Button
                  className="w-full"
                  onClick={() => navigate(`/app/student/offers/${offer.id}`)}
                >
                  Apply as Student
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => navigate('/login')}
                >
                  Log in to Apply
                </Button>
              )}
            </div>

            <div className="bg-white rounded-xl p-6 border border-mint-300/60 shadow-xs">
              <h3 className="text-sm font-bold text-forest-900 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-surface-600" />
                About the Company
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
      </main>
    </div>
  );
};
