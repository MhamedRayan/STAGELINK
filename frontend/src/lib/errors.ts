// Error bodies vary (design-plan §6.10): DRF { detail }, field errors { field: [msg] },
// and the documented { code, message, details } envelope. Show message/detail first, then fields.
export interface ApiErrorInit {
  status: number;
  message: string;
  code?: string;
  fieldErrors?: Record<string, string>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fieldErrors: Record<string, string>;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.fieldErrors = init.fieldErrors ?? {};
  }
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';
const RESERVED_KEYS = new Set(['detail', 'message', 'code', 'details']);

function asText(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === 'string' && v.trim());
    return typeof first === 'string' ? first : undefined;
  }
  return undefined;
}

function collectFields(source: unknown, into: Record<string, string>): void {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return;
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (RESERVED_KEYS.has(key)) continue;
    const text = asText(value);
    if (text) into[key] = text;
  }
}

/** Build an ApiError from an HTTP status and a parsed (or missing) JSON body. */
export function apiErrorFromBody(status: number, body: unknown): ApiError {
  const fieldErrors: Record<string, string> = {};
  let message: string | undefined;
  let code: string | undefined;

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    message = asText(record.message) ?? asText(record.detail);
    code = typeof record.code === 'string' ? record.code : undefined;
    collectFields(record.details, fieldErrors);
    collectFields(record, fieldErrors);
  }
  if (!message) message = Object.values(fieldErrors)[0] ?? GENERIC_MESSAGE;
  return new ApiError({ status, message, code, fieldErrors });
}

/** Turn anything thrown into an ApiError (network failures become status 0). */
export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error) return new ApiError({ status: 0, message: error.message });
  return new ApiError({ status: 0, message: GENERIC_MESSAGE });
}
