import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import type { Role } from '@/types/enums';
import { roleHomePath } from '@/utils/roleHome';

/**
 * Route guard for navigation/UX purposes ONLY (spec §6 / plan.md §6). This
 * is not a security boundary — it just avoids flashing the wrong screen and
 * redirects sensibly. Real authorization is enforced server-side, in this
 * POC by every `services/api/*` function checking role + ownership before
 * returning data, exactly as the real backend would.
 */
export function ProtectedRoute({ allowedRoles }: { allowedRoles?: Role[] }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={roleHomePath(user.role)} replace />;
  }

  return <Outlet />;
}
