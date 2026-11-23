import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Users, Calendar, ArrowRight } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { formatDate } from '../../utils/formatters';
import { resolveUserName } from '../../demo/directory';
import { Pagination } from '../../components/ui/Pagination';

interface OfferItem {
  id: string;
  company_user_id: string;
  title: string;
  description: string;
  location: string;
  capacity: number;
  deadline: string;
  status: string;
}

interface OffersResponse {
  count: number;
  results: OfferItem[];
}

export const StudentBrowseOffers: React.FC = () => {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [search, setSearch] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;
    async function loadOffers() {
      setIsLoading(true);
      try {
        const data = await apiRequest<OffersResponse>('/svc/offers/api/offers/', {
          params: {
            page,
            page_size: 20,
            search: search || undefined,
            location: locationFilter || undefined,
            ordering: '-deadline',
          },
        });
        if (isMounted) {
          setOffers(data.results || []);
          setTotalCount(data.count || 0);

          const missingCompanies = (data.results || [])
            .map((o) => o.company_user_id)
            .filter((id) => !companyNames[id]);

          const uniqueMissing = Array.from(new Set(missingCompanies));
          uniqueMissing.forEach(async (cId) => {
            try {
              const profile = await apiRequest<{ legal_name?: string }>(
                `/svc/identity/api/companies/${cId}/profile/`
              );
              if (isMounted && profile.legal_name) {
                setCompanyNames((prev) => ({ ...prev, [cId]: profile.legal_name! }));
              }
            } catch {
              // Demo directory fallback
            }
          });
        }
      } catch (err) {
        console.error('Failed to load offers:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadOffers();
    return () => {
      isMounted = false;
    };
  }, [page, search, locationFilter]);

  const getCompanyName = (companyId: string) => {
    if (companyNames[companyId]) return companyNames[companyId];
    return resolveUserName(companyId, 'Company');
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-forest-900 tracking-tight">Browse Offers</h1>
        <p className="text-xs text-mutedText mt-1">
          Explore validated internship positions and submit your application.
        </p>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-mutedText absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by title, skills, keywords..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-mint-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-surface-600 text-forest-900"
          />
        </div>

        <div className="relative sm:w-64">
          <MapPin className="w-4 h-4 text-mutedText absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Filter by location..."
            value={locationFilter}
            onChange={(e) => {
              setLocationFilter(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-mint-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-surface-600 text-forest-900"
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="py-20 flex justify-center items-center">
          <div className="w-8 h-8 border-3 border-surface-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : offers.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl border border-mint-200">
          <h3 className="text-sm font-semibold text-forest-900 mb-1">
            No offers matching your search
          </h3>
          <p className="text-xs text-mutedText">
            Try adjusting your search terms or location filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map((offer) => (
            <div
              key={offer.id}
              onClick={() => navigate(`/app/student/offers/${offer.id}`)}
              className="bg-white rounded-xl p-5 border border-mint-300/60 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
            >
              <div>
                <div className="text-xs font-semibold text-surface-600 mb-1">
                  {getCompanyName(offer.company_user_id)}
                </div>
                <h3 className="text-base font-bold text-forest-900 group-hover:text-surface-700 transition-colors mb-2 line-clamp-1">
                  {offer.title}
                </h3>
                <p className="text-xs text-mutedText line-clamp-3 mb-4 leading-relaxed">
                  {offer.description}
                </p>
              </div>

              <div className="pt-4 border-t border-mint-200/60 space-y-2">
                <div className="flex items-center justify-between text-xs text-mutedText">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {offer.location || 'Algiers'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {offer.capacity} places
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 text-mutedText">
                    <Calendar className="w-3.5 h-3.5" />
                    Deadline: {formatDate(offer.deadline)}
                  </span>
                  <span className="inline-flex items-center text-xs font-semibold text-surface-700 group-hover:translate-x-0.5 transition-transform">
                    View & Apply <ArrowRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination
        totalItems={totalCount}
        pageSize={20}
        currentPage={page}
        onPageChange={setPage}
      />
    </div>
  );
};
