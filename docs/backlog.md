# POLY-ARB â€” Backlog

> Prioritized implementation checklist for .
> P0 = must ship (no demo without it). P1 = should ship (compelling demo). P2 = nice to have.

---

## P0 â€” Must Ship

### Foundation (Sprint 1)

- [x] Initialize Next.js 14+ project with App Router
- [x] Core type files: `src/lib/types.ts` (`Result<T>`, `Market`, `Signal`, `Direction`, `TradeProposal`, raw API shapes)
- [x] `src/lib/result.ts` â€” `ok()`, `err()`, `isOk()` helpers
- [x] `src/lib/model.ts` â€” Vercel AI SDK + Vertex AI Anthropic provider (lazy init)
- [x] `src/lib/config.ts` â€” env loading with defaults
- [x] `.env.example` with all required vars
- [x] `tsconfig.json` â€” strict mode
- [x] **Gate:** `npx tsc --noEmit` passes

### Database (Sprint 1)

- [x] `src/db/schema.ts` â€” Drizzle schema (signals, markets tables)
- [x] `src/db/index.ts` â€” Drizzle client with better-sqlite3 (lazy init)
- [x] `src/store/signals.ts` â€” Signal CRUD (saveSignal, getSignals, getSignalsByMarket, getRecentSignals)
- [x] `src/db/seed.ts` â€” Demo seed data (4 signals with realistic timestamps)
- [x] **Gate:** signals persist to SQLite and survive restart

### Data Wrappers (Sprint 1)

- [x] `src/data/polymarket.ts` â€” Gamma API wrapper (market discovery + metadata)
- [x] `src/data/polymarket.ts` â€” CLOB API wrapper (real-time prices + order book)
- [x] `src/data/valyu.ts` â€” Valyu search API wrapper (`/v1/deepsearch`)
- [x] `src/data/mock.ts` â€” Mock data providers (5 markets, topic-aware news)
- [x] All wrappers return `Result<T>`, never throw
- [x] Normalization: `GammaMarket` -> `Market` mapping (`gammaToMarket`)
- [x] Exponential backoff on rate limits (4 attempts: 0/1/2/4s)
- [x] `USE_MOCK_DATA` toggle for testing without API keys
- [x] **Gate:** real data fetches return valid typed responses _(Gamma âœ“ CLOB âœ“ Valyu âœ“ all live-verified 2026-02-21)_

### Agent (Sprint 1)

- [x] `src/agent/state.ts` â€” LangGraph state definition (Annotation.Root)
- [x] `src/agent/nodes.ts` â€” 4 node functions (fetchNews, estimateProbability, calculateDivergence, generateSignal)
- [x] `src/agent/graph.ts` â€” LangGraph StateGraph with conditional edges
- [x] `src/agent/tools.ts` â€” calculateEV, evToConfidence re-exports
- [x] `src/intelligence/calculations.ts` â€” EV calculation + confidence mapping
- [x] Event Pod mandate embedded in estimateProbabilityNode prompt
- [x] **Gate:** LangGraph graph compiles, mock pipeline produces valid Signal

### API Routes (Sprint 2)

- [x] `src/app/api/health/route.ts` â€” `GET /api/health`
- [x] `src/app/api/markets/route.ts` â€” `GET /api/markets`
- [x] `src/app/api/markets/[id]/route.ts` â€” `GET /api/markets/[id]`
- [x] `src/app/api/signals/route.ts` â€” `GET /api/signals`
- [x] `src/app/api/analyze/route.ts` â€” `POST /api/analyze`
- [x] All routes force-dynamic (no static generation issues)

### UI â€” Market Grid (Sprint 2)

- [x] `src/app/layout.tsx` â€” dark theme, Inter + JetBrains Mono fonts, QueryProvider
- [x] `src/app/page.tsx` â€” market grid page with stats bar
- [x] `src/components/market-card.tsx` â€” card with question, price, EV, alpha bar
- [x] `src/components/alpha-bar.tsx` â€” signature divergence visualization
- [x] `src/components/signal-badge.tsx` â€” confidence badge (low/medium/high)
- [x] `src/hooks/use-markets.ts` â€” React Query hook for markets
- [x] `src/hooks/use-signals.ts` â€” React Query hook for signals
- [x] Sorting by `|EV|` descending

### UI â€” Market Detail (Sprint 2)

- [x] `src/app/markets/[id]/page.tsx` â€” market detail page (two-column layout)
- [x] `src/components/analysis-feed.tsx` â€” signal + tool call timeline
- [x] Back button navigation
- [x] Market header (question, end date, volume, liquidity)
- [x] Signal details panel (Darwin estimate, market price, EV, reasoning)

---

## P1 â€” Should Ship

### Hero Moment (Sprint 3)

- [x] Demo flow: open grid -> see alpha signals -> click market -> see analysis
- [x] `src/components/query-interface.tsx` â€” text input to trigger on-demand analysis
- [x] `src/hooks/use-analysis.ts` â€” React Query mutation for POST /api/analyze
- [ ] Background scanner: run agent on interval (`CYCLE_INTERVAL_MS`)
- [x] Stats bar on grid page: active signals count, markets scanned, high-EV count
- [x] Loading states during analysis (spinner, skeleton)

### Polish (Sprint 3)

- [x] Tool call entries in analysis feed are collapsible
- [ ] Alpha bar tooltip with exact numbers on hover
- [x] Card hover elevation effect
- [x] Scan status indicator in header ("Last scan: 2 min ago")

---

### TradingView Chart Platform (Sprint 3+)

- [x] OHLC aggregation from raw price points (`src/lib/ohlc.ts`)
- [x] Chart type toggle: line / candlestick / area
- [x] Volume histogram (bottom 20%, green/red color coded)
- [x] Stable chart lifecycle (no teardown on data change)
- [x] True black background (#0A0A0F)
- [x] White default line, colored overlays only
- [x] Resizable multi-panel grid (CSS Grid + mouse drag)
- [x] Layout selector (1/2/4/6 panels)
- [x] Double-click border to reset panel sizes
- [x] Global chart settings context
- [x] Per-panel settings overrides with indicators + reset
- [x] Chart toolbar: type, timeframe, volume, overlay toggles
- [x] OHLC header (O:H:L:C:Vol)
- [x] Fair value overlay (yellow dashed price line, localStorage persistence)
- [x] Fair value editor (inline edit, custom vs AI indicator, reset)
- [x] Darwin estimate overlay toggle
- [x] Crosshair sync across compare panels
- [x] Framer-motion drag animations (opacity/scale)
- [x] Market grid filter bar (search, categories, sort, signal filter)

---

## P2 â€” Nice to Have

- [x] Responsive layout (3 col > 2 col > 1 col breakpoints)
- [x] Loading skeleton components for cards
- [ ] Error boundary components
- [x] Signal history (persists via SQLite, shown in analysis feed)
- [ ] PnL tracker (virtual: would you have made money?)
- [ ] Export signals as JSON/CSV
- [ ] Sound/visual notification on new high-EV signal
- [ ] Dark/light theme toggle
- [x] Market search/filter bar
- [ ] Keyboard navigation (j/k to move between cards)
- [ ] Sentiment overlay (needs data source)
- [ ] Keyboard shortcuts for chart type toggle

---

## Validation

- [x] `src/test/validate.ts` â€” 11-check validation script (all passing)
- [x] `scripts/validate.sh` â€” runner script
- [x] `npx tsc --noEmit` passes
- [x] `npm run build` passes
- [x] Mock data pipeline verified
- [x] Signal CRUD roundtrip verified
- [x] LangGraph graph compiles
- [x] `scripts/test-agent.ts` â€” full agent pipeline test (mock data + real LLM)
- [x] Vertex AI provider fixed (`@ai-sdk/google-vertex/anthropic` for Claude)
- [x] LLM brain produces calibrated probability estimates with reasoning
- [x] Conditional edges verified: sub-threshold EV correctly skips signal generation
