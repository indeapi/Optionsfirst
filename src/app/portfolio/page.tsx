"use client";

import { useMemo, useState } from "react";
import { provider } from "@/lib/data/provider";
import { useAppStore } from "@/lib/store/app";
import { useNow } from "@/lib/hooks/useNow";
import { daysToExpiry } from "@/lib/data/instruments";
import { bsGreeks } from "@/lib/quant/blackScholes";
import { markToMarket, monitorFindings, type PositionMark, type PositionStatus } from "@/lib/agents/monitor";
import type { LivePosition } from "@/lib/agents/monitor";
import type { OptionChain } from "@/lib/data/types";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel, Card, Chip, type Tone } from "@/components/ui/primitives";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { Icon } from "@/components/ui/Icon";
import { FindingsList } from "@/components/panels/FindingsList";
import { cn, money, num, pct, clamp, currencySymbol } from "@/lib/utils";
import Link from "next/link";

const STATUS: Record<PositionStatus, { tone: Tone; label: string }> = {
  "target-hit": { tone: "call", label: "Target hit" },
  "near-target": { tone: "call", label: "Near target" },
  running: { tone: "info", label: "In range" },
  "near-stop": { tone: "warn", label: "Near stop" },
  "stop-hit": { tone: "put", label: "Stop breached" },
};

function rfRate(region: "US" | "IN") {
  return region === "IN" ? 0.065 : 0.045;
}

function positionGreeks(p: LivePosition, spot: number, dte: number) {
  let delta = 0, gamma = 0, theta = 0, vega = 0;
  const r = rfRate(p.region);
  const t = Math.max(0.0001, dte / 365);
  for (const leg of p.legs) {
    const sgn = leg.action === "buy" ? 1 : -1;
    if (leg.right === "EQ") { delta += sgn * leg.qty * p.lotSize; continue; }
    const g = bsGreeks({ s: spot, k: leg.strike, t, r, sigma: leg.iv || 0.2, right: leg.right });
    delta += sgn * g.delta * leg.qty * p.lotSize;
    gamma += sgn * g.gamma * leg.qty * p.lotSize;
    theta += sgn * g.theta * leg.qty * p.lotSize;
    vega += sgn * g.vega * leg.qty * p.lotSize;
  }
  return { delta, gamma, theta, vega };
}

export default function PortfolioPage() {
  const holdings = useAppStore((s) => s.virtualHoldings);
  const now = useNow(2500);

  // Build (and keep refreshing) a chain per distinct symbol so every strategy
  // marks to its own underlying — not just the symbol on screen.
  const chains = useMemo(() => {
    const map = new Map<string, OptionChain>();
    for (const p of holdings) {
      const exp = p.legs.find((l) => l.expiry)?.expiry;
      const key = `${p.symbol}:${exp ?? ""}`;
      if (map.has(key)) continue;
      try {
        const inst = provider.getInstrument(p.symbol, now);
        const use = exp && inst?.expiries.includes(exp) ? exp : inst?.expiries[0];
        if (use) map.set(key, provider.buildSnapshot(p.symbol, use, now).chain);
      } catch { /* skip */ }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings, now]);

  const marks: PositionMark[] = holdings
    .map((p) => {
      const exp = p.legs.find((l) => l.expiry)?.expiry;
      const chain = chains.get(`${p.symbol}:${exp ?? ""}`);
      return chain ? markToMarket(p, chain) : null;
    })
    .filter((m): m is PositionMark => m !== null);

  const findings = marks.flatMap((m) => monitorFindings(m));

  // Aggregate P&L by currency.
  const pnlByCcy = new Map<string, number>();
  let capital = 0;
  for (const m of marks) {
    pnlByCcy.set(m.position.currency, (pnlByCcy.get(m.position.currency) ?? 0) + m.pnl);
    capital += Math.abs(m.position.entryNet * m.position.qtyLots);
  }

  // Group strategies by symbol.
  const bySymbol = new Map<string, PositionMark[]>();
  for (const m of marks) {
    const arr = bySymbol.get(m.position.symbol) ?? [];
    arr.push(m);
    bySymbol.set(m.position.symbol, arr);
  }

  return (
    <>
      <PageHeader
        title="Portfolio"
        desc="Your open strategies, grouped per underlying — live MTM, combined greeks and MTM-based risk controls."
        icon="layers"
        right={<AgentBadge id="nike" showTitle />}
      />

      {holdings.length === 0 ? (
        <Card className="card-pad flex flex-col items-center gap-3 py-12 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand">
            <Icon name="layers" size={24} />
          </span>
          <div>
            <div className="text-sm font-semibold text-fg">No open strategies yet</div>
            <p className="mx-auto mt-1 max-w-sm text-2xs text-fg-muted">
              Build and execute a strategy and it lands here as a single, strategy-wise position with its own P&amp;L and
              stop/target — no confusing flat list of legs.
            </p>
          </div>
          <Link href="/strategy-builder" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand/90">
            Open Strategy Builder
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Aggregate strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="card-pad">
              <div className="label-eyebrow">Open strategies</div>
              <div className="tnum mt-1 text-xl font-bold text-fg">{marks.length}</div>
            </Card>
            <Card className="card-pad">
              <div className="label-eyebrow">Live MTM P&amp;L</div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                {[...pnlByCcy.entries()].map(([ccy, v]) => (
                  <span key={ccy} className={cn("tnum text-xl font-bold", v >= 0 ? "text-call" : "text-put")}>
                    {v >= 0 ? "+" : ""}{money(v, ccy as "USD" | "INR", 0)}
                  </span>
                ))}
              </div>
            </Card>
            <Card className="card-pad">
              <div className="label-eyebrow">Capital deployed</div>
              <div className="tnum mt-1 text-xl font-bold text-fg">{money(capital, "USD", 0)}</div>
            </Card>
            <Card className="card-pad">
              <div className="label-eyebrow">Flags</div>
              <div className="tnum mt-1 text-xl font-bold text-fg">
                {marks.filter((m) => m.status !== "running").length}
              </div>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              {[...bySymbol.entries()].map(([symbol, group]) => (
                <Panel key={symbol} eyebrow="Underlying" title={symbol}>
                  <div className="space-y-2.5">
                    {group.map((m) => (
                      <StrategyCard key={m.position.id} mark={m} now={now} />
                    ))}
                  </div>
                </Panel>
              ))}
            </div>

            <Panel eyebrow="Live monitor" title="Risk alerts" right={<AgentBadge id="nike" />}>
              <FindingsList findings={findings} />
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

function StrategyCard({ mark, now }: { mark: PositionMark; now: number }) {
  const updateRisk = useAppStore((s) => s.updatePositionRisk);
  const closePos = useAppStore((s) => s.closeVirtualPosition);
  const p = mark.position;
  const st = STATUS[mark.status];
  const up = mark.pnl >= 0;
  const sym = currencySymbol(p.currency);

  const exp = p.legs.find((l) => l.expiry)?.expiry;
  const dte = exp ? daysToExpiry(exp, now) : 7;
  const g = positionGreeks(p, mark.spot, dte);

  // stop/target gauge
  const range = p.target - p.stop;
  const markerPct = clamp(((mark.pnl - p.stop) / (range || 1)) * 100, 2, 98);
  const zeroPct = clamp(((0 - p.stop) / (range || 1)) * 100, 0, 100);

  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-panel-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-fg">{p.strategyName}</span>
        <span className="text-2xs text-fg-subtle">{p.qtyLots} lot{p.qtyLots > 1 ? "s" : ""} · {p.legs.length} legs{exp ? ` · ${exp}` : ""}</span>
        <Chip tone={st.tone} className="ml-auto">{st.label}</Chip>
        <button onClick={() => closePos(p.id)} title="Close strategy" className="grid h-6 w-6 place-items-center rounded-md text-fg-subtle hover:bg-bg-sunken hover:text-put">
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <div className="label-eyebrow">MTM P&amp;L</div>
          <div className={cn("tnum text-base font-bold", up ? "text-call" : "text-put")}>
            {up ? "+" : ""}{money(mark.pnl, p.currency, 0)} <span className="text-2xs font-normal opacity-70">{pct(mark.pnlPct, 0)}</span>
          </div>
        </div>
        <Greek label="Delta" v={g.delta} />
        <Greek label="Theta" v={g.theta} accent />
        <Greek label="Vega" v={g.vega} />
      </div>

      {/* stop ↔ target gauge */}
      <div className="relative mt-3 h-1.5 rounded-full bg-bg-sunken">
        <span className="absolute inset-y-0 left-0 rounded-l-full bg-put/40" style={{ width: `${zeroPct}%` }} />
        <span className="absolute inset-y-0 rounded-r-full bg-call/40" style={{ left: `${zeroPct}%`, right: 0 }} />
        <span className={cn("absolute -top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-panel", up ? "bg-call" : "bg-put")} style={{ left: `${markerPct}%` }} />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-3xs tnum text-fg-subtle">
        <button onClick={() => setEditing((e) => !e)} className="inline-flex items-center gap-1 hover:text-fg">
          <Icon name="sliders" size={11} /> MTM stop {money(p.stop, p.currency, 0)} · target {money(p.target, p.currency, 0)}
        </button>
      </div>

      {editing ? (
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-md bg-bg-sunken p-2">
          <label className="text-3xs text-fg-subtle">
            Stop loss ({sym}, MTM)
            <input
              type="number"
              defaultValue={Math.abs(Math.round(p.stop))}
              onBlur={(e) => updateRisk(p.id, { stop: -Math.abs(Number(e.target.value) || 0) })}
              className="mt-0.5 w-full rounded border border-border bg-panel px-1.5 py-1 text-2xs tnum text-fg focus-ring"
            />
          </label>
          <label className="text-3xs text-fg-subtle">
            Target ({sym}, MTM)
            <input
              type="number"
              defaultValue={Math.round(p.target)}
              onBlur={(e) => updateRisk(p.id, { target: Math.abs(Number(e.target.value) || 0) })}
              className="mt-0.5 w-full rounded border border-border bg-panel px-1.5 py-1 text-2xs tnum text-fg focus-ring"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function Greek({ label, v, accent }: { label: string; v: number; accent?: boolean }) {
  return (
    <div>
      <div className="label-eyebrow">{label}</div>
      <div className={cn("tnum text-base font-bold", accent ? (v >= 0 ? "text-call" : "text-put") : "text-fg")}>
        {v >= 0 ? "+" : ""}{num(v, Math.abs(v) < 10 ? 2 : 0)}
      </div>
    </div>
  );
}
