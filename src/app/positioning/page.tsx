"use client";

import { useMarket } from "@/components/providers/market";
import { PageHeader } from "@/components/shell/PageHeader";
import { ExpiryPicker } from "@/components/shell/ExpiryPicker";
import { Panel, Card, Chip } from "@/components/ui/primitives";
import { LoadingGrid } from "@/components/ui/Loading";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { cn, compact, num } from "@/lib/utils";

export default function PositioningPage() {
  const { snapshot, loading } = useMarket();

  if (loading || !snapshot) {
    return (
      <>
        <PageHeader title="Positioning" desc="Loading OI…" icon="bar-chart-3" />
        <LoadingGrid />
      </>
    );
  }

  const { chain, analytics } = snapshot;
  const region = chain.instrument.region;
  const atmIdx = chain.rows.findIndex((r) => r.strike === chain.atmStrike);
  const half = 14;
  const start = Math.max(0, Math.min(chain.rows.length - half * 2 - 1, atmIdx - half));
  const rows = chain.rows.slice(start, start + half * 2 + 1);
  const maxDiff = Math.max(1, ...rows.map((r) => Math.abs(r.put.oi - r.call.oi)));
  const maxOI = Math.max(1, ...rows.flatMap((r) => [r.call.oi, r.put.oi]));
  const peceDiff = analytics.totalPutOI - analytics.totalCallOI;
  const maxCallStrike = rows.reduce((a, b) => (b.call.oi > a.call.oi ? b : a), rows[0]).strike;
  const maxPutStrike = rows.reduce((a, b) => (b.put.oi > a.put.oi ? b : a), rows[0]).strike;

  return (
    <>
      <PageHeader
        title="Positioning"
        desc={`${chain.instrument.symbol} — where the option writers are: multi-strike PCR, PE-CE OI difference, OI walls (support / resistance) and max-pain.`}
        icon="bar-chart-3"
        right={<ExpiryPicker />}
      />

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="PCR (total)" value={analytics.pcr.toFixed(2)} sub={analytics.pcr > 1.1 ? "put-heavy · supportive" : analytics.pcr < 0.9 ? "call-heavy · capped" : "balanced"} tone={analytics.pcr > 1.1 ? "call" : analytics.pcr < 0.9 ? "put" : undefined} />
          <Stat label="Max pain" value={analytics.maxPain.toLocaleString()} sub={`${analytics.maxPain - chain.spot >= 0 ? "+" : ""}${num(analytics.maxPain - chain.spot, 0)} vs spot`} />
          <Stat label="PE − CE OI" value={`${peceDiff >= 0 ? "+" : ""}${compact(peceDiff, region)}`} sub={peceDiff >= 0 ? "net put OI" : "net call OI"} tone={peceDiff >= 0 ? "call" : "put"} />
          <Stat label="Support / Resistance" value={`${maxPutStrike.toLocaleString()} / ${maxCallStrike.toLocaleString()}`} sub="heaviest put / call OI" />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Panel className="lg:col-span-2" eyebrow="Multi-strike" title="Strike positioning — PCR & PE-CE OI difference" right={<AgentBadge id="argus" />}>
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-[64px_1fr_1fr_56px_1.4fr] gap-1 border-b border-border px-1 pb-1 text-3xs font-semibold uppercase tracking-wide text-fg-subtle">
                  <span>Strike</span><span className="text-right">Call OI</span><span className="text-right">Put OI</span><span className="text-right">PCR</span><span className="text-center">CE ◂ PE-CE OI ▸ PE</span>
                </div>
                <div className="max-h-[460px] overflow-y-auto">
                  {rows.map((r) => {
                    const isAtm = r.strike === chain.atmStrike;
                    const pcr = r.call.oi > 0 ? r.put.oi / r.call.oi : 0;
                    const diff = r.put.oi - r.call.oi;
                    const diffPct = (Math.abs(diff) / maxDiff) * 50;
                    return (
                      <div key={r.strike} className={cn("grid grid-cols-[64px_1fr_1fr_56px_1.4fr] items-center gap-1 border-b border-border/50 py-1 text-2xs tnum", isAtm && "bg-brand/[0.05]")}>
                        <span className={cn(isAtm ? "font-bold text-brand" : "font-medium text-fg")}>
                          {r.strike.toLocaleString()}
                          {r.strike === maxCallStrike ? <span className="ml-1 text-[8px] font-bold text-put">R</span> : null}
                          {r.strike === maxPutStrike ? <span className="ml-1 text-[8px] font-bold text-call">S</span> : null}
                        </span>
                        <span className="text-right text-fg-muted">{compact(r.call.oi, region)}</span>
                        <span className="text-right text-fg-muted">{compact(r.put.oi, region)}</span>
                        <span className={cn("text-right font-semibold", pcr > 1 ? "text-call" : "text-put")}>{pcr.toFixed(2)}</span>
                        {/* diverging PE-CE diff bar: call-dominant left (red), put-dominant right (green) */}
                        <div className="relative h-3">
                          <span className="absolute left-1/2 top-0 h-3 w-px bg-border-strong" />
                          {diff < 0 ? (
                            <span className="absolute top-0 h-3 rounded-l bg-put/70" style={{ right: "50%", width: `${diffPct}%` }} />
                          ) : (
                            <span className="absolute top-0 h-3 rounded-r bg-call/70" style={{ left: "50%", width: `${diffPct}%` }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Panel>

          <div className="space-y-3">
            <Panel eyebrow="Cumulative" title="OI change today" right={<AgentBadge id="argus" />}>
              <CumBar label="Call OI added" value={analytics.totalCallOIChange} max={Math.max(Math.abs(analytics.totalCallOIChange), Math.abs(analytics.totalPutOIChange), 1)} tone="put" region={region} />
              <CumBar label="Put OI added" value={analytics.totalPutOIChange} max={Math.max(Math.abs(analytics.totalCallOIChange), Math.abs(analytics.totalPutOIChange), 1)} tone="call" region={region} />
              <div className="mt-3 border-t border-border pt-2 text-2xs text-fg-muted">
                Net OI {analytics.totalPutOIChange - analytics.totalCallOIChange >= 0 ? "put" : "call"}-side build of{" "}
                <b className="text-fg">{compact(Math.abs(analytics.totalPutOIChange - analytics.totalCallOIChange), region)}</b>.{" "}
                {analytics.totalPutOIChange > analytics.totalCallOIChange ? "Writers are selling puts — building support below." : "Writers are selling calls — capping upside above."}
              </div>
            </Panel>

            <Panel eyebrow="Walls" title="OI support & resistance">
              <div className="space-y-2">
                <WallRow label="Resistance" strikes={analytics.resistance} tone="put" hint="call-OI walls — supply above" />
                <WallRow label="Support" strikes={analytics.support} tone="call" hint="put-OI walls — demand below" />
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "call" | "put" }) {
  return (
    <Card className="card-pad">
      <div className="label-eyebrow">{label}</div>
      <div className={cn("tnum mt-1 text-lg font-bold", tone === "call" ? "text-call" : tone === "put" ? "text-put" : "text-fg")}>{value}</div>
      {sub ? <div className="mt-0.5 text-3xs text-fg-subtle">{sub}</div> : null}
    </Card>
  );
}

function CumBar({ label, value, max, tone, region }: { label: string; value: number; max: number; tone: "call" | "put"; region: "IN" | "US" }) {
  const pct = (Math.abs(value) / max) * 100;
  return (
    <div className="mb-2">
      <div className="mb-0.5 flex items-center justify-between text-2xs">
        <span className="text-fg-muted">{label}</span>
        <span className={cn("tnum font-semibold", value >= 0 ? (tone === "call" ? "text-call" : "text-put") : "text-fg-subtle")}>{value >= 0 ? "+" : ""}{compact(value, region)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-bg-sunken">
        <span className={cn("block h-full rounded-full", tone === "call" ? "bg-call" : "bg-put")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function WallRow({ label, strikes, tone, hint }: { label: string; strikes: number[]; tone: "call" | "put"; hint: string }) {
  return (
    <div className="rounded-lg border border-border bg-panel-2 p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold text-fg">{label}</span>
        <span className="text-3xs text-fg-subtle">{hint}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {strikes.length === 0 ? <span className="text-2xs text-fg-subtle">—</span> : strikes.map((s) => (
          <Chip key={s} tone={tone} className="tnum">{s.toLocaleString()}</Chip>
        ))}
      </div>
    </div>
  );
}
