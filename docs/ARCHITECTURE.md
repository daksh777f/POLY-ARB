# POLY-ARB â€” Architecture

> Simplified for . Unified Next.js app, single strategy, Polymarket only.

---

## System Overview

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    NEXT.JS APP (unified)                         â”‚
â”‚                                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚        FRONTEND             â”‚  â”‚      API ROUTES           â”‚ â”‚
â”‚  â”‚                             â”‚  â”‚                           â”‚ â”‚
â”‚  â”‚  Market Grid (page.tsx)     â”‚  â”‚  GET /api/health          â”‚ â”‚
â”‚  â”‚  Market Detail ([id])       â”‚  â”‚  GET /api/markets         â”‚ â”‚
â”‚  â”‚  React Query (polling)      â”‚  â”‚  GET /api/markets/[id]    â”‚ â”‚
â”‚  â”‚  Tailwind dark theme        â”‚  â”‚  GET /api/signals         â”‚ â”‚
â”‚  â”‚                             â”‚  â”‚  POST /api/analyze        â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚             â”‚ fetch + poll                    â”‚                  â”‚
â”‚             â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                  â”‚
â”‚                           â–¼                                      â”‚
â”‚              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                          â”‚
â”‚              â”‚   SQLITE + DRIZZLE    â”‚                          â”‚
â”‚              â”‚   darwin.db           â”‚                          â”‚
â”‚              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                          â”‚
â”‚                          â–¼                                       â”‚
â”‚              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                          â”‚
â”‚              â”‚   EVENT POD AGENT      â”‚                          â”‚
â”‚              â”‚   (LangGraph StateGraph)â”‚                          â”‚
â”‚              â”‚                        â”‚                          â”‚
â”‚              â”‚   fetchNews â†’ estimate â”‚                          â”‚
â”‚              â”‚   â†’ divergence â†’ signalâ”‚                          â”‚
â”‚              â””â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”˜                          â”‚
â”‚                 â”‚                  â”‚                              â”‚
â”‚                 â–¼                  â–¼                              â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                     â”‚
â”‚  â”‚   Polymarket     â”‚  â”‚   Valyu          â”‚                     â”‚
â”‚  â”‚   Gamma + CLOB   â”‚  â”‚   Research API   â”‚                     â”‚
â”‚  â”‚   (market data)  â”‚  â”‚   (news context) â”‚                     â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                     â”‚
â”‚         EXTERNAL              EXTERNAL                           â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## Data Flow: Scan Cycle

Runs on interval (`CYCLE_INTERVAL_MS`, default 5 min):

```
1. FETCH    â†’ Polymarket Gamma API â†’ normalized Market[]
2. FILTER   â†’ politics category, min liquidity, ending-soon priority
3. ANALYZE  â†’ Event Pod agent runs tool-use loop on each market batch:
               fetchRecentNews â†’ estimateEventProbability â†’
               calculatePriceDivergence â†’ propose trade if |EV| > threshold
4. STORE    â†’ Signal objects persisted to SQLite via Drizzle ORM
5. SERVE    â†’ API routes read from SQLite â†’ React Query polls â†’ UI updates
```

## Data Flow: On-Demand Analysis

User clicks "Analyze" on a market detail page:

```
1. POST /api/analyze { marketId }
2. API route fetches single market from Polymarket
3. Event Pod agent runs full tool loop on that market
4. Signal persisted to SQLite
5. Signal returned to client
```

---

## Core Types

### `Market` â€” normalized market data (`src/lib/types.ts`)

```typescript
interface Market {
  id: string
  platform: 'polymarket'
  question: string
  probability: number     // 0-1, current market price
  volume: number          // total volume in USD
  liquidity: number       // current liquidity in USD
  endDate: string         // ISO 8601
  url: string
  category?: string
  lastUpdated: string     // ISO 8601
}
```

### `Signal` â€” agent output persisted to SQLite (`src/lib/types.ts`)

```typescript
interface Signal {
  id: string
  marketId: string
  marketQuestion: string
  darwinEstimate: number   // agent's probability estimate
  marketPrice: number      // current market price
  ev: number               // darwinEstimate - marketPrice
  direction: Direction     // 'yes' | 'no'
  reasoning: string
  newsEvents: string[]
  confidence: 'low' | 'medium' | 'high'
  createdAt: string
  expiresAt: string
}
```

### `AgentOutput` â€” what the agent returns (`src/lib/types.ts`)

```typescript
interface AgentOutput {
  proposals: TradeProposal[]
  reasoning: string
  toolCalls: ToolCallRecord[]
}
```

### `TradeProposal` â€” individual trade signal (`src/lib/types.ts`)

```typescript
interface TradeProposal {
  id: string
  marketId: string
  platform: 'polymarket'
  direction: Direction
  confidence: number
  estimatedProbability: number
  marketProbability: number
  ev: number
  reasoning: string
  timestamp: string
}
```

---

## EV Formula

```
EV = estimatedProbability - marketPrice
```

A trade is proposed when `|EV| > EV_THRESHOLD` (default 0.05).

- Positive EV â†’ buy YES (market underpriced)
- Negative EV â†’ buy NO (market overpriced)

---

## What Is NOT in MVP

Explicitly excluded to keep scope tight:

- No Kalshi â€” Polymarket only
- No arbitrage pod â€” single strategy
- No time-series pod â€” single strategy
- No risk manager â€” no position sizing, drawdown, concentration checks
- No virtual trading engine â€” signals only, no paper trading
- No WebSocket â€” polling via React Query
- No authentication â€” public dashboard
