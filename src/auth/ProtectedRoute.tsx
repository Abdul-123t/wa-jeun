import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { getProtectedRouteState } from './authRules';

export const ProtectedRoute: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const state = getProtectedRouteState(loading, user?.id);

  if (state === 'loading') {
    return <main className="flex min-h-[60vh] items-center justify-center text-sm text-[#123B2A]/70" role="status">Restoring your session…</main>;
  }
  if (state === 'unauthenticated') {
    return <Navigate to="/auth?mode=signin" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <>{children}</>;
};
