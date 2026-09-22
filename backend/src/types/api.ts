// Mirrors frontend/src/types/api.ts — the wire envelope every response uses.
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResult<T> = ApiSuccess<T> | ApiErrorBody;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PageParams {
  page?: number;
  pageSize?: number;
}

export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}
