import { Role } from '@/types/enums';

export interface NavItem {
  label: string;
  to: string;
  end?: boolean;
}

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  [Role.CLAIMANT]: [
    { label: 'Dashboard', to: '/claimant/dashboard' },
    { label: 'My Claims', to: '/claimant/claims', end: true },
    { label: 'New Claim', to: '/claimant/claims/new' },
  ],
  [Role.APPROVER]: [
    { label: 'Dashboard', to: '/approver/dashboard' },
    { label: 'My Claims', to: '/approver/claims' },
  ],
  [Role.FINANCE]: [
    { label: 'Dashboard', to: '/finance/dashboard' },
    { label: 'All Claims', to: '/finance/claims' },
    { label: 'Employees', to: '/finance/employees' },
    { label: 'Audit Logs', to: '/finance/audit' },
    { label: 'Export', to: '/finance/export' },
  ],
};

export const ROLE_LABEL: Record<Role, string> = {
  [Role.CLAIMANT]: 'Claimant',
  [Role.APPROVER]: 'Approver',
  [Role.FINANCE]: 'Finance',
};
