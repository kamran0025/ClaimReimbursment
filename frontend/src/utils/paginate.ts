import type { PageParams, Paginated } from '@/types/api';

export function paginate<T>(items: T[], params?: PageParams): Paginated<T> {
  const page = params?.page && params.page > 0 ? params.page : 1;
  const pageSize = params?.pageSize && params.pageSize > 0 ? params.pageSize : 10;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  };
}
