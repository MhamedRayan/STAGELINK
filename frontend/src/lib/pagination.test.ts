import { normalizeDrfPage, normalizeOffsetPage, pageToOffset } from './pagination';

describe('pagination', () => {
  it('normalises DRF pages', () => {
    expect(normalizeDrfPage({ count: 45, results: [1, 2] })).toEqual({ items: [1, 2], total: 45 });
  });
  it('normalises offset pages', () => {
    expect(
      normalizeOffsetPage({ results: ['a'], pagination: { total: 7 } }),
    ).toEqual({ items: ['a'], total: 7 });
  });
  it('converts page to limit/offset', () => {
    expect(pageToOffset(3)).toEqual({ limit: 20, offset: 40 });
  });
});
