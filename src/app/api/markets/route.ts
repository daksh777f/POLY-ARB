import { NextResponse } from "next/server"
import type { MarketsResponse } from "@/lib/types"
import { getAllMarkets, getMarketCount } from "@/store/markets"
import { fetchTrendingMarkets } from "@/data/polymarket"
import { apiLimiter } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  // Apply rate limiting - 100 requests per minute (from apiLimiter)
  const clientIP = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
  const rateLimitResult = apiLimiter.check(`markets:${clientIP}`)
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.resetAt },
      { 
        status: 429, 
        headers: { 
          "Retry-After": String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rateLimitResult.resetAt),
        } 
      }
    )
  }
  const { searchParams } = new URL(request.url)

  const page = parseInt(searchParams.get("page") ?? "1", 10) || 1
  const limit = parseInt(searchParams.get("limit") ?? "50", 10) || 50
  const sort = (searchParams.get("sort") ?? "volume24hr") as "volume24hr" | "volume" | "liquidity" | "probability" | "endDate"
  const category = searchParams.get("category") ?? undefined
  const search = searchParams.get("search") ?? undefined
  const marketIdsRaw = searchParams.get("marketIds") ?? undefined
  const marketIds = marketIdsRaw ? marketIdsRaw.split(",").filter(Boolean) : undefined

  // Check if we have synced markets in SQLite
  const dbCount = getMarketCount()

  if (dbCount > 0) {
    // Serve from SQLite
    const result = getAllMarkets({ page, limit, sort, category, search, marketIds })

    const response: MarketsResponse = {
      markets: result.markets,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      lastFetchedAt: new Date().toISOString(),
    }
    return NextResponse.json(response)
  }

  // Fallback: fetch from Gamma API directly (pre-sync)
  const result = await Promise.race([
    fetchTrendingMarkets({ limit: 50, pages: 2 }),
    new Promise<{ ok: false; error: string }>((resolve) =>
      setTimeout(() => resolve({ ok: false, error: "Timed out fetching upstream markets" }), 12000)
    ),
  ])

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        message: "Failed to fetch live markets from Polymarket",
      },
      { status: 503 },
    )
  }

  const response: MarketsResponse = {
    markets: result.data,
    total: result.data.length,
    page: 1,
    pageSize: result.data.length,
    totalPages: 1,
    lastFetchedAt: new Date().toISOString(),
  }
  return NextResponse.json(response)
}
