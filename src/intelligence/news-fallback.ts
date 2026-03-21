/**
 * Multi-Source News System with Valyu Circuit Breaker
 * Reduces hard dependency on Valyu by adding fallback sources and caching
 */

import { searchNews as searchValyu } from '@/data/valyu';
import { searchTwitter } from '@/data/twitter';
import type { Result, NewsResult } from '@/lib/types';
import { ok, err } from '@/lib/result';

// Circuit breaker state
interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
  cooldownMs: number;
}

const circuitBreakerStates: Map<'valyu' | 'twitter', CircuitBreakerState> = new Map([
  ['valyu', { failureCount: 0, lastFailureTime: 0, state: 'closed', cooldownMs: 60_000 }],
  ['twitter', { failureCount: 0, lastFailureTime: 0, state: 'closed', cooldownMs: 30_000 }],
]);

/**
 * Check if a source is available (circuit breaker logic)
 */
function isSourceAvailable(source: 'valyu' | 'twitter'): boolean {
  const state = circuitBreakerStates.get(source);
  if (!state) return true;

  if (state.state === 'closed') return true;

  if (state.state === 'open') {
    const timeSinceFailure = Date.now() - state.lastFailureTime;
    if (timeSinceFailure > state.cooldownMs) {
      state.state = 'half-open';
      state.failureCount = 0;
      console.log(`[news-fallback] ${source} circuit: HALF-OPEN (retrying)`);
      return true;
    }
    return false;
  }

  // half-open: allow one attempt
  return true;
}

/**
 * Record a source failure (for circuit breaker)
 */
function recordFailure(source: 'valyu' | 'twitter'): void {
  const state = circuitBreakerStates.get(source);
  if (!state) return;

  state.failureCount++;
  state.lastFailureTime = Date.now();

  if (state.failureCount >= 3 && state.state !== 'open') {
    state.state = 'open';
    console.warn(`[news-fallback] ${source} circuit: OPEN (too many failures)`);
  }
}

/**
 * Record a source success (reset circuit breaker)
 */
function recordSuccess(source: 'valyu' | 'twitter'): void {
  const state = circuitBreakerStates.get(source);
  if (!state) return;

  if (state.state === 'half-open') {
    state.state = 'closed';
    state.failureCount = 0;
    console.log(`[news-fallback] ${source} circuit: CLOSED (recovered)`);
  }
}

/**
 * Search for news with fallback chain
 * Priority: Valyu (if available) → Twitter → Fallback (empty)
 */
export async function searchNewsMultiSource(
  query: string,
  maxResults = 5,
): Promise<Result<NewsResult[]>> {
  const results: NewsResult[] = [];

  // 1. Try Valyu (primary, most relevant)
  if (isSourceAvailable('valyu')) {
    const valyuResult = await searchValyu(query, maxResults);

    if (valyuResult.ok) {
      recordSuccess('valyu');
      results.push(...valyuResult.data);
      if (results.length >= maxResults) {
        return ok(results.slice(0, maxResults));
      }
    } else {
      recordFailure('valyu');
      console.warn(`[news-fallback] Valyu failed: ${valyuResult.error}`);
    }
  } else {
    console.warn(`[news-fallback] Valyu circuit breaker OPEN`);
  }

  // 2. Try Twitter (real-time, noisy but available)
  if (isSourceAvailable('twitter') && results.length < maxResults) {
    const twitterResult = await searchTwitter(query, maxResults - results.length);

    if (twitterResult.ok) {
      recordSuccess('twitter');
      results.push(
        ...twitterResult.data.map((tweet) => ({
          title: tweet.text.slice(0, 140),
          url: tweet.url,
          content: tweet.text,
          source: 'x',
          relevanceScore: tweet.relevanceScore,
        })),
      );
    } else {
      recordFailure('twitter');
      console.warn(`[news-fallback] Twitter failed: ${twitterResult.error}`);
    }
  }

  if (results.length === 0) {
    return err('No news sources available (all circuit breakers open or failed)');
  }

  return ok(results);
}

/**
 * Get circuit breaker status
 */
export function getCircuitBreakerStatus(): {
  valyu: string;
  twitter: string;
  allHealthy: boolean;
} {
  const valyuState = circuitBreakerStates.get('valyu');
  const twitterState = circuitBreakerStates.get('twitter');

  return {
    valyu: valyuState?.state || 'unknown',
    twitter: twitterState?.state || 'unknown',
    allHealthy: valyuState?.state === 'closed' && twitterState?.state === 'closed',
  };
}

/**
 * Manual circuit breaker reset (for testing/ops)
 */
export function resetCircuitBreaker(source?: 'valyu' | 'twitter'): void {
  if (source) {
    const state = circuitBreakerStates.get(source);
    if (state) {
      state.state = 'closed';
      state.failureCount = 0;
      console.log(`[news-fallback] ${source} circuit manually RESET`);
    }
  } else {
    circuitBreakerStates.forEach((state) => {
      state.state = 'closed';
      state.failureCount = 0;
    });
    console.log(`[news-fallback] All circuits manually RESET`);
  }
}
