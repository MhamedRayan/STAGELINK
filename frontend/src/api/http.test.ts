import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '@/lib/session';
import { http } from './http';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('http', () => {
  beforeEach(() => {
    clearTokens();
    setTokens({ access: 'old-access', refresh: 'old-refresh' });
  });
  afterEach(() => vi.restoreAllMocks());

  it('refreshes once on 401, stores the rotated refresh token and retries', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(401, { detail: 'expired' }))
      .mockResolvedValueOnce(json(200, { access: 'new-access', refresh: 'new-refresh' }))
      .mockResolvedValueOnce(json(200, { ok: true }));

    await expect(http('offers', '/api/offers/')).resolves.toEqual({ ok: true });
    expect(getAccessToken()).toBe('new-access');
    expect(getRefreshToken()).toBe('new-refresh');
    const retryHeaders = fetchMock.mock.calls[2]?.[1]?.headers as Headers;
    expect(retryHeaders.get('Authorization')).toBe('Bearer new-access');
  });

  it('shares ONE refresh between parallel 401s', async () => {
    let refreshCalls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/auth/refresh/')) {
        refreshCalls += 1;
        return json(200, { access: 'new-access', refresh: 'new-refresh' });
      }
      const auth = (init?.headers as Headers).get('Authorization');
      return auth === 'Bearer new-access' ? json(200, { ok: true }) : json(401, { detail: 'expired' });
    });

    await Promise.all([http('offers', '/a/'), http('applications', '/b/')]);
    expect(refreshCalls).toBe(1);
  });

  it('expires the session when refresh fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(401, { detail: 'expired' }))
      .mockResolvedValueOnce(json(401, { detail: 'bad refresh' }));

    await expect(http('offers', '/api/offers/')).rejects.toMatchObject({ status: 401 });
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('never sends Bearer or refreshes when skipAuth is set (login)', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(401, { detail: 'Invalid credentials' }));
    await expect(
      http('identity', '/api/auth/login/', { method: 'POST', body: {}, skipAuth: true }),
    ).rejects.toMatchObject({ status: 401, message: 'Invalid credentials' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
