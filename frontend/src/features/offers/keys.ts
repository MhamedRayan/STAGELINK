import type { ListOffersParams } from '@/api/offers';

export const offerKeys = {
  all: ['offers'] as const,
  list: (params: ListOffersParams) => ['offers', 'list', params] as const,
  detail: (id: string) => ['offers', 'detail', id] as const,
  locations: ['offers', 'locations'] as const,
};
