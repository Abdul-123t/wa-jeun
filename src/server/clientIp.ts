import { isIP } from 'node:net';
import { isProductionRuntime } from './runtimeMode';

type ExpressSettings = { set: (name: string, value: unknown) => unknown };

function trustedProxyRanges(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw.split(',').map(value => value.trim()).filter(Boolean);
}

function isIpOrCidr(value: string): boolean {
  const [address, prefix, ...extra] = value.split('/');
  if (extra.length || !address || !isIP(address)) return false;
  if (prefix === undefined) return true;
  if (!/^\d{1,3}$/.test(prefix)) return false;
  const bits = Number(prefix);
  // A world-wide trust range would make every socket peer trusted and let
  // clients choose their own req.ip through X-Forwarded-For.
  return bits > 0 && bits <= (isIP(address) === 4 ? 32 : 128);
}

/**
 * Configure Express's req.ip resolution from deployment-owned settings.
 * Production must explicitly state whether the app is directly exposed or
 * which proxy CIDRs it trusts. No request header can alter this policy.
 */
export function configureClientIpTrust(app: ExpressSettings, env: NodeJS.ProcessEnv = process.env): void {
  if (!isProductionRuntime(env)) {
    app.set('trust proxy', false);
    return;
  }

  // Vercel documents that it overwrites X-Forwarded-For with the requester IP
  // to prevent spoofing. Trust that platform-managed chain only in its Node
  // runtime; do not carry this policy to other hosts. If an outer proxy is
  // used, Vercel reports that proxy's IP unless its Trusted Proxy feature is
  // configured, which may cause users behind it to share a rate-limit bucket.
  if (env.VERCEL === '1') {
    app.set('trust proxy', true);
    return;
  }

  const mode = env.WAJEUN_CLIENT_IP_MODE?.trim();
  const ranges = trustedProxyRanges(env.WAJEUN_TRUSTED_PROXY_CIDRS);

  if (mode === 'direct' && ranges.length === 0) {
    app.set('trust proxy', false);
    return;
  }
  if (mode === 'trusted-proxy' && ranges.length > 0 && ranges.every(isIpOrCidr)) {
    try {
      app.set('trust proxy', ranges);
      return;
    } catch {
      throw new Error('Invalid trusted proxy configuration. Check WAJEUN_TRUSTED_PROXY_CIDRS.');
    }
  }
  throw new Error('Production requires WAJEUN_CLIENT_IP_MODE=direct or trusted-proxy with verified proxy CIDRs.');
}
