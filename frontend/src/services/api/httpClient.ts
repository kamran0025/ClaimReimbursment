// The one place that knows how to talk to the real backend over HTTP.
// Every service in this folder builds on top of `apiGet`/`apiPost`/etc
// instead of calling `fetch` directly, so the request/response envelope
// (backend spec §25 — `{success:true,data}` / `{success:false,error}`) is
// handled in exactly one place.
import { ApiError, ErrorCode } from './errors';
import type { ApiErrorBody, ApiSuccess } from '@/types/api';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export type QueryValue = string | number | boolean | readonly string[] | undefined | null;

export function toQueryString(query?: Record<string, QueryValue>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, String(v));
    } else {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
}

async function rawFetch(path: string, options: RequestOptions): Promise<Response> {
  const isFormData = options.body instanceof FormData;
  try {
    return await fetch(`${API_BASE_URL}${path}${toQueryString(options.query)}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: isFormData || options.body == null ? undefined : { 'Content-Type': 'application/json' },
      body: isFormData ? (options.body as FormData) : options.body != null ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Could not reach the server. Check your connection and try again.');
  }
}

/** Parses the `{success,...}` envelope, throwing `ApiError` for both HTTP-level and envelope-level failures. */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await rawFetch(path, options);

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ApiError(ErrorCode.INTERNAL_ERROR, `Unexpected response from the server (status ${res.status}).`);
    }
  }

  const isSuccessEnvelope = !!parsed && typeof parsed === 'object' && (parsed as { success?: boolean }).success === true;
  if (!res.ok || !isSuccessEnvelope) {
    const errorBody = parsed as ApiErrorBody | null;
    if (errorBody?.error) {
      throw new ApiError(errorBody.error.code as ErrorCode, errorBody.error.message, errorBody.error.details);
    }
    throw new ApiError(ErrorCode.INTERNAL_ERROR, `Request failed with status ${res.status}.`);
  }

  return (parsed as ApiSuccess<T>).data;
}

export function apiGet<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
  return request<T>(path, { method: 'GET', query });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

/** For endpoints that don't return the `{success,data}` envelope (e.g. the CSV export stream). */
export async function apiGetRaw(path: string, query?: Record<string, QueryValue>): Promise<Response> {
  const res = await rawFetch(path, { method: 'GET', query });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let errorBody: ApiErrorBody | null = null;
    try {
      errorBody = JSON.parse(text) as ApiErrorBody;
    } catch {
      errorBody = null;
    }
    if (errorBody?.error) {
      throw new ApiError(errorBody.error.code as ErrorCode, errorBody.error.message, errorBody.error.details);
    }
    throw new ApiError(ErrorCode.INTERNAL_ERROR, `Request failed with status ${res.status}.`);
  }
  return res;
}
