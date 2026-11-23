import { http } from './http';
import type { components } from './schema/offers';

export type Offer = components['schemas']['Offer'];
export type PaginatedOffers = components['schemas']['PaginatedOffers'];
export type OfferWrite = components['schemas']['OfferWrite'];

export interface ListOffersParams {
  search?: string;
  location?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
  mine?: boolean;
  status?: Offer['status'];
}

export function listOffers(params: ListOffersParams = {}): Promise<PaginatedOffers> {
  return http<PaginatedOffers>('offers', '/api/offers/', { query: { ...params } });
}

export function getOffer(id: string): Promise<Offer> {
  return http<Offer>('offers', `/api/offers/${id}/`);
}

export function listMyOffers(params: {
  status?: Offer['status'];
  page?: number;
  page_size?: number;
}): Promise<PaginatedOffers> {
  return listOffers({ ...params, mine: true });
}

export function createOffer(body: OfferWrite): Promise<Offer> {
  return http<Offer>('offers', '/api/offers/', { method: 'POST', body });
}

export function updateOffer(id: string, body: OfferWrite): Promise<Offer> {
  return http<Offer>('offers', `/api/offers/${id}/`, { method: 'PATCH', body });
}

export function publishOffer(id: string): Promise<Offer> {
  return http<Offer>('offers', `/api/offers/${id}/publish/`, { method: 'POST' });
}

export function closeOffer(id: string): Promise<Offer> {
  return http<Offer>('offers', `/api/offers/${id}/close/`, { method: 'POST' });
}

export function deleteOffer(id: string): Promise<void> {
  return http<void>('offers', `/api/offers/${id}/`, { method: 'DELETE' });
}
