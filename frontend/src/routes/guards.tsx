import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spinner } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../types';

/** Requires a signed-in user, optionally with a specific role. */
export function RequireAuth({ role }: { role?: Role }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (role && user.role !== role) return <Navigate to="/forbidden" replace />;
  return <Outlet />;
}

/** Login and register are pointless once signed in. */
export function GuestOnly() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <Spinner label="Checking your session" />;
  if (user) return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />;
  return <Outlet />;
}
