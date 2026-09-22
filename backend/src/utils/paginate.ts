// Same page/pageSize defaults as frontend/src/utils/paginate.ts — page 1, size 10.
export interface PageParams {
  page?: number;
  pageSize?: number;
}

export function resolvePage(params: PageParams): { page: number; pageSize: number; skip: number; take: number } {
  const page = params.page && params.page > 0 ? Math.floor(params.page) : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? Math.floor(params.pageSize) : 10;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
