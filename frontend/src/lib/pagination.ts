// The services use two response shapes (design-plan §4 "Pagination shapes").
export const PAGE_SIZE = 20;

export interface Paged<T> {
  items: T[];
  total: number;
}

/** DRF pages: { count, next, previous, results } — identity, offers, notifications. */
export function normalizeDrfPage<T>(res: { count: number; results: T[] }): Paged<T> {
  return { items: res.results, total: res.count };
}

/** Offset pages: { results, pagination: { limit, offset, total } } — applications, internships. */
export function normalizeOffsetPage<T>(res: {
  results: T[];
  pagination: { total: number };
}): Paged<T> {
  return { items: res.results, total: res.pagination.total };
}

/** 1-based page → limit/offset query params. */
export function pageToOffset(page: number, pageSize = PAGE_SIZE): { limit: number; offset: number } {
  return { limit: pageSize, offset: (Math.max(page, 1) - 1) * pageSize };
}

export function pageCount(total: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
