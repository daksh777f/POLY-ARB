# POLY-ARB â€” Agent System

> How the LLM agent works, what tools it has, and how to extend it.

---

## Agent Architecture â€” LangGraph StateGraph

The Event Pod agent is implemented as a LangGraph `StateGraph` with four nodes and
conditional edges. This replaces the earlier `generateText` tool-use loop design.

```
              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
              â”‚          LangGraph StateGraph                â”‚
              â”‚                                             â”‚
              â”‚   START                                     â”‚
              â”‚     â”‚                                       â”‚
              â”‚     â–¼                                       â”‚
              â”‚   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                     â”‚
              â”‚   â”‚  fetchNewsNode   â”‚ â”€â”€ Valyu API        â”‚
              â”‚   â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                     â”‚
              â”‚            â”‚                                â”‚
              â”‚     [conditional]                           â”‚
              â”‚     no news? â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º END    â”‚
              â”‚            â”‚                                â”‚
              â”‚            â–¼                                â”‚
              â”‚   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                 â”‚
              â”‚   â”‚ estimateProbability  â”‚ â”€â”€ Vertex AI    â”‚
              â”‚   â”‚   (generateObject)   â”‚    LLM call     â”‚
              â”‚   â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                 â”‚
              â”‚            â”‚                                â”‚
              â”‚            â–¼                                â”‚
              â”‚   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                 â”‚
              â”‚   â”‚ calculateDivergence  â”‚ â”€â”€ pure math    â”‚
              â”‚   â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                 â”‚
              â”‚            â”‚                                â”‚
              â”‚     [conditional]                           â”‚
              â”‚     |EV| < threshold? â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º END   â”‚
              â”‚            â”‚                                â”‚
              â”‚            â–¼                                â”‚
              â”‚   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                 â”‚
              â”‚   â”‚  generateSignal     â”‚ â”€â”€ persist to   â”‚
              â”‚   â”‚                      â”‚    SQLite       â”‚
              â”‚   â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                 â”‚
              â”‚            â”‚                                â”‚
              â”‚            â–¼                                â”‚
              â”‚          END                                â”‚
              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### State Definition (`src/agent/state.ts`)

```typescript
EventPodState = Annotation.Root({
  market: Market,              // input market to analyze
  newsResults: NewsResult[],   // from Valyu API
  probabilityEstimate: { probability, reasoning, confidence, keyFactors } | null,
  divergence: { value, direction, significant } | null,
  signal: Signal | null,       // final output, persisted to SQLite
  toolCalls: ToolCallRecord[], // accumulated across all nodes
  error: string | null,        // short-circuits graph on failure
})
```

### Entry Point (`src/agent/graph.ts`)

```typescript
runEventPod(market: Market): Promise<{ signal, reasoning, toolCalls }>
```

---

## Event Pod Mandate

This is the system prompt given to the Event Pod agent. It defines the agent's entire behavior.

```
You are a prediction market analyst specializing in detecting news-to-price lag.

Your goal: Find markets where recent news has moved reality but the market price
hasn't caught up yet.

Process:
1. Use fetchRecentNews to find recent news relevant to the market question
2. Use estimateEventProbability to form your own probability estimate based on the news
3. Use calculatePriceDivergence to compare your estimate against the market price
4. If the divergence exceeds the threshold, propose a trade with your reasoning

Rules:
- Always cite specific news events in your reasoning
- Be calibrated: a 70% estimate means you'd be wrong 30% of the time
- Consider the market's end date â€” news impact decays as resolution approaches
- If you can't find relevant recent news, do NOT propose a trade
- Prefer high-confidence signals over many low-confidence ones
```

---

## Tool Definitions

### Shared Tools

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `fetchMarkets` | `{ category?: string, limit?: number }` | `Market[]` | Fetch normalized markets from Polymarket |
| `calculateEV` | `{ estimatedProbability: number, marketPrice: number }` | `{ ev: number, direction: Direction }` | Expected value calculation |

### Event Pod Tools

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `fetchRecentNews` | `{ query: string, maxResults?: number }` | `{ results: NewsResult[] }` | Valyu API â€” recent news for a query |
| `estimateEventProbability` | `{ question: string, newsContext: string }` | `{ probability: number, reasoning: string, confidence: string, keyFactors: string[] }` | LLM sub-call to estimate probability |
| `calculatePriceDivergence` | `{ estimatedProbability: number, marketPrice: number }` | `{ divergence: number, direction: Direction, significant: boolean }` | Gap between estimate and market |
| `assessEventTimeline` | `{ endDate: string }` | `{ daysRemaining: number, urgency: string }` | Time until resolution |

---

## Node Implementation Details

The nodes are NOT traditional LangChain tools (no `@tool` decorator, no `DynamicTool`). They are plain async functions that receive state and return partial state updates. Each node logs a `ToolCallRecord` for the UI analysis feed.

### Node 1: `fetchNewsNode` (`src/agent/nodes.ts:14`)

Calls `searchNews()` from `src/data/valyu.ts`. Uses mock data when `USE_MOCK_DATA=true`.
Returns `newsResults` array. If no results or error, sets `state.error` which triggers early exit.

### Node 2: `estimateProbabilityNode` (`src/agent/nodes.ts:59`)

**This is the LLM brain.** Uses Vercel AI SDK `generateObject()` with a Zod schema to get structured output from Claude via Vertex AI.

**Prompt sent to the LLM:**
```
Given the following prediction market question and recent news, estimate the
probability that this question resolves YES.

Question: {market.question}
Current market price: {market.probability}%
Market end date: {market.endDate}

Recent News:
[source] title
content
...

Rules:
- Be calibrated: a 0.70 estimate means you'd be wrong 30% of the time
- Consider the market's end date - news impact decays as resolution approaches
- Always cite specific news events in your reasoning
- If news is ambiguous, stay close to the market price
```

**Response validated by Zod schema:**
```typescript
const probabilityEstimateSchema = z.object({
  probability: z.number().min(0).max(1),
  reasoning: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
  keyFactors: z.array(z.string()).min(1).max(5),
})
```

Uses `src/lib/model.ts` â€” lazy-initialized `claude-opus-4-5@20251101` via `@ai-sdk/google-vertex/anthropic`.

### Node 3: `calculateDivergenceNode` (`src/agent/nodes.ts:127`)

Pure math â€” no LLM call. Computes `ev = estimatedProbability - marketPrice`. Checks `|ev| >= config.evThreshold` (default 0.05). If not significant, the conditional edge routes to END.

### Node 4: `generateSignalNode` (`src/agent/nodes.ts:175`)

Creates a `Signal` object with `nanoid()` ID, persists it to SQLite via `saveSignal()`. Includes news citations as `newsEvents` array.

---

## EV (Expected Value) Calculation

**Location:** `src/intelligence/calculations.ts`

```typescript
ev = estimatedProbability - marketPrice
direction = ev >= 0 ? 'yes' : 'no'
```

**What it means:** If the LLM estimates probability at 0.78 and the market price is 0.62, EV = +0.16. Buying YES shares at $0.62 when they're "worth" $0.78 gives 16 cents of edge per share.

**Confidence mapping** (`evToConfidence`):
- `|ev| >= 0.15` â†’ high (strong signal)
- `|ev| >= 0.08` â†’ medium
- `|ev| < 0.08` â†’ low

**Threshold:** Signals are only generated when `|ev| >= EV_THRESHOLD` (default 0.05). Below that, the graph exits early â€” no signal saved.

---

## `estimateEventProbability` â€” Verified Test Results

Tested 2026-02-21 with mock data + real LLM calls (`claude-opus-4-5@20251101` on Vertex AI):

| Market | Market Price | Darwin Estimate | EV | Confidence | Signal? |
|--------|-------------|----------------|-----|-----------|---------|
| Fed rate cut before July 2026 | 0.62 | 0.78 | +0.16 | high | Yes |
| US recession in 2026 | 0.28 | 0.32 | +0.04 | â€” | No (below threshold) |

The LLM correctly cited specific news events and produced calibrated estimates. The conditional edge correctly filtered out the sub-threshold result.

---

## Signal Type

The agent produces `TradeProposal`s, which are mapped to `Signal` objects for the store and UI:

```typescript
interface Signal {
  id: string
  marketId: string
  marketQuestion: string
  darwinEstimate: number     // agent's probability estimate
  marketPrice: number        // current market price
  ev: number                 // darwinEstimate - marketPrice
  direction: Direction       // 'yes' | 'no'
  reasoning: string          // agent's explanation
  newsEvents: string[]       // cited news sources
  confidence: 'low' | 'medium' | 'high'
  createdAt: string          // ISO 8601
  expiresAt: string          // ISO 8601
}
```

### Mapping: `TradeProposal` -> `Signal`

```typescript
function proposalToSignal(proposal: TradeProposal, market: Market): Signal {
  return {
    id: generateId(),
    marketId: market.id,
    marketQuestion: market.question,
    darwinEstimate: proposal.estimatedProbability,
    marketPrice: proposal.marketProbability,
    ev: proposal.ev,
    direction: proposal.direction,
    reasoning: proposal.reasoning,
    newsEvents: [],  // extracted from tool call records
    confidence: evToConfidence(proposal.ev),
    createdAt: new Date().toISOString(),
    expiresAt: market.endDate,
  }
}
```

---

## Future Extensions

These are NOT in scope for the hackathon but documented for future reference:

- **Arbitrage Pod** â€” cross-platform price discrepancy detection (needs Kalshi integration)
- **Time-Series Pod** â€” time-decay anomaly detection near market expiry
- **Multi-agent debate** â€” multiple agents analyze the same market, consensus vote
- **Self-improving prompts** â€” agent mandates that evolve based on past accuracy
- **Risk manager** â€” algorithmic checks on position size, drawdown, concentration
