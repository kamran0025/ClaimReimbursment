import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { Role } from '@/types/enums';
import { roleHomePath } from '@/utils/roleHome';

import { LoginPage } from '@/pages/auth/LoginPage';

import { ClaimantDashboardPage } from '@/pages/claimant/DashboardPage';
import { MyClaimsPage } from '@/pages/claimant/MyClaimsPage';
import { CreateClaimPage } from '@/pages/claimant/CreateClaimPage';
import { EditClaimPage } from '@/pages/claimant/EditClaimPage';
import { ClaimDetailsPage } from '@/pages/claimant/ClaimDetailsPage';

import { ApproverDashboardPage } from '@/pages/approver/DashboardPage';
import { AssignedClaimsPage } from '@/pages/approver/AssignedClaimsPage';
import { ClaimReviewPage } from '@/pages/approver/ClaimReviewPage';

import { FinanceDashboardPage } from '@/pages/finance/DashboardPage';
import { AllClaimsPage } from '@/pages/finance/AllClaimsPage';
import { FinanceClaimDetailsPage } from '@/pages/finance/ClaimDetailsPage';
import { EmployeesPage } from '@/pages/finance/EmployeesPage';
import { AuditLogsPage } from '@/pages/finance/AuditLogsPage';
import { ExportPage } from '@/pages/finance/ExportPage';

function RootRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  return <Navigate to={roleHomePath(user.role)} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[Role.CLAIMANT]} />}>
        <Route element={<AppLayout />}>
          <Route path="/claimant/dashboard" element={<ClaimantDashboardPage />} />
          <Route path="/claimant/claims" element={<MyClaimsPage />} />
          <Route path="/claimant/claims/new" element={<CreateClaimPage />} />
          <Route path="/claimant/claims/:claimId" element={<ClaimDetailsPage />} />
          <Route path="/claimant/claims/:claimId/edit" element={<EditClaimPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[Role.APPROVER]} />}>
        <Route element={<AppLayout />}>
          <Route path="/approver/dashboard" element={<ApproverDashboardPage />} />
          <Route path="/approver/claims" element={<AssignedClaimsPage />} />
          <Route path="/approver/claims/:claimId" element={<ClaimReviewPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[Role.FINANCE]} />}>
        <Route element={<AppLayout />}>
          <Route path="/finance/dashboard" element={<FinanceDashboardPage />} />
          <Route path="/finance/claims" element={<AllClaimsPage />} />
          <Route path="/finance/claims/:claimId" element={<FinanceClaimDetailsPage />} />
          <Route path="/finance/employees" element={<EmployeesPage />} />
          <Route path="/finance/audit" element={<AuditLogsPage />} />
          <Route path="/finance/export" element={<ExportPage />} />
        </Route>
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
