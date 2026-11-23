import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from './http';
import { lookupUsers, type UserSummary } from './identity';

vi.mock('./http', () => ({ http: vi.fn() }));

function user(id: string): UserSummary {
  return { id, name: `Name ${id}`, role: 'student' };
}

beforeEach(() => {
  vi.mocked(http).mockReset();
});

describe('lookupUsers', () => {
  it('coalesces same-tick calls into one request and preserves requested order', async () => {
    const first = user('11111111-1111-4111-8111-111111111111');
    const second = user('22222222-2222-4222-8222-222222222222');
    vi.mocked(http).mockResolvedValue({ results: [second, first] });

    const results = await Promise.all([lookupUsers([first.id]), lookupUsers([second.id])]);

    expect(results).toEqual([[first], [second]]);
    expect(http).toHaveBeenCalledTimes(1);
    expect(vi.mocked(http).mock.calls[0]?.[2]?.query).toEqual({
      ids: `${first.id},${second.id}`,
    });
  });

  it('chunks requests at the contract limit of 100 ids', async () => {
    const ids = Array.from({ length: 101 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
    vi.mocked(http).mockResolvedValue({ results: [] });

    await lookupUsers(ids);

    expect(http).toHaveBeenCalledTimes(2);
    const query = vi.mocked(http).mock.calls[1]?.[2]?.query;
    expect(String(query?.ids).split(',')).toHaveLength(1);
  });

  it('fans a failed request out to every waiting caller', async () => {
    vi.mocked(http).mockRejectedValue(new Error('Identity is down'));

    await expect(
      Promise.all([
        lookupUsers(['11111111-1111-4111-8111-111111111111']),
        lookupUsers(['22222222-2222-4222-8222-222222222222']),
      ]),
    ).rejects.toThrow('Identity is down');
  });

  it('does not call the API for an empty id list', async () => {
    expect(await lookupUsers([])).toEqual([]);
    expect(http).not.toHaveBeenCalled();
  });
});
