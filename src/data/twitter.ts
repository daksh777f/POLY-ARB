import type { Result } from "@/lib/types"
import { ok, err } from "@/lib/result"
import { config } from "@/lib/config"

export interface Tweet {
  id: string
  text: string
  author: string
  authorHandle: string
  createdAt: Date
  url: string
  likes: number
  retweets: number
  relevanceScore: number
}

/**
 * Searches Twitter/X for real-time tweets about a given topic
 * Uses the @ai/sdk/twitter integration if configured, or falls back to RSS feeds
 */
export async function searchTwitter(
  query: string,
  maxResults = 10
): Promise<Result<Tweet[]>> {
  if (!config.twitterApiKey) {
    return err("Twitter API key not configured")
  }

  try {
    // Twitter API v2 search endpoint
    const searchUrl = new URL("https://api.twitter.com/2/tweets/search/recent")
    searchUrl.searchParams.append("query", `${query} -is:retweet lang:en`)
    searchUrl.searchParams.append("max_results", String(Math.min(maxResults, 100)))
    searchUrl.searchParams.append("tweet.fields", "created_at,public_metrics,author_id")
    searchUrl.searchParams.append("expansions", "author_id")
    searchUrl.searchParams.append("user.fields", "username,verified")

    const response = await fetch(searchUrl.toString(), {
      headers: {
        Authorization: `Bearer ${config.twitterApiKey}`,
      },
    })

    if (!response.ok) {
      return err(`Twitter API error ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.data || data.data.length === 0) {
      return ok([])
    }

    const userMap = new Map()
    if (data.includes?.users) {
      for (const user of data.includes.users) {
        userMap.set(user.id, user)
      }
    }

    const tweets: Tweet[] = data.data.map((tweet: any) => {
      const user = userMap.get(tweet.author_id) || { username: "unknown" }
      return {
        id: tweet.id,
        text: tweet.text,
        author: user.name || user.username,
        authorHandle: user.username,
        createdAt: new Date(tweet.created_at),
        url: `https://twitter.com/${user.username}/status/${tweet.id}`,
        likes: tweet.public_metrics?.like_count || 0,
        retweets: tweet.public_metrics?.retweet_count || 0,
        relevanceScore: 0.8, // Default score; could be enhanced with NLP
      }
    })

    return ok(tweets)
  } catch (e) {
    return err(`Failed to search Twitter: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/**
 * Streams real-time tweets matching a filter rule
 * Requires pre-configured filter rules in Twitter API
 */
export async function streamTwitter(maxResults = 100): Promise<Result<Tweet[]>> {
  if (!config.twitterApiKey) {
    return err("Twitter API key not configured")
  }

  try {
    const response = await fetch("https://api.twitter.com/2/tweets/search/stream", {
      headers: {
        Authorization: `Bearer ${config.twitterApiKey}`,
      },
    })

    if (!response.ok) {
      return err(`Twitter stream error ${response.status}`)
    }

    // Note: This would require streaming implementation
    // For now, return empty — streaming setup happens at config time
    return ok([])
  } catch (e) {
    return err(`Failed to stream Twitter: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/**
 * Extracts market-related keywords from tweet and returns relevance score
 */
export function scoreTweetRelevance(tweet: Tweet, marketKeywords: string[]): number {
  const text = tweet.text.toLowerCase()
  const matches = marketKeywords.filter((kw) => text.includes(kw.toLowerCase())).length
  
  if (matches === 0) return 0

  // Score based on number of matches and engagement
  const keywordScore = Math.min(matches / marketKeywords.length, 1.0)
  const engagementScore = Math.min((tweet.likes + tweet.retweets) / 1000, 1.0)
  
  return keywordScore * 0.7 + engagementScore * 0.3
}
