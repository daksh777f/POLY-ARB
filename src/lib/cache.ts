/**
 * Simple in-memory cache with TTL support
 * Used for caching external API responses
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class SimpleCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTTL: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(defaultTTLMs: number = 60_000) {
    this.defaultTTL = defaultTTLMs;
    this.startCleanup();
  }

  /**
   * Destroy the cache and cleanup intervals
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }

  set(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private startCleanup(): void {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
        }
      }
    }, 60_000);
    
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }
}

// Pre-configured caches for different data types
export const priceCache = new SimpleCache<unknown>(30_000); // 30 seconds
export const marketCache = new SimpleCache<unknown>(60_000); // 1 minute
export const orderBookCache = new SimpleCache<unknown>(10_000); // 10 seconds
export const newsCache = new SimpleCache<unknown>(120_000); // 2 minutes

/**
 * Helper to cache API responses
 */
export async function cachedFetch<T>(
  cache: SimpleCache<T>,
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const result = await fetcher();
  cache.set(key, result, ttl);
  return result;
}

/**
 * Generate cache key from URL and params
 */
export function makeCacheKey(base: string, params?: Record<string, string>): string {
  if (!params) return base;
  const sorted = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  const query = new URLSearchParams(sorted).toString();
  return `${base}?${query}`;
}
