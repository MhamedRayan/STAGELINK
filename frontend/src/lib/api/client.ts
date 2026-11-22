import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  notifySessionExpired,
  setTokens,
} from './tokens';

export type Service = 'identity' | 'offers' | 'applications' | 'internships' | 'notifications';

const ORIGIN = import.meta.env.VITE_API_ORIGIN ?? '';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fields?: Record<string, string>;
  readonly body: unknown;

  constructor(
    status: number,
    message: string,
    options: { code?: string; fields?: Record<string, string>; body?: unknown } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = options.code;
    this.fields = options.fields;
    this.body = options.body;
  }
}

function endpoint(service: Service, path: string): string {
  return `${ORIGIN}/svc/${service}${path}`;
}

type ErrorBody = {
  code?: unknown;
  message?: unknown;
  detail?: unknown;
  [key: string]: unknown;
};

function fieldMessages(body: ErrorBody): Record<string, string> | undefined {
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === 'code' || key === 'message' || key === 'detail' || key === 'details') continue;
    if (typeof value === 'string') fields[key] = value;
    else if (Array.isArray(value) && value.length > 0) fields[key] = String(value[0]);
  }
  return Object.keys(fields).length > 0 ? fields : undefined;
}

function toApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object') {
    const data = body as ErrorBody;
    const code = typeof data.code === 'string' ? data.code : undefined;
    const fields = fieldMessages(data);
    const message =
      (typeof data.message === 'string' && data.message) ||
      (typeof data.detail === 'string' && data.detail) ||
      (Array.isArray(data.detail) && data.detail.length > 0 && String(data.detail[0])) ||
      (fields && Object.values(fields)[0]) ||
      `Request failed (${status})`;
    return new ApiError(status, String(message), { code, fields, body });
  }
  return new ApiError(status, `Request failed (${status})`, { body });
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  const response = await fetch(endpoint('identity', '/api/auth/refresh/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  if (!response.ok) {
    clearTokens();
    notifySessionExpired();
    return false;
  }
  const data = (await response.json()) as { access: string; refresh: string };
  setTokens({ access: data.access, refresh: data.refresh });
  return true;
}

function ensureRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = refreshTokens().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function request<T>(
  service: Service,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, auth = true, headers = {}, signal } = options;

  const send = async (): Promise<Response> => {
    const requestHeaders: Record<string, string> = { Accept: 'application/json', ...headers };
    const token = getAccessToken();
    if (auth && token) requestHeaders.Authorization = `Bearer ${token}`;

    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      requestHeaders['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    return fetch(endpoint(service, path), {
      method,
      headers: requestHeaders,
      body: payload,
      signal,
    });
  };

  let response = await send();
  if (response.status === 401 && auth) {
    const refreshed = await ensureRefresh();
    if (refreshed) response = await send();
    else notifySessionExpired();
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) throw toApiError(response.status, parsed);
  return parsed as T;
}

export async function downloadFile(
  service: Service,
  path: string,
  fallbackName: string,
): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(endpoint(service, path), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep text */
    }
    throw toApiError(response.status, body);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : fallbackName;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function toQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}
