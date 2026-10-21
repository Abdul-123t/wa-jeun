import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { supabaseBrowser } from '../services/supabaseBrowser';
import { api, type VendorApplication } from '../services/api';

type AuthContextValue = {
  client: SupabaseClient | null;
  session: Session | null;
  user: User | null;
  loading: boolean;
  adminUserId: string | null;
  adminPermissionError: string | null;
  vendorApplications: VendorApplication[];
  vendorApplicationError: string | null;
  permissionsLoading: boolean;
  retryPermissionCheck: () => void;
  signOut: () => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [adminPermissionError, setAdminPermissionError] = useState<string | null>(null);
  const [vendorApplications, setVendorApplications] = useState<VendorApplication[]>([]);
  const [vendorApplicationError, setVendorApplicationError] = useState<string | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionCheckVersion, setPermissionCheckVersion] = useState(0);

  useEffect(() => {
    if (!supabaseBrowser) {
      setLoading(false);
      setPermissionsLoading(false);
      return;
    }

    let active = true;
    let authEventReceived = false;
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        authEventReceived = true;
        setSession(nextSession);
        setLoading(false);
      }
    });

    void supabaseBrowser.auth.getSession().then(({ data, error }) => {
      if (active && !authEventReceived) {
        setSession(error ? null : data.session);
        setLoading(false);
      }
    }).catch(() => {
      if (active && !authEventReceived) {
        setSession(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const userId = session?.user.id;
    const accessToken = session?.access_token;
    setAdminUserId(null);
    setAdminPermissionError(null);
    setVendorApplications([]);
    setVendorApplicationError(null);
    if (!userId || !accessToken) {
      setPermissionsLoading(false);
      return () => { active = false; };
    }
    setPermissionsLoading(true);
    const getCurrentAccessToken = async () => {
      // Ask Supabase for its current session immediately before sending the
      // bearer token. This refreshes a near-expiry session and prevents a
      // stale token snapshot from being treated as a membership denial.
      const { data, error } = await supabaseBrowser!.auth.getSession();
      if (error || !data.session || data.session.user.id !== userId) {
        throw new Error('Your sign-in session could not be refreshed. Please sign in again and retry.');
      }
      return data.session.access_token;
    };
    const currentAccessToken = getCurrentAccessToken();
    void Promise.allSettled([
      currentAccessToken.then(token => api.getAdminAccess(token)),
      currentAccessToken.then(token => api.getMyVendorApplications(token))
    ]).then(([adminResult, vendorResult]) => {
      if (!active) return;
      if (adminResult.status === 'fulfilled' && adminResult.value) setAdminUserId(userId);
      if (adminResult.status === 'rejected') {
        setAdminPermissionError(adminResult.reason instanceof Error
          ? adminResult.reason.message
          : 'Administrator access could not be verified.');
      }
      if (vendorResult.status === 'fulfilled') setVendorApplications(vendorResult.value.applications);
      else setVendorApplicationError(vendorResult.reason instanceof Error
        ? vendorResult.reason.message
        : 'Your applications could not be loaded. Please try again.');
      setPermissionsLoading(false);
    });
    return () => { active = false; };
  }, [session?.user.id, session?.access_token, permissionCheckVersion]);

  const retryPermissionCheck = () => setPermissionCheckVersion(version => version + 1);

  const signOut = async () => {
    if (!supabaseBrowser) return { error: 'Account sign-in is not configured yet.' };
    try {
      const { error } = await supabaseBrowser.auth.signOut();
      return { error: error ? 'Could not sign out. Please try again.' : null };
    } catch {
      return { error: 'Could not sign out. Please check your connection and try again.' };
    }
  };

  const value = useMemo<AuthContextValue>(() => ({
    client: supabaseBrowser,
    session,
    user: session?.user ?? null,
    loading,
    adminUserId,
    adminPermissionError,
    vendorApplications,
    vendorApplicationError,
    permissionsLoading,
    retryPermissionCheck,
    signOut
  }), [session, loading, adminUserId, adminPermissionError, vendorApplications, vendorApplicationError, permissionsLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
