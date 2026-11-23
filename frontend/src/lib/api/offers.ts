import { request, toQuery } from './client';
import type { Offer, OfferStatus, OfferWrite, PaginatedOffers } from './types';

export interface OfferListParams {
  mine?: boolean;
  status?: OfferStatus;
  ordering?: 'deadline' | '-deadline' | 'created_at' | '-created_at';
  deadline_after?: string;
  search?: string;
  location?: string;
  requirements?: string;
  company_user_id?: string;
  page?: number;
  page_size?: number;
}

export const offersApi = {
  list: (params: OfferListParams = {}) =>
    request<PaginatedOffers>('offers', `/api/offers/${toQuery(params)}`),

  get: (id: string) => request<Offer>('offers', `/api/offers/${encodeURIComponent(id)}/`),

  create: (payload: OfferWrite) =>
    request<Offer>('offers', '/api/offers/', { method: 'POST', body: payload }),

  update: (id: string, payload: Partial<OfferWrite>) =>
    request<Offer>('offers', `/api/offers/${encodeURIComponent(id)}/`, {
      method: 'PATCH',
      body: payload,
    }),

  remove: (id: string) =>
    request<void>('offers', `/api/offers/${encodeURIComponent(id)}/`, { method: 'DELETE' }),

  publish: (id: string) =>
    request<Offer>('offers', `/api/offers/${encodeURIComponent(id)}/publish/`, {
      method: 'POST',
    }),

  close: (id: string) =>
    request<Offer>('offers', `/api/offers/${encodeURIComponent(id)}/close/`, { method: 'POST' }),
};
