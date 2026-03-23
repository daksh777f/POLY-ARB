import { NextResponse } from "next/server"
import type { SignalsResponse } from "@/lib/types"
import { getSignals, getSignalsCount } from "@/store/signals"
import { apiLimiter } from "@/lib/rate-limit"

export async function GET(request: Request) {
  // Rate limiting
  const clientIP = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
  const rateLimitResult = apiLimiter.check(`signals:${clientIP}`)
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)) } }
    )
  }

  const { searchParams } = new URL(request.url)

  // Pagination params
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")))

  // Filter params
  const confidence = searchParams.get("confidence") as
    | "low"
    | "medium"
    | "high"
    | null
  const minEvStr = searchParams.get("minEv")
  const minEv = minEvStr ? parseFloat(minEvStr) : undefined

  const filters = {
    confidence: confidence ?? undefined,
    minEv: isNaN(minEv as number) ? undefined : minEv,
  }

  // Get total count for pagination
  const total = getSignalsCount(filters)

  // Calculate offset
  const offset = (page - 1) * pageSize

  // Get paginated signals
  const signals = getSignals({
    ...filters,
    limit: pageSize,
    offset,
  })

  const totalPages = Math.ceil(total / pageSize)

  const response: SignalsResponse = {
    signals,
    total,
    page,
    pageSize,
    totalPages,
    lastFetchedAt: new Date().toISOString(),
  }
  return NextResponse.json(response)
}
