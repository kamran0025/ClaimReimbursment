import { Role } from '@/types/enums';

export function roleHomePath(role: Role): string {
  switch (role) {
    case Role.FINANCE:
      return '/finance/dashboard';
    case Role.APPROVER:
      return '/approver/dashboard';
    case Role.CLAIMANT:
    default:
      return '/claimant/dashboard';
  }
}
