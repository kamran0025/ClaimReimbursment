// Backend-style envelope (spec §25). Every mock service call resolves to
// one of these two shapes so the UI renders exactly what a real API would
// send, error included — never a re-derived client-side approximation.
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
