// Access token lives in memory only; refresh token in localStorage (design-plan §2 "Session").
const REFRESH_KEY = 'stagelink.refresh';

let accessToken: string | null = null;
let memoryRefresh: string | null = null;
const expiredListeners = new Set<() => void>();

function tokenStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return tokenStorage()?.getItem(REFRESH_KEY) ?? memoryRefresh;
}

export function setTokens(tokens: { access: string; refresh: string }): void {
  accessToken = tokens.access;
  memoryRefresh = tokens.refresh;
  try {
    tokenStorage()?.setItem(REFRESH_KEY, tokens.refresh);
  } catch {
    /* storage unavailable: session will not survive a reload */
  }
}

/** Silent clear (logout, password change). Does not notify listeners. */
export function clearTokens(): void {
  accessToken = null;
  memoryRefresh = null;
  try {
    tokenStorage()?.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

/** Clear tokens AND tell the app the session is gone (failed refresh). */
export function expireSession(): void {
  clearTokens();
  expiredListeners.forEach((listener) => listener());
}

export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}
