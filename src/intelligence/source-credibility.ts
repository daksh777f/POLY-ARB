/**
 * Source Credibility Engine — validates news sources before analysis
 * Scores domains by reputation, whitelists trusted sources, blacklists spam
 */

import { db } from '@/db';
import { schema } from '@/db';
import { desc, eq, lt } from 'drizzle-orm';

// Whitelist of highly trusted news sources
const TRUSTED_SOURCES = [
  'reuters.com',
  'apnews.com',
  'bbc.com',
  'bloomberg.com',
  'cnbc.com',
  'ft.com',
  'wsj.com',
  'theguardian.com',
  'nytimes.com',
  'economist.com',
  'financialtimes.com',
  'marketwatch.com',
  'reuters.com',
];

// Blacklist of low-quality/spam sources
const BLACKLISTED_DOMAINS = [
  'medium.com',
  'wordpress.com',
  'blogger.com',
  'tumblr.com',
];

export interface SourceCredibility {
  domain: string;
  credibilityScore: number; // 0-1
  category: 'news' | 'social' | 'blog' | 'unknown';
  reputationFlags: string[];
  whitelisted: boolean;
  blacklisted: boolean;
  trustLevel: 'trusted' | 'moderate' | 'low' | 'blocked';
}

/**
 * Rate a news source/domain
 * Returns credibility score and trust level
 */
export function rateNewsSource(domain: string): SourceCredibility {
  try {
    // Try cache first
    const cached = db.select()
      .from(schema.sourceRatings)
      .where(eq(schema.sourceRatings.domain, domain))
      .get();

    if (cached) {
      const reputationFlags = cached.reputationFlags ? JSON.parse(cached.reputationFlags) : [];
      return {
        domain,
        credibilityScore: cached.credibilityScore,
        category: cached.category as 'news' | 'social' | 'blog' | 'unknown',
        reputationFlags,
        whitelisted: !!cached.whitelisted,
        blacklisted: !!cached.blacklisted,
        trustLevel: cached.whitelisted ? 'trusted' : cached.blacklisted ? 'blocked' : computeTrustLevel(cached.credibilityScore),
      };
    }

    // Compute from scratch
    const rating = computeSourceRating(domain);

    // Cache result (1 week)
    db.insert(schema.sourceRatings).values({
      domain,
      credibilityScore: rating.credibilityScore,
      category: rating.category,
      reputationFlags: JSON.stringify(rating.reputationFlags),
      whitelisted: rating.whitelisted,
      blacklisted: rating.blacklisted,
      lastUpdated: new Date().toISOString(),
    }).run();

    return rating;
  } catch (e) {
    console.error(`[source-credibility] Failed to rate source:`, e instanceof Error ? e.message : String(e));
    // Safe fallback
    return {
      domain,
      credibilityScore: 0.3,
      category: 'unknown',
      reputationFlags: ['error'],
      whitelisted: false,
      blacklisted: false,
      trustLevel: 'low',
    };
  }
}

/**
 * Internal: compute credibility score for new domain
 */
function computeSourceRating(domain: string): SourceCredibility {
  const normalizedDomain = domain.toLowerCase().replace(/^(www\.|https?:\/\/)/, '');

  let credibilityScore = 0.5; // baseline
  const reputationFlags: string[] = [];

  // Whitelist boost
  if (TRUSTED_SOURCES.some((d) => normalizedDomain.includes(d))) {
    credibilityScore = 0.9;
    return {
      domain: normalizedDomain,
      credibilityScore,
      category: 'news',
      reputationFlags: [],
      whitelisted: true,
      blacklisted: false,
      trustLevel: 'trusted',
    };
  }

  // Blacklist rejection
  if (BLACKLISTED_DOMAINS.some((d) => normalizedDomain.includes(d))) {
    return {
      domain: normalizedDomain,
      credibilityScore: 0.1,
      category: 'unknown',
      reputationFlags: ['blacklisted', 'low-quality-source'],
      whitelisted: false,
      blacklisted: true,
      trustLevel: 'blocked',
    };
  }

  // Category detection
  let category: 'news' | 'social' | 'blog' | 'unknown' = 'unknown';

  if (normalizedDomain.includes('twitter.com') || normalizedDomain.includes('x.com')) {
    category = 'social';
    credibilityScore = 0.4; // social media is noisy
  } else if (normalizedDomain.includes('reddit.com') || normalizedDomain.includes('discord')) {
    category = 'social';
    credibilityScore = 0.2;
    reputationFlags.push('user-generated');
  } else if (normalizedDomain.includes('medium.com') || normalizedDomain.includes('substack')) {
    category = 'blog';
    credibilityScore = 0.3;
    reputationFlags.push('independent-blog');
  } else {
    category = 'news';
    credibilityScore = 0.6; // assume reasonable quality
  }

  // Domain age check (new domains are riskier)
  // This would require WHOIS lookup in production; skip for now
  // For now, any unknown domain starts lower
  // Check for obvious spam patterns
  if (normalizedDomain.length > 50 || normalizedDomain.includes('spam') || normalizedDomain.includes('bot')) {
    credibilityScore = Math.min(credibilityScore, 0.1);
    reputationFlags.push('spam-pattern');
  }

  return {
    domain: normalizedDomain,
    credibilityScore,
    category,
    reputationFlags,
    whitelisted: false,
    blacklisted: false,
    trustLevel: computeTrustLevel(credibilityScore),
  };
}

/**
 * Map credibility score to trust level
 */
function computeTrustLevel(score: number): 'trusted' | 'moderate' | 'low' | 'blocked' {
  if (score >= 0.8) return 'trusted';
  if (score >= 0.5) return 'moderate';
  if (score >= 0.2) return 'low';
  return 'blocked';
}

/**
 * Check if a source should be filtered out (blocked/low quality)
 */
export function shouldFilterNews(domain: string): boolean {
  const rating = rateNewsSource(domain);
  // Block if score < 0.3 or explicitly blacklisted
  return rating.credibilityScore < 0.3 || rating.blacklisted;
}

/**
 * Whitelist a domain manually (for trusted sources)
 */
export function whitelistDomain(domain: string): void {
  try {
    const normalizedDomain = domain.toLowerCase().replace(/^(www\.|https?:\/\/)/, '');

    db.update(schema.sourceRatings)
      .set({ whitelisted: true, credibilityScore: 0.95, lastUpdated: new Date().toISOString() })
      .where(eq(schema.sourceRatings.domain, normalizedDomain))
      .run();
  } catch (e) {
    console.error(`[source-credibility] Failed to whitelist domain:`, e instanceof Error ? e.message : String(e));
  }
}

/**
 * Blacklist a domain manually (for spam)
 */
export function blacklistDomain(domain: string): void {
  try {
    const normalizedDomain = domain.toLowerCase().replace(/^(www\.|https?:\/\/)/, '');

    db.update(schema.sourceRatings)
      .set({ blacklisted: true, credibilityScore: 0.05, lastUpdated: new Date().toISOString() })
      .where(eq(schema.sourceRatings.domain, normalizedDomain))
      .run();
  } catch (e) {
    console.error(`[source-credibility] Failed to blacklist domain:`, e instanceof Error ? e.message : String(e));
  }
}

/**
 * Get all source ratings (for dashboard)
 */
export function getAllSourceRatings(): SourceCredibility[] {
  try {
    const ratings = db.select()
      .from(schema.sourceRatings)
      .orderBy(desc(schema.sourceRatings.credibilityScore))
      .all() || [];

    return ratings.map((r) => ({
      domain: r.domain,
      credibilityScore: r.credibilityScore,
      category: r.category as 'news' | 'social' | 'blog' | 'unknown',
      reputationFlags: r.reputationFlags ? JSON.parse(r.reputationFlags) : [],
      whitelisted: !!r.whitelisted,
      blacklisted: !!r.blacklisted,
      trustLevel: computeTrustLevel(r.credibilityScore),
    }));
  } catch (e) {
    console.error(`[source-credibility] Failed to fetch ratings:`, e instanceof Error ? e.message : String(e));
    return [];
  }
}

/**
 * Prune stale ratings (> 30 days old)
 */
export function pruneStaleRatings(): number {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = db.delete(schema.sourceRatings)
      .where(lt(schema.sourceRatings.lastUpdated, thirtyDaysAgo.toISOString()))
      .run();

    return result.changes || 0;
  } catch (e) {
    console.error(`[source-credibility] Failed to prune ratings:`, e instanceof Error ? e.message : String(e));
    return 0;
  }
}
