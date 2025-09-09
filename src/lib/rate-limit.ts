interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class InMemoryRateLimit {
  private storage = new Map<string, RateLimitEntry>();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 8, windowMs: number = 60 * 60 * 1000) { // 8 requests per hour
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async check(identifier: string): Promise<{
    success: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  }> {
    const now = Date.now();
    const entry = this.storage.get(identifier);

    // Clean up expired entries periodically
    if (Math.random() < 0.01) { // 1% chance to clean up
      this.cleanup(now);
    }

    if (!entry || now >= entry.resetTime) {
      // Create new entry or reset expired one
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      this.storage.set(identifier, newEntry);

      return {
        success: true,
        remaining: this.maxRequests - 1,
        resetTime: newEntry.resetTime,
      };
    }

    if (entry.count >= this.maxRequests) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      return {
        success: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter,
      };
    }

    // Increment count
    entry.count++;
    this.storage.set(identifier, entry);

    return {
      success: true,
      remaining: this.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  private cleanup(now: number): void {
    for (const [key, entry] of this.storage.entries()) {
      if (now >= entry.resetTime) {
        this.storage.delete(key);
      }
    }
  }
}

// Global rate limiter instance
const rateLimiter = new InMemoryRateLimit();

export async function checkRateLimit(identifier: string) {
  return rateLimiter.check(identifier);
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: Request): string {
  // Try various headers that might contain the real IP
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'x-client-ip',
    'cf-connecting-ip', // Cloudflare
    'x-cluster-client-ip',
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const ip = value.split(',')[0].trim();
      if (ip) return ip;
    }
  }

  // Fallback to a default identifier
  return 'unknown';
}
