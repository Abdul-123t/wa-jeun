import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const ipStore = new Map<string, RateLimitRecord>();
const MAX_RATE_LIMIT_ENTRIES = 50_000;

function removeExpired(now: number) {
  for (const [key, record] of ipStore) {
    if (now >= record.resetTime) ipStore.delete(key);
  }
}

// Counters are process-local. Deploy one instance until a shared atomic store
// is configured; cleanup bounds normal stale-entry growth between requests.
const cleanupTimer = setInterval(() => {
  removeExpired(Date.now());
}, 60 * 1000);
cleanupTimer.unref?.();

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  key: string;
  message?: string;
}) {
  const { windowMs, max, key: limiterKey, message = 'Too many requests. Please wait before submitting again.' } = options;
  if (!Number.isSafeInteger(windowMs) || windowMs <= 0 || !Number.isSafeInteger(max) || max <= 0 || !limiterKey.trim()) {
    throw new Error('Rate limiter requires a key, a positive window, and a positive request limit.');
  }

  return (req: Request, res: Response, next: NextFunction) => {
    // req.ip is resolved by Express from the socket and the explicitly
    // configured trust-proxy policy. Never read X-Forwarded-For here.
    const clientIp = typeof req.ip === 'string' && req.ip.trim()
      ? req.ip.trim()
      : req.socket?.remoteAddress || 'unknown';

    const now = Date.now();
    let bucketKey = `${limiterKey}\u0000${clientIp}`;
    let record = ipStore.get(bucketKey);

    if (!record || now > record.resetTime) {
      if (!record && ipStore.size >= MAX_RATE_LIMIT_ENTRIES - 1) {
        removeExpired(now);
        if (ipStore.size >= MAX_RATE_LIMIT_ENTRIES - 1) {
          // Keep memory bounded during high-cardinality source floods. Excess
          // sources share a short-lived overflow bucket instead of allocating.
          bucketKey = `${limiterKey}\u0000overflow`;
          record = ipStore.get(bucketKey);
        }
      }
    }

    if (!record || now >= record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      ipStore.set(bucketKey, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      res.setHeader('Retry-After', resetSeconds);
      return res.status(429).json({
        success: false,
        error: message,
        retryAfterSeconds: resetSeconds
      });
    }

    next();
  };
}

export function resetRateLimits() {
  ipStore.clear();
}
