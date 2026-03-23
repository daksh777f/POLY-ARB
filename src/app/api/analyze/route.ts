import { NextResponse } from "next/server"
import type { AnalyzeRequest, AnalyzeResponse, Signal } from "@/lib/types"
import { fetchMarketById } from "@/data/polymarket"
import { runEventPod } from "@/agent/graph"
import { logActivity } from "@/store/activity-log"
import { getMarketById } from "@/store/markets"
import { nanoid } from "nanoid"
import { config } from "@/lib/config"

// ─── Rate limiting ──────────────────────────────────────────────────────────

const activeAnalyses = new Set<string>()
const recentTimestamps: number[] = []

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function calculateFallbackEstimate(marketPrice: number, endDate: string, liquidity: number): number {
  const now = Date.now()
  const endTs = new Date(endDate).getTime()
  const msToExpiry = Math.max(0, endTs - now)
  const daysToExpiry = msToExpiry / (1000 * 60 * 60 * 24)

  // As expiry approaches, uncertainty increases and estimate mean-reverts toward 0.5.
  const timeUncertainty = clamp01(1 - Math.min(daysToExpiry, 365) / 365)
  // Deeper liquidity implies stronger confidence in market efficiency.
  const liquidityScore = clamp01(Math.log10(Math.max(1, liquidity)) / 7)

  const centered = marketPrice - 0.5
  const retention = 0.35 + 0.45 * liquidityScore - 0.20 * timeUncertainty
  const adjusted = 0.5 + centered * retention

  return clamp01(adjusted)
}

function buildFallbackReasoning(
  marketPrice: number,
  estimate: number,
  endDate: string,
  liquidity: number,
  sourceReasoning?: string,
): string {
  const daysToExpiry = Math.max(
    0,
    Math.round((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  )
  const edgeCents = ((estimate - marketPrice) * 100).toFixed(1)
  const liqBucket = liquidity >= 1_000_000 ? 'high' : liquidity >= 100_000 ? 'medium' : 'low'
  const base = `Fallback estimate uses deterministic calibration (time-to-expiry=${daysToExpiry}d, liquidity=${liqBucket}) with estimated edge ${edgeCents}c.`
  const upstream = summarizeUpstreamReasoning(sourceReasoning)
  if (!upstream) {
    return base
  }
  return `${base} Upstream detail: ${upstream}`
}

function summarizeUpstreamReasoning(sourceReasoning?: string): string {
  if (!sourceReasoning) {
    return ""
  }

  const text = sourceReasoning.trim()
  const normalizedText = text.replace(/^Probability estimation failed:\s*/i, '').trim()
  const lower = text.toLowerCase()
  const normalizedLower = normalizedText.toLowerCase()

  if (
    lower.includes('could not load the default credentials') ||
    lower.includes('application default credentials') ||
    lower.includes('google_application_credentials') ||
    lower.includes('permission_denied')
  ) {
    return 'AI provider authentication is not configured. Configure Google Vertex credentials and retry.'
  }

  if (
    lower.includes('forbidden') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid api key') ||
    lower.includes('authentication_error') ||
    normalizedLower === 'forbidden' ||
    normalizedLower === 'unauthorized'
  ) {
    return 'AI provider rejected credentials or lacks model access. Verify GROQ_API_KEY and allowed model, then retry.'
  }

  if (
    lower.includes('rate limit') ||
    lower.includes('quota') ||
    lower.includes('429')
  ) {
    return 'AI provider is temporarily rate-limited. Retry shortly.'
  }

  if (
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('econnreset') ||
    lower.includes('enotfound')
  ) {
    return 'AI provider request failed due to a transient network issue. Retry shortly.'
  }

  // Keep user-facing details concise and avoid leaking raw internals.
  return normalizedText.length > 180 ? `${normalizedText.slice(0, 177)}...` : normalizedText
}

function isRateLimited(marketId: string): string | null {
  if (activeAnalyses.has(marketId)) {
    return `Analysis already in progress for market ${marketId}`
  }

  const now = Date.now()
  const windowStart = now - 60_000
  // Remove timestamps outside the window
  while (recentTimestamps.length > 0 && recentTimestamps[0] < windowStart) {
    recentTimestamps.shift()
  }

  if (recentTimestamps.length >= config.rateLimit.maxAnalysesPerMinute) {
    return `Rate limit exceeded: max ${config.rateLimit.maxAnalysesPerMinute} analyses per minute`
  }

  if (activeAnalyses.size >= config.rateLimit.maxConcurrentAnalyses) {
    return `Max concurrent analyses reached (${config.rateLimit.maxConcurrentAnalyses})`
  }

  return null
}

export async function POST(request: Request) {
  const body = (await request.json()) as AnalyzeRequest
  const { marketId } = body

  const rateLimitError = isRateLimited(marketId)
  if (rateLimitError) {
    return NextResponse.json(
      { error: rateLimitError, status: 429 },
      { status: 429 }
    )
  }

  // Resolve market from local DB first (same source as UI list), then fallback to Gamma.
  const localMarket = getMarketById(marketId)
  let market = localMarket

  if (!market) {
    const marketResult = await fetchMarketById(marketId)
    if (!marketResult.ok) {
      return NextResponse.json(
        { error: `Market fetch failed: ${marketResult.error}`, status: 502 },
        { status: 502 }
      )
    }
    market = marketResult.data
  }

  activeAnalyses.add(marketId)
  recentTimestamps.push(Date.now())

  logActivity('analyze', 'info', `Manual analysis started: ${market.question.slice(0, 60)}`, { marketId })

  try {
    const { signal, reasoning, toolCalls } = await runEventPod(market)

    const fallbackEstimate = calculateFallbackEstimate(market.probability, market.endDate, market.liquidity)
    const fallbackReasoning = buildFallbackReasoning(
      market.probability,
      fallbackEstimate,
      market.endDate,
      market.liquidity,
      reasoning,
    )

    // Always return an analysis artifact for the UI, even when no tradeable divergence exists.
    const finalSignal = signal ?? {
      id: nanoid(),
      marketId: market.id,
      marketQuestion: market.question,
      darwinEstimate: fallbackEstimate,
      marketPrice: market.probability,
      ev: fallbackEstimate - market.probability,
      direction: fallbackEstimate >= 0.5 ? "yes" : "no",
      reasoning: fallbackReasoning,
      newsEvents: [],
      confidence: "low" as const,
      createdAt: new Date().toISOString(),
      expiresAt: market.endDate,
      tradeable: false,
    }

    if (signal) {
      logActivity('analyze', 'info', `Signal found: ${signal.direction.toUpperCase()} EV=${signal.ev.toFixed(3)}`, {
        marketId,
        ev: signal.ev,
        direction: signal.direction,
      })
    } else {
      logActivity('analyze', 'info', `Baseline analysis generated (not persisted) for ${market.question.slice(0, 40)}`, { marketId })
    }

    const response: AnalyzeResponse = {
      signal: finalSignal,
      reasoning,
      toolCalls,
    }

    return NextResponse.json(response)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logActivity('analyze', 'error', `Analysis failed: ${message}`, { marketId })

    const fallbackEstimate = calculateFallbackEstimate(market.probability, market.endDate, market.liquidity)
    const fallbackReasoning = buildFallbackReasoning(
      market.probability,
      fallbackEstimate,
      market.endDate,
      market.liquidity,
      message,
    )

    const fallbackSignal: Signal = {
      id: nanoid(),
      marketId: market.id,
      marketQuestion: market.question,
      darwinEstimate: fallbackEstimate,
      marketPrice: market.probability,
      ev: fallbackEstimate - market.probability,
      direction: fallbackEstimate >= 0.5 ? "yes" : "no",
      reasoning: fallbackReasoning,
      newsEvents: [],
      confidence: "low" as const,
      createdAt: new Date().toISOString(),
      expiresAt: market.endDate,
      tradeable: false,
    }

    const response: AnalyzeResponse = {
      signal: fallbackSignal,
      reasoning: fallbackSignal.reasoning,
      toolCalls: [],
    }
    return NextResponse.json(response)
  } finally {
    activeAnalyses.delete(marketId)
  }
}
