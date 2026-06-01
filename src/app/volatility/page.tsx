"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useMarket } from "@/components/providers/market";
import { useAppStore } from "@/lib/store/app";
import { scanMarket } from "@/lib/quant/scanners";
import { getUsAnchor } from "@/lib/data/live/ibkrCapture";
import { PageHeader } from "@/components/shell/PageHeader";
import { ExpiryPicker } from "@/components/shell/ExpiryPicker";
import { Panel, Card } from "@/components/ui/primitives";
import { LoadingGrid } from "@/components/ui/Loading";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { VolSmileChart } from "@/components/charts/VolSmileChart";
import { cn, clamp } from "@/lib/utils";

export default function VolatilityPage() {
  const { snapshot, loading } = useMarket();
  const scan = useMemo(() => scanMarket(Date.now()), []);

  if (loading || !snapshot) {
    return (
      <>
        <PageHeader title="Volatility" desc="Loading IV…" icon="gauge" />
        <LoadingGrid />
      </>
    );
  }

  const { chain, analytics } = snapshot;
  const ivPct = analytics.atmIV * 100;
  const anchor = getUsAnchor(chain.instrument.symbol);
  const hv = (anchor?.histVol ?? analytics.atmIV * 0.86) * 100; // US: real 30d HV; else estimate
  const ivHvSpread = ivPct - hv;
  const ivRegime = analytics.ivRank < 0.33 ? "Low" : analytics.ivRank < 0.66 ? "Elevated" : "High";

  return (
    <>
      <PageHeader
        title="Volatility"
        desc={`${chain.instrument.symbol} — implied vol, IV rank / percentile, the IV-HV spread and the skew that drives strike selection.`}
        icon="gauge"
        right={<ExpiryPicker />}
      />

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="ATM IV" value={`${ivPct.toFixed(1)}%`} sub={`${ivRegime} regime`} />
          <Stat label="IV rank" value={(analytics.ivRank * 100).toFixed(0)} sub={`percentile ${(analytics.ivPercentile * 100).toFixed(0)}`} tone={analytics.ivRank > 0.66 ? "warn" : analytics.ivRank < 0.33 ? "call" : undefined} />
          <Stat label="30d HV" value={`${hv.toFixed(1)}%`} sub={anchor ? "IBKR realised" : "estimated"} />
          <Stat label="IV − HV" value={`${ivHvSpread >= 0 ? "+" : ""}${ivHvSpread.toFixed(1)}%`} sub={ivHvSpread > 0 ? "implied rich vs realised" : "implied cheap vs realised"} tone={ivHvSpread > 2 ? "warn" : ivHvSpread < 0 ? "call" : undefined} />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Panel className="lg:col-span-1" eyebrow="IV rank" title="Implied vol vs its own history" right={<AgentBadge id="helios" />}>
            <Gauge value={analytics.ivRank} />
            <p className="mt-3 text-2xs leading-relaxed text-fg-muted">
              {analytics.ivRank > 0.66
                ? "Premium is rich versus the last year — favour selling defined-risk credit (condors, spreads)."
                : analytics.ivRank < 0.33
                  ? "Premium is cheap — favour buying optionality (debit spreads, calendars, long straddles)."
                  : "Mid-range vol — let direction and time decide, don't over-pay or over-sell."}
            </p>
          </Panel>
          <Panel className="lg:col-span-2" eyebrow="Skew" title="IV smile — richer wings, fatter tails" right={<AgentBadge id="helios" />}>
            <VolSmileChart chain={chain} maxStrikes={24} height={230} />
          </Panel>
        </div>

        <Panel eyebrow="Scan" title="IV rank / percentile across instruments" right={<AgentBadge id="helios" />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-2xs">
              <thead>
                <tr className="text-fg-subtle">
                  <th className="px-2 py-1.5 text-left font-medium">Instrument</th>
                  <th className="px-2 py-1.5 text-right font-medium">ATM IV</th>
                  <th className="px-2 py-1.5 text-left font-medium">IV rank</th>
                  <th className="px-2 py-1.5 text-right font-medium">Percentile</th>
                  <th className="px-2 py-1.5 text-right font-medium">Exp. move</th>
                </tr>
              </thead>
              <tbody>
                {[...scan].sort((a, b) => b.ivRank - a.ivRank).map((r) => (
                  <ScanRowEl key={r.symbol} r={r} />
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

function ScanRowEl({ r }: { r: ReturnType<typeof scanMarket>[number] }) {
  const setSymbol = useAppStore((s) => s.setSymbol);
  return (
    <tr className="border-t border-border">
      <td className="px-2 py-1.5">
        <Link href="/volatility" onClick={() => setSymbol(r.symbol)} className="inline-flex items-center gap-1.5 hover:text-brand">
          <span className="grid h-4 w-4 place-items-center rounded bg-bg-sunken text-[8px] font-bold text-fg-subtle">{r.region}</span>
          <span className="font-medium text-fg">{r.symbol}</span>
        </Link>
      </td>
      <td className="px-2 py-1.5 text-right tnum text-fg-muted">{(r.iv * 100).toFixed(1)}%</td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-sunken">
            <span className={cn("block h-full rounded-full", r.ivRank > 0.66 ? "bg-warn" : r.ivRank < 0.33 ? "bg-call" : "bg-brand")} style={{ width: `${clamp(r.ivRank * 100, 2, 100)}%` }} />
          </span>
          <span className="tnum w-6 text-right text-fg">{(r.ivRank * 100).toFixed(0)}</span>
        </div>
      </td>
      <td className="px-2 py-1.5 text-right tnum text-fg-muted">{(r.ivPercentile * 100).toFixed(0)}</td>
      <td className="px-2 py-1.5 text-right tnum text-fg-muted">±{r.expectedMovePct.toFixed(1)}%</td>
    </tr>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "call" | "put" | "warn" }) {
  return (
    <Card className="card-pad">
      <div className="label-eyebrow">{label}</div>
      <div className={cn("tnum mt-1 text-xl font-bold", tone === "call" ? "text-call" : tone === "put" ? "text-put" : tone === "warn" ? "text-warn" : "text-fg")}>{value}</div>
      {sub ? <div className="mt-0.5 text-3xs text-fg-subtle">{sub}</div> : null}
    </Card>
  );
}

function Gauge({ value }: { value: number }) {
  const pct = clamp(value * 100, 0, 100);
  return (
    <div>
      <div className="flex items-end justify-between">
        <span className="tnum text-3xl font-bold text-fg">{pct.toFixed(0)}</span>
        <span className="text-3xs text-fg-subtle">/ 100</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gradient-to-r from-call/30 via-brand/30 to-warn/40">
        <div className="relative h-full">
          <span className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-fg" style={{ left: `${pct}%` }} />
        </div>
      </div>
      <div className="mt-1 flex justify-between text-3xs text-fg-subtle">
        <span>cheap</span><span>mid</span><span>rich</span>
      </div>
    </div>
  );
}
