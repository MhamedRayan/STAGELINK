const REFRESH_KEY = 'stagelink.refresh';

let accessToken: string | null = null;
let refreshToken: string | null = readStoredRefresh();
const expiryListeners = new Set<() => void>();

function readStoredRefresh(): string | null {
  try {
    return window.localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function setTokens(tokens: { access: string; refresh?: string }): void {
  accessToken = tokens.access;
  if (tokens.refresh) {
    refreshToken = tokens.refresh;
    try {
      window.localStorage.setItem(REFRESH_KEY, tokens.refresh);
    } catch {
      /* storage may be unavailable */
    }
  }
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  try {
    window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

export function hasRefreshToken(): boolean {
  return Boolean(refreshToken);
}

export function subscribeSessionExpired(listener: () => void): () => void {
  expiryListeners.add(listener);
  return () => expiryListeners.delete(listener);
}

export function notifySessionExpired(): void {
  expiryListeners.forEach((listener) => listener());
}
