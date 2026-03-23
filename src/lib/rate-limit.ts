/**
 * Rate Limiter - Simple in-memory rate limiter for API routes
 * Uses sliding window algorithm
 */

interface RateLimitEntry {
  count: number
  windowStart: number
}

class RateLimiter {
  private storage: Map<string, RateLimitEntry> = new Map()
  private windowMs: number
  private maxRequests: number
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
    this.startCleanup()
  }

  /**
   * Check if request is allowed and record it
   * Returns { allowed: boolean, remaining: number, resetAt: number }
   */
  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now()
    const entry = this.storage.get(key)

    // No existing entry - allow and create new
    if (!entry || now - entry.windowStart > this.windowMs) {
      this.storage.set(key, { count: 1, windowStart: now })
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt: now + this.windowMs,
      }
    }

    // Within window - check count
    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.windowStart + this.windowMs,
      }
    }

    // Increment count
    entry.count++
    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetAt: entry.windowStart + this.windowMs,
    }
  }

  /**
   * Get remaining requests without incrementing
   */
  getRemaining(key: string): number {
    const now = Date.now()
    const entry = this.storage.get(key)

    if (!entry || now - entry.windowStart > this.windowMs) {
      return this.maxRequests
    }

    return Math.max(0, this.maxRequests - entry.count)
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.storage.delete(key)
  }

  /**
   * Periodic cleanup of expired entries
   */
  private startCleanup(): void {
    if (this.cleanupInterval) return

    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.storage.entries()) {
        if (now - entry.windowStart > this.windowMs) {
          this.storage.delete(key)
        }
      }
    }, this.windowMs)

    // Don't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  /**
   * Cleanup on exit
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.storage.clear()
  }
}

// Pre-configured limiters for different use cases
export const apiLimiter = new RateLimiter(60000, 100) // 100 requests per minute
export const analysisLimiter = new RateLimiter(60000, 10) // 10 analyses per minute
export const scanLimiter = new RateLimiter(60000, 5) // 5 scans per minute

/**
 * Create a rate limit check middleware for API routes
 */
export function createRateLimitMiddleware(limiter: RateLimiter) {
  return function rateLimit(key: string): Response | null {
    const result = limiter.check(key)

    if (!result.allowed) {
      const response = new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(result.resetAt),
          },
        },
      )
      return response
    }

    return null // null means allowed
  }
}
