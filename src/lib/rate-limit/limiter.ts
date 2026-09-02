import { isRedisConfigured } from "../env";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

// In-memory token bucket store for local development fallback
const memoryStore = new Map<string, { count: number; resetAt: number }>();
let hasWarnedRedisMissing = false;

/**
 * Checks rate limit for a given key and action.
 * Uses Redis if configured; otherwise logs a development warning and applies an in-memory window.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const windowMs = windowSeconds * 1000;
  const now = Date.now();

  if (isRedisConfigured()) {
    try {
      const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
      const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

      if (redisUrl && redisToken) {
        // Upstash REST API call
        const res = await fetch(`${redisUrl}/pipeline`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${redisToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([
            ["INCR", key],
            ["EXPIRE", key, windowSeconds, "NX"],
            ["TTL", key],
          ]),
        });

        if (res.ok) {
          const results = await res.json();
          const currentCount = results[0]?.result ?? 1;
          const ttl = results[2]?.result ?? windowSeconds;
          return {
            allowed: currentCount <= limit,
            remaining: Math.max(0, limit - currentCount),
            resetTime: now + ttl * 1000,
          };
        }
      }
    } catch (err) {
      console.error("[RateLimit] Error communicating with Redis:", err);
    }
  }

  // Development Fallback: Truthful Warning + In-memory Limiter
  if (!hasWarnedRedisMissing) {
    console.warn(
      "[RateLimit] Warning: Redis is unconfigured. Operating with in-memory development rate limiter (NOT suitable for multi-instance production)."
    );
    hasWarnedRedisMissing = true;
  }

  const existing = memoryStore.get(key);
  if (!existing || now > existing.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime: now + windowMs,
    };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    resetTime: existing.resetAt,
  };
}

export async function rateLimitMessage(userId: string): Promise<RateLimitResult> {
  return checkRateLimit(`rate:msg:${userId}`, 10, 10); // 10 messages per 10s
}

export async function rateLimitReport(userId: string): Promise<RateLimitResult> {
  return checkRateLimit(`rate:report:${userId}`, 10, 3600); // 10 reports per hour
}

export async function rateLimitAuth(identifier: string): Promise<RateLimitResult> {
  return checkRateLimit(`rate:auth:${identifier}`, 5, 900); // 5 attempts per 15 min
}

export async function rateLimitAnnouncement(userId: string): Promise<RateLimitResult> {
  return checkRateLimit(`rate:announcement:${userId}`, 20, 3600);
}

export async function rateLimitUpload(userId: string): Promise<RateLimitResult> {
  return checkRateLimit(`rate:upload:${userId}`, 20, 3600);
}
