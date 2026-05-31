"use client";

import type { PositionMark, PositionStatus } from "@/lib/agents/monitor";
import { cn, clamp, money, pct } from "@/lib/utils";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { Chip, type Tone } from "@/components/ui/primitives";

const STATUS_TONE: Record<PositionStatus, Tone> = {
  "target-hit": "call",
  "near-target": "call",
  running: "info",
  "near-stop": "warn",
  "stop-hit": "put",
};
const STATUS_LABEL: Record<PositionStatus, string> = {
  "target-hit": "Target hit",
  "near-target": "Near target",
  running: "In range",
  "near-stop": "Near stop",
  "stop-hit": "Stop breached",
};

export function PositionsMonitor({ marks }: { marks: PositionMark[] }) {
  if (marks.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-bg-sunken px-3 py-4 text-2xs text-fg-subtle">
        <AgentBadge id="nike" size="sm" /> No open positions — Nike is standing by.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      {marks.map((m) => {
        const p = m.position;
        const tone = STATUS_TONE[m.status];
        const up = m.pnl >= 0;
        // Gauge: where current P&L sits between stop (left) and target (right).
        const range = p.target - p.stop;
        const markerPct = clamp(((m.pnl - p.stop) / (range || 1)) * 100, 2, 98);
        const zeroPct = clamp(((0 - p.stop) / (range || 1)) * 100, 0, 100);
        return (
          <div key={p.id} className="rounded-lg border border-border bg-panel p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-brand/12 text-2xs font-bold text-brand">
                {p.region}
              </span>
              <span className="text-[13px] font-semibold text-fg">{p.symbol}</span>
              <span className="text-2xs text-fg-subtle">
                {p.strategyName} · {p.qtyLots} lot{p.qtyLots > 1 ? "s" : ""}
              </span>
              <Chip tone={tone} className="ml-auto">
                {STATUS_LABEL[m.status]}
              </Chip>
            </div>

            <div className="mt-2 flex items-end justify-between">
              <div>
                <div className="label-eyebrow">Live P&amp;L</div>
                <div className={cn("tnum text-lg font-bold leading-none", up ? "text-call" : "text-put")}>
                  {up ? "+" : ""}
                  {money(m.pnl, p.currency, 0)}
                </div>
              </div>
              <div className="text-right">
                <div className="tnum text-2xs text-fg-subtle">{pct(m.pnlPct)}</div>
                <div className="tnum text-2xs text-fg-subtle">spot {m.spot.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
            </div>

            {/* stop ↔ target gauge */}
            <div className="relative mt-2.5 h-1.5 rounded-full bg-bg-sunken">
              <span className="absolute inset-y-0 left-0 rounded-l-full bg-put/40" style={{ width: `${zeroPct}%` }} />
              <span className="absolute inset-y-0 rounded-r-full bg-call/40" style={{ left: `${zeroPct}%`, right: 0 }} />
              <span
                className={cn("absolute -top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-panel", up ? "bg-call" : "bg-put")}
                style={{ left: `${markerPct}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[9px] tnum text-fg-subtle">
              <span>stop {money(p.stop, p.currency, 0)}</span>
              <span>target {money(p.target, p.currency, 0)}</span>
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-2 rounded-lg bg-bg-sunken px-3 py-2">
        <AgentBadge id="nike" size="sm" />
        <p className="text-2xs text-fg-subtle">
          Nike re-marks every position on each refresh and raises a flag the moment P&amp;L approaches a stop or target.
        </p>
      </div>
    </div>
  );
}
