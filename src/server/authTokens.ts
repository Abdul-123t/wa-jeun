export type SupabaseAuthVerifier = {
  auth: {
    getUser: (accessToken: string) => Promise<{
      data: { user: { id: string } | null };
      error: { status?: number } | null;
    }>;
  };
};

export function parseBearerAuthorization(header: string | undefined): { provided: boolean; token: string | null } {
  if (!header) return { provided: false, token: null };
  const match = /^Bearer\s+([^\s]+)$/i.exec(header.trim());
  return { provided: true, token: match?.[1] ?? null };
}

export async function verifyAccessToken(
  verifier: SupabaseAuthVerifier,
  accessToken: string
): Promise<{ userId: string | null; statusCode: number | null }> {
  try {
    const { data, error } = await verifier.auth.getUser(accessToken);
    if (error) return { userId: null, statusCode: error.status === 400 || error.status === 401 ? 401 : 503 };
    if (!data.user?.id) return { userId: null, statusCode: 401 };
    return { userId: data.user.id, statusCode: null };
  } catch {
    return { userId: null, statusCode: 503 };
  }
}

export async function authorizeAdminHeader(
  header: string | undefined,
  verify: (token: string) => Promise<{ success: boolean; data?: { userId: string }; statusCode?: number; error?: string }>,
  hasMembership: (userId: string) => Promise<{ success: boolean; data?: boolean; statusCode?: number; error?: string }>
): Promise<{ userId: string; error?: never; statusCode?: never } | { userId?: never; error: string; statusCode: number }> {
  const authorization = parseBearerAuthorization(header);
  if (!authorization.token) return { error: 'Sign in with an administrator account to continue.', statusCode: 401 };
  try {
    const verified = await verify(authorization.token);
    if (!verified.success || !verified.data) return { error: verified.error || 'Your session could not be verified.', statusCode: verified.statusCode || 401 };
    const membership = await hasMembership(verified.data.userId);
    if (!membership.success) return { error: membership.error || 'Administrator access could not be verified.', statusCode: membership.statusCode || 503 };
    if (!membership.data) return { error: 'This account is not authorized to access the admin panel.', statusCode: 403 };
    return { userId: verified.data.userId };
  } catch {
    return { error: 'Administrator access could not be verified.', statusCode: 503 };
  }
}
