import { ApiError, apiErrorFromBody } from '@/lib/errors';
import { expireSession, getAccessToken, getRefreshToken, setTokens } from '@/lib/session';

export type ServiceName = 'identity' | 'offers' | 'applications' | 'internships' | 'notifications';

/** One origin for the browser: Vite proxy in dev, nginx path prefixes in production. */
export const SERVICE_BASE: Record<ServiceName, string> = {
  identity: '/svc/identity',
  offers: '/svc/offers',
  applications: '/svc/applications',
  internships: '/svc/internships',
  notifications: '/svc/notifications',
};

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, QueryValue>;
  /** JSON body. */
  body?: unknown;
  /** Multipart body (file uploads). */
  formData?: FormData;
  signal?: AbortSignal;
  /** Do not send the Bearer token and never try a refresh (login, register, refresh). */
  skipAuth?: boolean;
}

function buildUrl(service: ServiceName, path: string, query?: RequestOptions['query']): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return `${SERVICE_BASE[service]}${path}${qs ? `?${qs}` : ''}`;
}

async function send(service: ServiceName, path: string, options: RequestOptions): Promise<Response> {
  const headers = new Headers();
  if (!options.skipAuth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData; // browser sets the multipart boundary
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }
  try {
    return await fetch(buildUrl(service, path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError({
      status: 0,
      message: 'Network error. Check your connection and try again.',
    });
  }
}

// --- refresh rotation: single-flight so parallel 401s trigger exactly one refresh -------------
let refreshInFlight: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const response = await fetch(`${SERVICE_BASE.identity}/api/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { access: string; refresh?: string };
    // Refresh tokens rotate: always store the new one (the old one is blacklisted).
    setTokens({ access: data.access, refresh: data.refresh ?? refresh });
    return true;
  } catch {
    return false;
  }
}

/** Exchange the stored refresh token for a new pair. Safe to call concurrently. */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/** Low-level request with Bearer header and one refresh-and-retry on 401. */
export async function rawRequest(
  service: ServiceName,
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  let response = await send(service, path, options);
  if (response.status === 401 && !options.skipAuth) {
    if (getRefreshToken() && (await refreshSession())) {
      response = await send(service, path, options);
    }
    if (response.status === 401) expireSession(); // refresh failed or retry still unauthorised
  }
  return response;
}

async function readError(response: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  return apiErrorFromBody(response.status, body);
}

/** JSON request. Throws ApiError on non-2xx. Components never call this directly (see AGENTS.md). */
export async function http<T>(
  service: ServiceName,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await rawRequest(service, path, options);
  if (!response.ok) throw await readError(response);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Authenticated download (plain <a href> would 401): fetch → blob → object URL → click. */
export async function downloadFile(
  service: ServiceName,
  path: string,
  fallbackFilename: string,
): Promise<void> {
  const response = await rawRequest(service, path);
  if (!response.ok) throw await readError(response);
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] ? decodeURIComponent(match[1]) : fallbackFilename;
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
