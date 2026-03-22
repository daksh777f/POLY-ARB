# POLY-ARB â€” UI/UX Specification

> Design spec for the hackathon frontend. Multi-page TradingView-grade terminal. True black theme, resizable panels, chart type toggles, overlay system.

---

## Design Principles

1. **Dark theme** â€” financial terminal aesthetic, easy on the eyes during long sessions
2. **Information density** â€” show as much relevant data as possible without clutter
3. **Color = signal** â€” green = bullish (underpriced), red = bearish (overpriced)
4. **Desktop-first** â€” responsive is P2, optimize for 1200px+ screens
5. **Polling, not push** â€” React Query polls API routes on interval, no WebSocket complexity

---

## Design Tokens

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `darwin-bg` | `#0A0A0F` | Page background (true black) |
| `darwin-card` | `#111118` | Card / panel background |
| `darwin-hover` | `#242838` | Hover state on cards |
| `darwin-elevated` | `#2A2E42` | Modal / dropdown / active toggle |
| `text-primary` | `#E8E8ED` | Primary text |
| `text-secondary` | `#8888A0` | Secondary / label text |
| `text-muted` | `#555566` | Disabled / placeholder text |
| `green` | `#00D47E` | Bullish / positive EV / underpriced |
| `red` | `#FF4444` | Bearish / negative EV / overpriced |
| `blue` | `#4488FF` | Links / tool call indicators |
| `warning` | `#FFAA00` | Warnings / medium confidence |
| `border` | `#2A2A3A` | Card borders, dividers |

### Typography

| Usage | Font | Weight | Size |
|-------|------|--------|------|
| UI text | Inter | 400/500/600 | 14px base |
| Data / numbers | JetBrains Mono | 400/500 | 14px |
| Headings | Inter | 600 | 18-24px |
| Small labels | Inter | 500 | 12px |

### Spacing Scale

`4px` / `8px` / `12px` / `16px` / `24px` / `32px`

### Border Radius

- Cards: `0` (sharp rectangles â€” TradingView style)
- Buttons: `0`
- Badges: `4px`
- Alpha bar: `2px`

### Chart Colors

| Element | Color | Notes |
|---------|-------|-------|
| Default market line | `#FFFFFF` | White â€” overlays use colors |
| Darwin estimate | `#00D47E` | Green dashed |
| Fair value line | `#FFAA00` | Yellow dashed |
| Candlestick up | `#00D47E` | Green |
| Candlestick down | `#FF4444` | Red |
| Volume up | `#00D47E80` | Green 50% opacity |
| Volume down | `#FF444480` | Red 50% opacity |
| Chart background | `#0A0A0F` | Matches page bg |
| Grid lines | `rgba(42,42,58,0.3)` | Subtle |

---

## Alpha Bar Component

The signature visual element. Shows the divergence between Darwin's estimate and the market price.

### Logic

```
divergence = darwinEstimate - marketPrice

if divergence > 0  â†’ green bar (bullish, market underpriced)
if divergence < 0  â†’ red bar (bearish, market overpriced)
if |divergence| < 0.02 â†’ hidden (no meaningful signal)

barWidth = min(|divergence| / 0.20, 1.0) Ã— 100%
  â†’ 20% divergence = full bar
  â†’ 5% divergence = 25% bar
```

### Interface

```typescript
interface AlphaBarProps {
  darwinEstimate: number   // 0-1
  marketPrice: number      // 0-1
  showLabel?: boolean      // show "+5.2%" text, default true
  size?: 'sm' | 'md'       // height: sm=4px, md=8px
}
```

### Visual

```
Bullish (darwinEstimate > marketPrice):

  Market: 0.45  Darwin: 0.62  EV: +0.17

  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
  â”‚  â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘ â”‚  85% width, green
  â”‚                                     +17.0%       â”‚
  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

Bearish (darwinEstimate < marketPrice):

  Market: 0.72  Darwin: 0.55  EV: -0.17

  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
  â”‚  â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘ â”‚  85% width, red
  â”‚                                     -17.0%       â”‚
  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

Neutral (|divergence| < 0.02):

  (hidden â€” no bar rendered)
```

### States

- **Bullish:** green fill, left-to-right
- **Bearish:** red fill, left-to-right
- **Neutral:** hidden entirely
- **Loading:** gray pulsing bar (skeleton animation)

---

## Page 1: Market Grid

The main dashboard. Shows all markets with active signals.

### Wireframe

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  POLY-ARB                              â— Scanning (2m ago)   â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Active Signals: 12    Markets Scanned: 847    High-EV: 3          â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                     â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ Will X win the       â”‚  â”‚ Fed rate cut in      â”‚  â”‚ France PM  â”‚â”‚
â”‚  â”‚ election?            â”‚  â”‚ March?               â”‚  â”‚ resign?    â”‚â”‚
â”‚  â”‚                      â”‚  â”‚                      â”‚  â”‚            â”‚â”‚
â”‚  â”‚ POLYMARKET           â”‚  â”‚ POLYMARKET           â”‚  â”‚ POLYMARKET â”‚â”‚
â”‚  â”‚                      â”‚  â”‚                      â”‚  â”‚            â”‚â”‚
â”‚  â”‚ Market  0.45         â”‚  â”‚ Market  0.72         â”‚  â”‚ Market 0.31â”‚â”‚
â”‚  â”‚ Darwin  0.62         â”‚  â”‚ Darwin  0.55         â”‚  â”‚ Darwin 0.48â”‚â”‚
â”‚  â”‚ EV     +0.17         â”‚  â”‚ EV     -0.17         â”‚  â”‚ EV   +0.17 â”‚â”‚
â”‚  â”‚                      â”‚  â”‚                      â”‚  â”‚            â”‚â”‚
â”‚  â”‚ â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ +17.0%  â”‚  â”‚ â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ -17.0%  â”‚  â”‚ â–ˆâ–ˆâ–ˆâ–ˆ +17%  â”‚â”‚
â”‚  â”‚ (green)              â”‚  â”‚ (red)                â”‚  â”‚ (green)    â”‚â”‚
â”‚  â”‚                      â”‚  â”‚                      â”‚  â”‚            â”‚â”‚
â”‚  â”‚ â—‰ High   2 min ago   â”‚  â”‚ â—‰ Medium  5 min ago  â”‚  â”‚ â—‰ High     â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”‚                                                                     â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ ...                  â”‚  â”‚ ...                  â”‚  â”‚ ...        â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”‚                                                                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Component Hierarchy

```
MarketGrid (page.tsx)
â”œâ”€â”€ Header
â”‚   â””â”€â”€ ScanStatus (last scan time, active/idle indicator)
â”œâ”€â”€ StatsBar
â”‚   â”œâ”€â”€ StatItem (active signals count)
â”‚   â”œâ”€â”€ StatItem (markets scanned)
â”‚   â””â”€â”€ StatItem (high-EV count)
â””â”€â”€ MarketCardGrid
    â””â”€â”€ MarketCard (repeated)
        â”œâ”€â”€ CardHeader (question, platform badge)
        â”œâ”€â”€ CardBody
        â”‚   â”œâ”€â”€ PriceRow (market price, darwin estimate, EV)
        â”‚   â””â”€â”€ AlphaBar
        â””â”€â”€ CardFooter (confidence badge, timestamp)
```

### Card Content

Each `MarketCard` displays:

| Element | Source | Format |
|---------|--------|--------|
| Question | `market.question` | Truncate at 80 chars |
| Platform | `market.platform` | Badge: "POLYMARKET" |
| Market Price | `market.probability` | 2 decimal places, JetBrains Mono |
| Darwin Estimate | `signal.darwinEstimate` | 2 decimal places, JetBrains Mono |
| EV | `signal.ev` | +/- prefix, green/red color |
| Alpha Bar | computed | See Alpha Bar spec above |
| Confidence | `signal.confidence` | Badge: green=high, yellow=medium, gray=low |
| Timestamp | `signal.createdAt` | Relative: "2 min ago" |

### Sorting

Default sort: `|signal.ev|` descending (highest divergence first)

### Responsive Breakpoints (P2)

- `> 1200px`: 3 columns
- `768px - 1200px`: 2 columns
- `< 768px`: 1 column

---

## Page 2: Market Detail

Deep dive into a single market with analysis feed.

### Wireframe

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  â† Back to Markets                                                  â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Will X win the 2026 election?                                      â”‚
â”‚  POLYMARKET  Â·  Ends Mar 15, 2026  Â·  Vol $2.4M  Â·  Liq $890K     â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                â”‚                                    â”‚
â”‚  MARKET PRICE                  â”‚  ANALYSIS FEED                     â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚                                    â”‚
â”‚  â”‚                          â”‚  â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚  0.45                    â”‚  â”‚  â”‚ â— Signal Generated       2m   â”‚â”‚
â”‚  â”‚  Current market price    â”‚  â”‚  â”‚                               â”‚â”‚
â”‚  â”‚                          â”‚  â”‚  â”‚ Darwin estimates 62%          â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚  â”‚ probability, market shows     â”‚â”‚
â”‚                                â”‚  â”‚ 45%. EV: +0.17                â”‚â”‚
â”‚  DARWIN ESTIMATE               â”‚  â”‚                               â”‚â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚  â”‚ Key factors:                  â”‚â”‚
â”‚  â”‚                          â”‚  â”‚  â”‚ - Recent poll showing...      â”‚â”‚
â”‚  â”‚  0.62                    â”‚  â”‚  â”‚ - Endorsement from...         â”‚â”‚
â”‚  â”‚  +17.0% divergence       â”‚  â”‚  â”‚                               â”‚â”‚
â”‚  â”‚  â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ green  â”‚  â”‚  â”‚ Confidence: â—‰ High            â”‚â”‚
â”‚  â”‚                          â”‚  â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚                                    â”‚
â”‚                                â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  SIGNAL DETAILS                â”‚  â”‚ â–¶ fetchRecentNews        2m   â”‚â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚  â”‚   query: "X election 2026"    â”‚â”‚
â”‚  â”‚  Direction: YES          â”‚  â”‚  â”‚   (click to expand)           â”‚â”‚
â”‚  â”‚  EV: +0.17               â”‚  â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”‚  â”‚  Confidence: High        â”‚  â”‚                                    â”‚
â”‚  â”‚  News events: 3          â”‚  â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚  Created: 2 min ago      â”‚  â”‚  â”‚ â–¶ estimateEventProb      2m   â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚  â”‚   probability: 0.62           â”‚â”‚
â”‚                                â”‚  â”‚   (click to expand)           â”‚â”‚
â”‚                                â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”‚                                â”‚                                    â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” [Analyze]â”‚
â”‚  â”‚  Ask Darwin about this market...                       â”‚          â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Component Hierarchy

```
MarketDetail (markets/[id]/page.tsx)
â”œâ”€â”€ BackButton
â”œâ”€â”€ MarketHeader
â”‚   â”œâ”€â”€ Question (h1)
â”‚   â””â”€â”€ MetaRow (platform badge, end date, volume, liquidity)
â”œâ”€â”€ DetailLayout (two-column at lg+, single-column below)
â”‚   â”œâ”€â”€ LeftPanel
â”‚   â”‚   â”œâ”€â”€ PriceDisplay (market price, large)
â”‚   â”‚   â”œâ”€â”€ EstimateDisplay (darwin estimate, alpha bar)
â”‚   â”‚   â””â”€â”€ SignalDetails (direction, EV, confidence, news count, timestamp)
â”‚   â””â”€â”€ RightPanel
â”‚       â””â”€â”€ AnalysisFeed
â”‚           â””â”€â”€ FeedEntry (repeated)
â”‚               â”œâ”€â”€ SignalEntry (green/red left border)
â”‚               â””â”€â”€ ToolCallEntry (blue left border, collapsible)
â””â”€â”€ QueryInterface
    â”œâ”€â”€ TextInput
    â””â”€â”€ AnalyzeButton
```

### Analysis Feed Entry Types

| Type | Border Color | Content | Interaction |
|------|-------------|---------|-------------|
| Signal | green (bullish) / red (bearish) | Reasoning, key factors, confidence | Static |
| Tool Call | blue | Tool name, input summary, output summary | Click to expand/collapse |
| Error | red | Error message | Static |
| User Query | none | Query text | Static |

### Responsive

- `>= 1024px (lg)`: two-column layout (left: prices + signal, right: analysis feed)
- `< 1024px`: single column, signal details above analysis feed

---

## Page 3: Compare View

Multi-panel TradingView-style layout with resizable panels.

### Features

- **Resizable grid**: CSS Grid with drag-to-resize borders. Double-click border to reset to equal sizes.
- **Layout options**: 1, 2, 4, or 6 panels via layout selector icons in header.
- **Per-panel settings**: Each panel has its own chart toolbar with local overrides (blue dot indicators). Reset button clears all overrides.
- **OHLC header**: `O:65.0 H:68.0 L:63.0 C:65.0 +2.0 (+3.1%) Vol:24` per panel.
- **Chart toolbar**: `[Line][Candle][Area] | [1D][1W][1M][ALL] | [Vol] | [Darwin][FV]`
- **Crosshair sync**: Toggle in header â€” when enabled, crosshair moves sync across all panels.
- **Drag-and-drop**: Reorder panels via drag. Framer-motion opacity/scale animation during drag. Blue ring drop zone.
- **Market swap**: Refresh icon opens search modal to change panel's market.

### Component Hierarchy

```
ComparePage
â”œâ”€â”€ Header (POLY-ARB | Compare | Layout selector | Sync toggle | Add Market)
â”œâ”€â”€ ResizableGrid (panelCount)
â”‚   â””â”€â”€ ComparePanel (repeated)
â”‚       â”œâ”€â”€ PanelHeader (grip, question, probability, signal badge, swap button)
â”‚       â”œâ”€â”€ OhlcHeader (O/H/L/C/Vol data)
â”‚       â”œâ”€â”€ ChartToolbar (type, timeframe, volume, overlays, reset)
â”‚       â”œâ”€â”€ LightweightChart (line/candle/area + volume + overlays)
â”‚       â””â”€â”€ PanelFooter (EV, Darwin, Market stats)
â””â”€â”€ MarketSearchModal
```

---

## Market Grid Filter Bar

Polymarket-style filtering on the main grid page.

### Filter Components

1. **Search**: Text input with icon, filters by market question or category.
2. **Sort buttons**: `[Alpha][Volume][Newest][Probability]` â€” Alpha sorts by |EV| descending.
3. **Signal filter**: `[All][Has Signal][High EV][Bullish][Bearish]`
4. **Category pills**: Horizontal scrolling row of category buttons extracted from market data. "All Categories" default.
5. **Clear filters**: Appears when any filter is active. Single button resets all.
6. **Results count**: `"X markets (filtered)"` shown above grid.

---

## Chart Component Architecture

### LightweightChart

Stable lifecycle: chart + all series created once on mount. Data updates via `series.setData()`. Series toggled via `applyOptions({ visible })`.

Series types (created upfront, toggled):
- AreaSeries (for area mode)
- LineSeries (for line mode)
- CandlestickSeries (for candlestick mode)
- HistogramSeries (volume, bottom 20% of chart)
- LineSeries (Darwin estimate overlay, dashed)
- PriceLine (fair value, yellow dashed)

### Settings Architecture

```
ChartSettingsProvider (global context)
  â””â”€â”€ usePanelSettings(panelId) (per-panel overrides)
       â”œâ”€â”€ Merges global + local overrides
       â”œâ”€â”€ isOverridden(key) â†’ blue dot indicator
       â”œâ”€â”€ setLocal(key, value) â†’ local override
       â””â”€â”€ resetAll() â†’ clear all overrides
```

---

## Component States

### MarketCard

| State | Visual |
|-------|--------|
| With signal | Full card: prices, alpha bar, confidence badge |
| No signal | Dimmed: market price only, no alpha bar, "No signal" text |
| Loading | Skeleton: gray pulsing blocks for each content area |
| Error | Red border, error message |

### AlphaBar

| State | Visual |
|-------|--------|
| Bullish | Green fill bar, "+X.X%" label |
| Bearish | Red fill bar, "-X.X%" label |
| Neutral | Hidden entirely (|divergence| < 0.02) |
| Loading | Gray pulsing bar, no label |

### AnalysisFeed Entry

| State | Visual |
|-------|--------|
| Signal (bullish) | Green left border, full reasoning |
| Signal (bearish) | Red left border, full reasoning |
| Tool call (collapsed) | Blue left border, tool name + "click to expand" |
| Tool call (expanded) | Blue left border, full input/output JSON |
| Error | Red left border, red text |
| User query | No border, italic text |

---

## Key Interactions

| Element | Action | Result |
|---------|--------|--------|
| MarketCard | Click | Navigate to `/markets/[id]` |
| MarketCard | Hover | `bg-card` -> `bg-hover`, subtle elevation |
| AlphaBar | Hover | Tooltip: "Darwin: 0.62 / Market: 0.45 / EV: +0.17" |
| ToolCallEntry | Click | Toggle expand/collapse, show full input/output |
| QueryInterface | Enter / click Analyze | POST to `/api/analyze`, show loading, append result to feed |
| BackButton | Click | Navigate to `/` (grid) |
| ConfidenceBadge | â€” | Static, color-coded (green/yellow/gray) |

---

## Tailwind Configuration

```javascript
// tailwind.config.js (relevant tokens)
{
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0A0A0F',
        'bg-card': '#12121A',
        'bg-hover': '#1A1A26',
        'bg-elevated': '#222233',
        'text-primary': '#E8E8ED',
        'text-secondary': '#8888A0',
        'text-muted': '#555566',
        'accent-green': '#00D47E',
        'accent-red': '#FF4444',
        'accent-blue': '#4488FF',
        'accent-warning': '#FFAA00',
        'border-default': '#2A2A3A',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
}
```
