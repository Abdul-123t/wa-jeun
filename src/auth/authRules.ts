export type ProtectedRouteState = 'loading' | 'authenticated' | 'unauthenticated';

export function getProtectedRouteState(isLoading: boolean, userId: string | null | undefined): ProtectedRouteState {
  if (isLoading) return 'loading';
  return userId ? 'authenticated' : 'unauthenticated';
}

export function isVerifiedMember(userId: string | null | undefined, verifiedUserId: string | null | undefined): boolean {
  return Boolean(userId && verifiedUserId && userId === verifiedUserId);
}

export type AdminAccessViewState = 'loading' | 'authorized' | 'denied' | 'error';

export function getAdminAccessViewState(input: {
  permissionsLoading: boolean;
  userId: string | null | undefined;
  adminUserId: string | null | undefined;
  error?: string | null;
}): AdminAccessViewState {
  if (input.permissionsLoading) return 'loading';
  if (input.error) return 'error';
  return isVerifiedMember(input.userId, input.adminUserId) ? 'authorized' : 'denied';
}

export type AuthInputErrors = { email?: string; password?: string; confirmPassword?: string; fullName?: string };

export function validateAuthInput(email: string, password: string, confirmPassword?: string): AuthInputErrors {
  const errors: AuthInputErrors = {};
  const normalizedEmail = email.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    errors.email = 'Enter a valid email address.';
  }
  if (password.length < 8) {
    errors.password = 'Use a password with at least 8 characters.';
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    errors.confirmPassword = 'The passwords do not match.';
  }

  return errors;
}
