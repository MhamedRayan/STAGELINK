import { AuthTokens, RefreshResponse } from '../types/auth';

const REFRESH_TOKEN_KEY = 'stagelink_refresh_token';

let inMemoryAccessToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];
let authFailureHandler: (() => void) | null = null;

export function setAuthFailureHandler(handler: () => void) {
  authFailureHandler = handler;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: Partial<AuthTokens>) {
  if (tokens.access !== undefined) {
    inMemoryAccessToken = tokens.access;
  }
  if (tokens.refresh !== undefined) {
    if (tokens.refresh) {
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }
}

export function clearTokens() {
  inMemoryAccessToken = null;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

export interface ApiErrorPayload {
  message: string;
  code?: string;
  status: number;
  fieldErrors?: Record<string, string[]>;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  fieldErrors?: Record<string, string[]>;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiError';
    this.status = payload.status;
    this.code = payload.code;
    this.fieldErrors = payload.fieldErrors;
  }
}

async function parseApiError(response: Response): Promise<ApiError> {
  const status = response.status;
  let message = `Request failed with status ${status}`;
  let code: string | undefined;
  let fieldErrors: Record<string, string[]> | undefined;

  try {
    const data = await response.json();
    if (typeof data === 'object' && data !== null) {
      // Shared envelope {code, message, details}
      if ('message' in data && typeof data.message === 'string') {
        message = data.message;
      } else if ('detail' in data && typeof data.detail === 'string') {
        // DRF detail format
        message = data.detail;
      }

      if ('code' in data && typeof data.code === 'string') {
        code = data.code;
      }

      // Check field errors
      const fields: Record<string, string[]> = {};
      let hasFields = false;

      for (const [k, v] of Object.entries(data)) {
        if (k === 'code' || k === 'message' || k === 'detail') continue;
        if (Array.isArray(v)) {
          fields[k] = v.map((item) => String(item));
          hasFields = true;
        } else if (typeof v === 'string') {
          fields[k] = [v];
          hasFields = true;
        }
      }

      if (hasFields) {
        fieldErrors = fields;
        if (!data.message && !data.detail) {
          const firstField = Object.keys(fields)[0];
          message = `${firstField}: ${fields[firstField][0]}`;
        }
      }
    }
  } catch {
    // Non-JSON error
    message = response.statusText || message;
  }

  return new ApiError({ message, status, code, fieldErrors });
}

async function attemptTokenRefresh(): Promise<string> {
  const refresh = getRefreshToken();
  if (!refresh) {
    clearTokens();
    if (authFailureHandler) authFailureHandler();
    throw new Error('No refresh token available');
  }

  try {
    const res = await fetch('/svc/identity/api/auth/refresh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });

    if (!res.ok) {
      clearTokens();
      if (authFailureHandler) authFailureHandler();
      throw new Error('Token refresh failed');
    }

    const data = (await res.json()) as RefreshResponse;
    setTokens({ access: data.access, refresh: data.refresh });
    return data.access;
  } catch (err) {
    clearTokens();
    if (authFailureHandler) authFailureHandler();
    throw err;
  }
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | null | undefined>;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, headers: customHeaders, ...restOptions } = options;

  let url = endpoint;
  if (params) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    }
    const queryString = query.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const headers = new Headers(customHeaders);
  if (!headers.has('Content-Type') && !(restOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(url, { ...restOptions, headers });

  // Handle 401 & token rotation
  if (response.status === 401 && !url.includes('/api/auth/')) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const newAccessToken = await attemptTokenRefresh();
        isRefreshing = false;
        onTokenRefreshed(newAccessToken);
      } catch (err) {
        isRefreshing = false;
        refreshSubscribers = [];
        throw await parseApiError(response);
      }
    }

    // Wait for ongoing refresh
    const retryToken = await new Promise<string>((resolve) => {
      addRefreshSubscriber((newToken) => resolve(newToken));
    });

    const retryHeaders = new Headers(customHeaders);
    if (!retryHeaders.has('Content-Type') && !(restOptions.body instanceof FormData)) {
      retryHeaders.set('Content-Type', 'application/json');
    }
    retryHeaders.set('Authorization', `Bearer ${retryToken}`);

    response = await fetch(url, { ...restOptions, headers: retryHeaders });
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export async function downloadAuthenticatedFile(url: string, filename: string): Promise<void> {
  const token = getAccessToken();
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, { method: 'GET', headers });
  if (!response.ok) {
    throw await parseApiError(response);
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(blobUrl);
}
