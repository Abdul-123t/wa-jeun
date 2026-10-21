export type ProtectedRouteState = 'loading' | 'authenticated' | 'unauthenticated';

export function getProtectedRouteState(isLoading: boolean, userId: string | null | undefined): ProtectedRouteState {
  if (isLoading) return 'loading';
  return userId ? 'authenticated' : 'unauthenticated';
}

export function isVerifiedMember(userId: string | null | undefined, verifiedUserId: string | null | undefined): boolean {
  return Boolean(userId && verifiedUserId && userId === verifiedUserId);
}

export type VendorApplicationNavSummary = { status: string };
export type NavigationLink = { label: string; to: string };

export function getRoleAwareNavigation(input: {
  userId: string | null | undefined;
  authLoading: boolean;
  permissionsLoading: boolean;
  vendorApplications: VendorApplicationNavSummary[];
  vendorApplicationError?: string | null;
  adminUserId?: string | null;
}): {
  accountLinks: NavigationLink[];
  showSignIn: boolean;
  showVendorApplication: boolean;
  showCustomerLaunchList: boolean;
} {
  if (input.authLoading) {
    return { accountLinks: [], showSignIn: false, showVendorApplication: false, showCustomerLaunchList: false };
  }
  if (!input.userId) {
    return {
      accountLinks: [{ label: 'Sign In', to: '/auth?mode=signin' }],
      showSignIn: true,
      showVendorApplication: true,
      showCustomerLaunchList: true
    };
  }

  const accountLinks: NavigationLink[] = [{ label: 'Account', to: '/account' }];
  if (!input.permissionsLoading) {
    if (isVerifiedMember(input.userId, input.adminUserId)) accountLinks.push({ label: 'Admin panel', to: '/admin' });
    if (input.vendorApplications.some(application => application.status === 'approved')) {
      accountLinks.push({ label: 'Vendor dashboard', to: '/vendor' });
    } else if (input.vendorApplicationError) {
      accountLinks.push({ label: 'Application status', to: '/account' });
    } else if (input.vendorApplications.length > 0) {
      const latestStatus = input.vendorApplications[0].status;
      const label = latestStatus === 'pending_review' ? 'Application pending'
        : latestStatus === 'under_review' ? 'Application under review'
          : latestStatus === 'contacted' ? 'Information requested'
            : latestStatus === 'declined' ? 'Application declined'
              : 'Application status';
      accountLinks.push({ label, to: '/account' });
    }
  }
  return {
    accountLinks,
    showSignIn: false,
    showVendorApplication: !input.permissionsLoading && !input.vendorApplicationError && input.vendorApplications.length === 0,
    showCustomerLaunchList: false
  };
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
