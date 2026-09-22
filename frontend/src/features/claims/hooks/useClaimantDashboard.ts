import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/services/api';

export function useClaimantDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'claimant'],
    queryFn: () => dashboardApi.getClaimantDashboard(),
  });
}
