import { http } from './http';
import type { components } from './schema/offers';

export type Offer = components['schemas']['Offer'];
export type PaginatedOffers = components['schemas']['PaginatedOffers'];

export interface ListOffersParams {
  search?: string;
  location?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export function listOffers(params: ListOffersParams = {}): Promise<PaginatedOffers> {
  return http<PaginatedOffers>('offers', '/api/offers/', { query: { ...params } });
}

export function getOffer(id: string): Promise<Offer> {
  return http<Offer>('offers', `/api/offers/${id}/`);
}
