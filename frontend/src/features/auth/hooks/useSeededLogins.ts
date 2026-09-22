import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/services/api';

/** Powers the "pick a seeded user" convenience picker on the login screen. */
export function useSeededLogins() {
  return useQuery({
    queryKey: ['auth', 'seeded-logins'],
    queryFn: () => authApi.listSeededLogins(),
    staleTime: Infinity,
  });
}
