import { useMutation, useQuery } from '@tanstack/react-query';
import { dashboardApi, financeApi, usersApi } from '@/services/api';
import type { ExportFilters } from '@/services/api/financeService';

export function useFinanceDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'finance'],
    queryFn: () => dashboardApi.getFinanceDashboard(),
  });
}

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: () => usersApi.listEmployees(),
  });
}

export function useExportClaims() {
  return useMutation({
    mutationFn: (filters: ExportFilters) => financeApi.exportClaims(filters),
  });
}
