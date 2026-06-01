"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useMarket } from "@/components/providers/market";
import { provider } from "@/lib/data/provider";
import { PageHeader } from "@/components/shell/PageHeader";
import { ExpiryPicker } from "@/components/shell/ExpiryPicker";
import { Panel, Card, Chip, type Tone } from "@/components/ui/primitives";
import { LoadingGrid } from "@/components/ui/Loading";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { Icon } from "@/components/ui/Icon";
import { MarketHeader } from "@/components/panels/MarketHeader";
import { HermesBrief } from "@/components/panels/HermesBrief";
import { FindingsList } from "@/components/panels/FindingsList";
import { OIChart } from "@/components/charts/OIChart";
import { VolSmileChart } from "@/components/charts/VolSmileChart";
import { StrategyRankList } from "@/components/panels/StrategyRank";
import { cn, money, num, pct, compact } from "@/lib/utils";

type Buildup = "Long Buildup" | "Short Covering" | "Short Buildup" | "Long Unwinding";

const BUILDUP: Record<Buildup, { tone: Tone; price: string; oi: string; meaning: string }> = {
  "Long Buildup": { tone: "call", price: "up", oi: "up", meaning: "Fresh longs — price rising on rising OI. Bullish conviction." },
  "Short Covering": { tone: "call", price: "up", oi: "down", meaning: "Shorts buying back — price up as OI falls. Bullish, but less durable." },
  "Short Buildup": { tone: "put", price: "down", oi: "up", meaning: "Fresh shorts — price falling on rising OI. Bearish conviction." },
  "Long Unwinding": { tone: "put", price: "down", oi: "down", meaning: "Longs exiting — price down as OI falls. Bearish profit-taking." },
};

function classify(priceChgPct: number, oiChgPct: number): Buildup {
  const p = priceChgPct >= 0;
  const o = oiChgPct >= 0;
  if (p && o) return "Long Buildup";
  if (p && !o) return "Short Covering";
  if (!p && o) return "Short Buildup";
  return "Long Unwinding";
}

const TOOLS = [
  { href: "/option-chain", icon: "table", title: "Option Chain", desc: "Calls · strike · puts with live greeks, OI heat & click-to-trade." },
  { href: "/strategy-builder", icon: "sliders", title: "Strategy Builder", desc: "Up to 6 legs, premium-priced, payoff + technical chart & margin." },
  { href: "/portfolio", icon: "scale", title: "Portfolio", desc: "Strategy-wise MTM, combined greeks and MTM-based stop / target." },
  { href: "/strategies", icon: "layers", title: "Playbook", desc: "Strategies ranked to the live tape, with the reasoning behind each." },
  { href: "/backtesting", icon: "bar-chart-3", title: "Backtesting", desc: "Test a structure against history before you risk a rupee or dollar." },
  { href: "/cross-border", icon: "globe", title: "Cross-Border", desc: "US ↔ India, live FX and currency-adjusted P&L." },
];

export default function DashboardPage() {
  const { snapshot, agents, loading } = useMarket();

  // Cross-market activity board (iCharts-style OI buildup classification),
  // computed once on mount so it reads as a stable market-structure view.
  const activity = useMemo(() => {
    const now = Date.now();
    const out: { symbol: string; region: string; priceChgPct: number; oiChgPct: number; klass: Buildup }[] = [];
    for (const inst of provider.listInstruments(now)) {
      try {
        const snap = provider.buildSnapshot(inst.symbol, inst.expiries[0], now);
        const a = snap.analytics;
        const oiTot = a.totalCallOI + a.totalPutOI;
        const oiChgPct = oiTot ? ((a.totalCallOIChange + a.totalPutOIChange) / oiTot) * 100 : 0;
        out.push({ symbol: inst.symbol, region: inst.region, priceChgPct: snap.chain.spotChangePct, oiChgPct, klass: classify(snap.chain.spotChangePct, oiChgPct) });
      } catch { /* skip */ }
    }
    return out;
  }, []);

  if (loading || !snapshot || !agents) {
    return (
      <>
        <PageHeader title="Desk" desc="Loading the live options view…" icon="dashboard" />
        <LoadingGrid />
      </>
    );
  }

  const { chain, analytics } = snapshot;
  const ccy = chain.instrument.currency;
  const up = chain.spotChange >= 0;
  const netOIChange = analytics.totalCallOIChange + analytics.totalPutOIChange;
  const oiChgPct = (analytics.totalCallOI + analytics.totalPutOI) ? (netOIChange / (analytics.totalCallOI + analytics.totalPutOI)) * 100 : 0;
  const klass = classify(chain.spotChangePct, oiChgPct);
  const b = BUILDUP[klass];

  return (
    <>
      <PageHeader
        title="Desk"
        desc="Your options read at a glance — positioning, volatility and the structures that fit, coordinated by the Hermes agents."
        icon="dashboard"
        right={<ExpiryPicker />}
      />

      <div className="space-y-4">
        {/* Hero: price + the headline OI-buildup read */}
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-brand/12 text-3xs font-bold text-brand">{chain.instrument.region}</span>
                  <span className="text-sm font-semibold text-fg">{chain.instrument.symbol}</span>
                  <span className="text-2xs text-fg-subtle">{chain.instrument.name}</span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-2.5">
                  <span className="tnum text-4xl font-bold tracking-tight text-fg">{money(chain.spot, ccy, chain.spot > 1000 ? 0 : 2)}</span>
                  <span className={cn("tnum text-sm font-semibold", up ? "text-call" : "text-put")}>
                    {up ? "+" : ""}{num(chain.spotChange, chain.spot > 1000 ? 0 : 2)} ({pct(chain.spotChangePct)})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border bg-panel-2 px-4 py-3 lg:max-w-md">
              <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg", b.tone === "call" ? "bg-call-soft text-call" : "bg-put-soft text-put")}>
                <Icon name={b.tone === "call" ? "trending-up" : "trending-down"} size={18} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-fg">{klass}</span>
                  <Chip tone={b.tone} dot>price {b.price} · OI {b.oi}</Chip>
                </div>
                <p className="mt-0.5 text-2xs leading-relaxed text-fg-muted">{b.meaning}</p>
                <div className="mt-1 text-3xs tnum text-fg-subtle">
                  OI {netOIChange >= 0 ? "+" : ""}{compact(netOIChange, chain.instrument.region)} ({pct(oiChgPct)}) · <AgentBadgeInline /> Argus
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Index-level metrics (iCharts data points) */}
        <MarketHeader snapshot={snapshot} />

        {/* Hermes desk brief — AI synthesis, only where it adds value */}
        <HermesBrief result={agents} />

        {/* Market activity board — OI buildup across instruments */}
        <Panel
          eyebrow="Market activity"
          title="OI buildup — where positions are forming"
          right={<AgentBadge id="argus" />}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(Object.keys(BUILDUP) as Buildup[]).map((k) => {
              const items = activity.filter((a) => a.klass === k);
              const t = BUILDUP[k].tone;
              return (
                <div key={k} className="rounded-lg border border-border bg-panel-2 p-2.5">
                  <div className="mb-2 flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", t === "call" ? "bg-call" : "bg-put")} />
                    <span className="text-2xs font-semibold text-fg">{k}</span>
                    <span className="ml-auto text-3xs text-fg-subtle">{items.length}</span>
                  </div>
                  <div className="space-y-1">
                    {items.length === 0 ? (
                      <div className="py-2 text-center text-3xs text-fg-subtle">—</div>
                    ) : (
                      items.map((a) => (
                        <div key={a.symbol} className="flex items-center justify-between gap-2 text-2xs tnum">
                          <span className="font-medium text-fg">{a.symbol}</span>
                          <span className="flex items-center gap-2">
                            <span className={a.priceChgPct >= 0 ? "text-call" : "text-put"}>{pct(a.priceChgPct, 1)}</span>
                            <span className="text-fg-subtle">OI {pct(a.oiChgPct, 1)}</span>
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Positioning + volatility visualisations */}
        <div className="grid gap-3 lg:grid-cols-3">
          <Panel className="lg:col-span-2" eyebrow="Positioning" title="Open Interest by strike" right={<AgentBadge id="argus" />}>
            <OIChart chain={chain} analytics={analytics} />
          </Panel>
          <div className="space-y-3">
            <Panel eyebrow="Volatility" title="IV smile / skew" right={<AgentBadge id="helios" />}>
              <VolSmileChart chain={chain} maxStrikes={18} height={180} />
            </Panel>
            <Panel eyebrow="Hermes desk" title="Live findings">
              <FindingsList findings={agents.findings} limit={4} />
            </Panel>
          </div>
        </div>

        {/* Strategies that fit + tools map */}
        <div className="grid gap-3 lg:grid-cols-3">
          <Panel
            className="lg:col-span-2"
            eyebrow="Playbook"
            title="Strategies that fit these conditions"
            right={
              <div className="flex items-center gap-2">
                <AgentBadge id="athena" />
                <Link href="/strategies" className="inline-flex items-center gap-1 text-2xs font-medium text-brand hover:underline">All <Icon name="chevron-right" size={12} /></Link>
              </div>
            }
          >
            <StrategyRankList ranked={snapshot.ranked.slice(0, 5)} />
          </Panel>

          <Panel eyebrow="The terminal" title="Jump to a tool">
            <div className="grid gap-2">
              {TOOLS.map((t) => (
                <Link key={t.href} href={t.href} className="group flex items-start gap-2.5 rounded-lg border border-border bg-panel p-2.5 transition-colors hover:border-brand/40 hover:bg-bg-sunken">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                    <Icon name={t.icon} size={15} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-2xs font-semibold text-fg">
                      {t.title}
                      <Icon name="chevron-right" size={12} className="text-fg-subtle transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <p className="text-3xs leading-relaxed text-fg-subtle">{t.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function AgentBadgeInline() {
  return <span className="inline-flex h-1.5 w-1.5 -translate-y-px rounded-full" style={{ background: "hsl(152 60% 42%)" }} />;
}
