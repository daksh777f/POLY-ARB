"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { StarCanvas } from "@/components/galaxy-canvas"
import { PolyverseLogo } from "@/components/polyverse-logo"
import { LightweightChart } from "@/components/lightweight-chart"
import { AlphaBar } from "@/components/alpha-bar"
import { SignalBadge } from "@/components/signal-badge"
import { generateMockTimeSeries } from "@/lib/mock-timeseries"
import { formatProbability, formatEV, relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { UTCTimestamp } from "lightweight-charts"
import type { Market, Signal, MarketsResponse, SignalsResponse } from "@/lib/types"

// ─── Sub-components ──────────────────────────────────────────────────────────


// Left pane — mini chart + header for a single market
function MiniChartCard({ market, signal }: { market: Market; signal: Signal | null }) {
  const pts = useMemo(() => generateMockTimeSeries(market, signal), [market, signal])
  const isBullish = signal && signal.ev > 0

  const chartData = useMemo(
    () =>
      pts
        .filter((p) => p.timestamp && Number.isFinite(p.marketPrice))
        .map((p) => ({
          time: (new Date(p.timestamp).getTime() / 1000) as UTCTimestamp,
          value: p.marketPrice,
        })),
    [pts]
  )

  const darwinData = useMemo(() => {
    if (!signal) return undefined
    const d = pts
      .filter((p) => p.darwinEstimate !== null)
      .map((p) => ({
        time: (new Date(p.timestamp).getTime() / 1000) as UTCTimestamp,
        value: p.darwinEstimate!,
      }))
    return d.length > 0 ? d : undefined
  }, [signal, pts])

  return (
    <div className="flex flex-col border-b border-darwin-border last:border-b-0">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 space-y-1">
        <p className="text-[11px] text-darwin-text leading-tight line-clamp-2">
          {market.question}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 bg-darwin-elevated text-darwin-text-secondary rounded-sm">
            {market.category ?? "\u2014"}
          </span>
          {signal && (
            <span className={cn("font-data text-xs font-medium", isBullish ? "text-darwin-green" : "text-darwin-red")}>
              {formatEV(signal.ev)}
            </span>
          )}
          <span className="ml-auto font-data text-xs text-darwin-text">{formatProbability(market.probability)}</span>
        </div>
        {signal && (
          <AlphaBar darwinEstimate={signal.darwinEstimate} marketPrice={signal.marketPrice} size="sm" />
        )}
      </div>
      {/* Chart */}
      <div className="h-[120px] px-1 pb-1">
        <LightweightChart
          data={chartData}
          darwinData={darwinData}
          chartType="line"
          showVolume={false}
          showDarwinEstimate={!!signal}
          height={120}
        />
      </div>
    </div>
  )
}

// Right pane — signal feed entry
function SignalFeedEntry({ signal }: { signal: Signal }) {
  const isBullish = signal.ev > 0
  const color = isBullish ? "#00D47E" : "#FF4444"
  const label = isBullish ? "BULLISH" : "BEARISH"
  const confidence = signal.confidence

  return (
    <div className="px-4 py-3 border-b border-darwin-border last:border-b-0">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-[11px] text-darwin-text leading-tight line-clamp-2 flex-1">
          {signal.marketQuestion.length > 55 ? signal.marketQuestion.slice(0, 54) + "\u2026" : signal.marketQuestion}
        </p>
        <span
          className="shrink-0 text-[9px] font-semibold tracking-wider px-1.5 py-0.5 rounded-sm"
          style={{ background: `${color}20`, color }}
        >
          {label}
        </span>
      </div>
      <p className="text-[10px] text-darwin-text-muted leading-relaxed mb-2 line-clamp-2">
        {signal.reasoning}
      </p>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-darwin-text-secondary">
          Polyverse &middot; {relativeTime(signal.createdAt)}
        </span>
        <div className="flex-1">
          <div className="h-0.5 rounded-full bg-darwin-border overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${confidence === "high" ? 90 : confidence === "medium" ? 60 : 30}%`,
                background: color,
              }}
            />
          </div>
        </div>
        <SignalBadge confidence={confidence} />
      </div>
      {signal.newsEvents.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {signal.newsEvents.slice(0, 2).map((ev, i) => (
            <p key={i} className="text-[10px] text-darwin-text-muted">
              &bull; {ev}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [scrollY, setScrollY] = useState(0)

  const belowFoldRef = useRef<HTMLDivElement>(null)

  // Poll interval from env
  const pollMs = parseInt(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? "30000", 10)

  // Fetch live data with polling
  useEffect(() => {
    async function fetchData() {
      try {
        const [mRes, sRes] = await Promise.all([fetch("/api/markets"), fetch("/api/signals")])
        if (!mRes.ok || !sRes.ok) {
          setMarkets([])
          setSignals([])
          return
        }
        const mData = (await mRes.json()) as MarketsResponse
        const sData = (await sRes.json()) as SignalsResponse
        setMarkets(mData.markets ?? [])
        setSignals(sData.signals ?? [])
      } catch {
        setMarkets([])
        setSignals([])
      }
    }
    void fetchData()
    const iv = setInterval(() => void fetchData(), pollMs)
    return () => clearInterval(iv)
  }, [pollMs])

  // Track scroll position
  useEffect(() => {
    function onScroll() { setScrollY(window.scrollY) }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Selection logic
  const handleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev
      // Max 4 — drop oldest
      const next = prev.length >= 4 ? [...prev.slice(1), id] : [...prev, id]
      return next
    })
  }, [])

  const handleDeselect = useCallback((id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id))
  }, [])

  const handleDeselectAll = useCallback(() => {
    setSelectedIds([])
  }, [])

  const panesOpen = selectedIds.length > 0
  const overlayVisible = scrollY < 80

  // Build signal map
  const signalMap = useMemo(() => {
    const m = new Map<string, Signal>()
    for (const s of signals) m.set(s.marketId, s)
    return m
  }, [signals])

  // Selected markets/signals
  const selectedMarkets = useMemo(() =>
    selectedIds.map((id) => markets.find((m) => m.id === id)).filter((m): m is Market => !!m),
    [selectedIds, markets]
  )

  // Tabs for right pane
  const [activeSignalTab, setActiveSignalTab] = useState(0)
  useEffect(() => {
    // Reset to first tab when selection changes
    setActiveSignalTab(0)
  }, [selectedIds.length])

  const activeTabMarket = selectedMarkets[activeSignalTab] ?? selectedMarkets[0]
  const activeTabSignal = activeTabMarket ? signalMap.get(activeTabMarket.id) ?? null : null

  return (
    <div className="relative" style={{ background: "#000000" }}>
      {/* ── FIXED NAVBAR ────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-4"
        style={{
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          background: "rgba(0,0,0,0.35)",
          borderBottom: "1px solid rgba(42,42,58,0.4)",
        }}
      >
        <PolyverseLogo />
      </nav>

      {/* ── LEFT PANE ───────────────────────────────────────────────────── */}
      <div
        className="fixed top-0 left-0 h-full z-10 flex flex-col overflow-hidden border-r border-darwin-border transition-transform duration-300 ease-out"
        style={{
          width: "38vw",
          transform: panesOpen ? "translateX(0)" : "translateX(-100%)",
          background: "rgba(10,10,15,0.97)",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-darwin-border shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold tracking-wider text-darwin-text uppercase">
              Comparison
            </h2>
            <span className="text-[10px] text-darwin-text-muted">
              {selectedIds.length} market{selectedIds.length !== 1 ? "s" : ""} selected
            </span>
          </div>
          <button
            onClick={handleDeselectAll}
            className="text-darwin-text-muted hover:text-darwin-text text-xs transition-colors px-2 py-1"
            aria-label="Close pane"
          >
            ✕
          </button>
        </div>

        {/* Charts — tabs if 3–4, stacked if 1–2 */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {selectedMarkets.length <= 2 ? (
            // Stacked
            selectedMarkets.map((m) => (
              <MiniChartCard key={m.id} market={m} signal={signalMap.get(m.id) ?? null} />
            ))
          ) : (
            // Tabbed
            <>
              <div className="flex border-b border-darwin-border shrink-0 overflow-x-auto">
                {selectedMarkets.map((m, i) => (
                  <button
                    key={m.id}
                    onClick={() => setActiveSignalTab(i)}
                    className={cn(
                      "px-3 py-2 text-[10px] whitespace-nowrap transition-colors shrink-0",
                      i === activeSignalTab
                        ? "text-darwin-text border-b-2 border-darwin-text"
                        : "text-darwin-text-muted hover:text-darwin-text-secondary"
                    )}
                  >
                    {m.question.slice(0, 22)}&hellip;
                  </button>
                ))}
              </div>
              {selectedMarkets[activeSignalTab] && (
                <MiniChartCard
                  market={selectedMarkets[activeSignalTab]}
                  signal={signalMap.get(selectedMarkets[activeSignalTab].id) ?? null}
                />
              )}
            </>
          )}
          {selectedMarkets.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-darwin-text-muted">Select a star to view chart</p>
            </div>
          )}
        </div>

        {/* Footer link */}
        <div className="px-4 py-3 border-t border-darwin-border shrink-0">
          <Link
            href={`/compare${selectedIds.length > 0 ? `?add=${selectedIds[0]}` : ""}`}
            className="text-[11px] text-darwin-text-secondary hover:text-darwin-text transition-colors"
          >
            Open full comparison view &rarr;
          </Link>
        </div>
      </div>

      {/* ── RIGHT PANE ──────────────────────────────────────────────────── */}
      <div
        className="fixed top-0 right-0 h-full z-10 flex flex-col overflow-hidden border-l border-darwin-border transition-transform duration-300 ease-out"
        style={{
          width: "28vw",
          transform: panesOpen ? "translateX(0)" : "translateX(100%)",
          background: "rgba(10,10,15,0.97)",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-darwin-border shrink-0">
          <div className="h-2 w-2 rounded-full bg-darwin-green animate-pulse" />
          <h2 className="text-xs font-semibold tracking-wider text-darwin-text uppercase">
            Signal Feed
          </h2>
        </div>

        {/* Tabs per selected market */}
        {selectedMarkets.length > 1 && (
          <div className="flex border-b border-darwin-border shrink-0 overflow-x-auto">
            {selectedMarkets.map((m, i) => (
              <button
                key={m.id}
                onClick={() => setActiveSignalTab(i)}
                className={cn(
                  "px-3 py-2 text-[10px] whitespace-nowrap transition-colors shrink-0",
                  i === activeSignalTab
                    ? "text-darwin-text border-b-2 border-darwin-text"
                    : "text-darwin-text-muted hover:text-darwin-text-secondary"
                )}
              >
                {m.question.slice(0, 18)}&hellip;
              </button>
            ))}
          </div>
        )}

        {/* Signal entries */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {activeTabSignal ? (
            <SignalFeedEntry signal={activeTabSignal} />
          ) : activeTabMarket ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-darwin-text-muted">No signals detected yet</p>
              <p className="mt-1 text-[10px] text-darwin-text-muted">
                Agents are scanning this market
              </p>
            </div>
          ) : null}

          {/* All signals summary */}
          {signals.length > 0 && (
            <div className="px-4 py-3 border-t border-darwin-border mt-2">
              <p className="label-caps mb-2">Recent signals</p>
              {signals.slice(0, 5).map((sig) => {
                const isBull = sig.ev > 0
                return (
                  <div key={sig.id} className="flex items-center gap-2 py-1.5 border-b border-darwin-border/50 last:border-0">
                    <div
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: isBull ? "#00D47E" : "#FF4444" }}
                    />
                    <span className="text-[10px] text-darwin-text-secondary flex-1 line-clamp-1">
                      {sig.marketQuestion.slice(0, 40)}&hellip;
                    </span>
                    <span className={cn("font-data text-[10px] font-medium shrink-0", isBull ? "text-darwin-green" : "text-darwin-red")}>
                      {formatEV(sig.ev)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── SCROLLABLE PAGE CONTENT ─────────────────────────────────────── */}
      <div className="relative pointer-events-none" style={{ minHeight: "100vh" }}>

        {/* Hero section — transparent, 100vh, overlay text only */}
        <section className="relative h-screen flex flex-col pointer-events-none">
          {/* Star canvas — scoped to hero section only */}
          <div
            className="pointer-events-auto absolute inset-0"
            style={{ zIndex: 0 }}
            aria-hidden="true"
          >
            <StarCanvas className="w-full h-full" />
          </div>

          {/* Navbar spacer */}
          <div className="h-16 shrink-0" />

          {/* Radial gradient mask behind text block */}
          <div
            className="pointer-events-none absolute"
            style={{
              left: "50%",
              top: "42%",
              transform: "translate(-50%, -50%)",
              width: "680px",
              height: "440px",
              background: "radial-gradient(ellipse at center, rgba(0,0,0,0.72) 25%, transparent 72%)",
              zIndex: 1,
            }}
            aria-hidden="true"
          />

          {/* Hero text overlay */}
          <div
            className="flex flex-1 flex-col items-center justify-center text-center px-8"
            style={{ zIndex: 2 }}
          >
            <div
              className="space-y-5 transition-all duration-700"
              style={{
                opacity: overlayVisible ? 1 : 0,
                transform: overlayVisible ? "translateY(0)" : "translateY(-16px)",
                pointerEvents: overlayVisible ? "auto" : "none",
              }}
            >
              <p
                className="label-caps label-glow"
                style={{ letterSpacing: "0.18em", opacity: 0.7 }}
              >
                AI-ENABLED POLYMARKET INTELLIGENCE
              </p>

              <h1 className="hero-headline-glow max-w-xl text-5xl font-semibold leading-[1.08] tracking-tight text-darwin-text">
                See Prediction Markets in a New Light.
              </h1>

              <p
                className="mx-auto max-w-lg text-sm leading-relaxed"
                style={{ color: "rgba(255,255,255,0.80)" }}
              >
                Every active trade in the Polymarket universe &mdash; live pricing,
                real-time volume, and curated news in one view.
              </p>

              <div className="pt-3">
                <Link
                  href="/"
                  className="btn-glow inline-flex items-center gap-2 bg-darwin-text text-darwin-bg px-8 py-3 text-sm font-semibold tracking-wide"
                >
                  Explore the Universe
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
              </div>
            </div>

          </div>
        </section>
      </div>

      {/* ── BELOW THE FOLD (solid background, covers galaxy) ────────────── */}
      <div ref={belowFoldRef} className="relative z-10 pointer-events-auto" id="below-fold">

        {/* SECTION D — FOOTER */}
        <footer
          className="border-t border-darwin-border px-8 py-5"
          style={{ background: "#0A0A0F" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-darwin-text-muted">
              Polyverse &middot; Poly-Arb
            </span>
            <Link
              href="/"
              className="text-xs text-darwin-text-secondary transition-colors hover:text-darwin-text"
            >
              Enter Dashboard &rarr;
            </Link>
          </div>
        </footer>
      </div>

      {/* Mobile note (< 768px) */}
      <style>{`
        @media (max-width: 767px) {
          .panes-left, .panes-right { display: none !important; }
        }
        .btn-glow {
          border-radius: 9999px;
          transition: box-shadow 0.25s ease,
                      transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .btn-glow:hover {
          box-shadow: 0 0 16px rgba(255,255,255,0.45),
                      0 0 48px rgba(255,255,255,0.14);
        }
        .btn-glow:active {
          transform: scale(0.97);
          transition: transform 0.08s ease, box-shadow 0.1s ease;
          box-shadow: 0 0 8px rgba(255,255,255,0.25);
        }
        @keyframes hero-glow {
          from { text-shadow: 0 0 10px rgba(255,255,255,0.3); }
          to   { text-shadow: 0 0 30px rgba(255,255,255,0.7), 0 0 80px rgba(255,255,255,0.25); }
        }
        @keyframes label-glow {
          from { text-shadow: 0 0 5px rgba(255,255,255,0.15); }
          to   { text-shadow: 0 0 15px rgba(255,255,255,0.4), 0 0 40px rgba(255,255,255,0.15); }
        }
        .hero-headline-glow {
          animation: hero-glow 3.5s ease-in-out infinite alternate;
        }
        .label-glow {
          animation: label-glow 3.5s ease-in-out infinite alternate;
        }
      `}</style>
    </div>
  )
}
