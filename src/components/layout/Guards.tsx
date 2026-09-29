import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spinner } from '../ui/Misc';
import { useAuth } from '@/providers/AuthProvider';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, profile, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to={`/sign-in?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  // Customers complete their profile once before using the account area.
  if (profile && profile.role !== 'admin' && !profile.onboarded_at && loc.pathname !== '/welcome') {
    return <Navigate to={`/welcome?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  }
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, ready, profile } = useAuth();
  if (!ready || (user && !profile)) return <Spinner label="Checking access" />;
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}
