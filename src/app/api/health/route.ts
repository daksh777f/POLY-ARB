import { NextResponse } from "next/server"
import type { HealthResponse } from "@/lib/types"
import { getSignalCount, getLatestSignalTimestamp } from "@/store/signals"
import { startOrchestrator, getOrchestratorStatus } from "@/scanner/orchestrator"
import { db, schema } from "@/db"
import { getTradeStats } from "@/store/trade-log"
import { getPortfolioStats } from "@/store/portfolio"
import { config } from "@/lib/config"

const startTime = Date.now()

interface HealthCheckResult {
  name: string
  status: 'pass' | 'fail' | 'warn'
  latencyMs?: number
  message?: string
}

async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    // Simple query to test DB
    db.select({ id: schema.signals.id }).from(schema.signals).limit(1).all()
    return {
      name: 'database',
      status: 'pass',
      latencyMs: Date.now() - start,
    }
  } catch (error) {
    return {
      name: 'database',
      status: 'fail',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

async function checkExternalAPI(name: string, url: string): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
    return {
      name,
      status: response.ok ? 'pass' : 'warn',
      latencyMs: Date.now() - start,
      message: response.ok ? undefined : `HTTP ${response.status}`,
    }
  } catch (error) {
    return {
      name,
      status: 'fail',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Connection failed',
    }
  }
}

export async function GET() {
  // Ensure orchestrator starts on first health hit (lazy boot pattern).
  startOrchestrator()

  // Run all health checks in parallel
  const [
    dbHealth,
    polymarketHealth,
    orchestratorStatus,
    tradeStats,
    portfolioStats,
  ] = await Promise.all([
    checkDatabase(),
    checkExternalAPI('polymarket', 'https://clob.polymarket.com/health'),
    Promise.resolve(getOrchestratorStatus()),
    Promise.resolve(getTradeStats()),
    Promise.resolve(getPortfolioStats()),
  ])

  // Determine overall status
  const checks = [dbHealth, polymarketHealth]
  const failures = checks.filter(c => c.status === 'fail')
  const warnings = checks.filter(c => c.status === 'warn')
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  if (failures.length > 0) {
    overallStatus = 'unhealthy'
  } else if (warnings.length > 0) {
    overallStatus = 'degraded'
  }

  const response: HealthResponse = {
    status: overallStatus,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    lastScanAt: getLatestSignalTimestamp(),
    signalCount: getSignalCount(),
    scanner: {
      running: orchestratorStatus.running,
      lastScanAt: getLatestSignalTimestamp(),
      marketsScanned: orchestratorStatus.totalAnalyzed,
      signalsGenerated: orchestratorStatus.totalSignals,
      nextScanAt: null,
    },
    orchestrator: orchestratorStatus,
    // Extended health info
    _debug: {
      checks: {
        database: dbHealth,
        polymarket: polymarketHealth,
      },
      trading: {
        totalTrades: tradeStats?.total || 0,
        filledTrades: tradeStats?.filled || 0,
        failedTrades: tradeStats?.failed || 0,
        totalVolume: tradeStats?.totalVolume || 0,
      },
      portfolio: {
        totalCapital: portfolioStats?.portfolio?.totalCapital || 0,
        availableCapital: portfolioStats?.portfolio?.availableCapital || 0,
        totalPnL: portfolioStats?.portfolio?.totalPnL || 0,
        openPositions: portfolioStats?.openPositionsCount || 0,
      },
      config: {
        tradingEnabled: config.solana.enabled,
        polymarketConfigured: !!config.polymarketApiKey,
      },
    },
  }
  
  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503
  return NextResponse.json(response, { status: statusCode })
}
