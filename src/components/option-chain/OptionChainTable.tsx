"use client";

import type { OptionChain } from "@/lib/data/types";
import { cn, compact, num } from "@/lib/utils";

/**
 * Option-chain grid. Calls on the left, strike in the centre, puts on the
 * right — the layout every options trader already reads. OI cells carry an
 * inline heat bar, the ATM row is highlighted, and ITM cells are shaded. The
 * per-option day change is a first-order estimate (Δ × underlying move) until
 * the live per-contract change is fed in.
 */
const COLS = "grid-cols-[1.1fr_0.8fr_0.8fr_0.7fr_0.6fr_0.9fr_0.9fr_0.9fr_0.6fr_0.7fr_0.8fr_0.8fr_1.1fr]";

export function OptionChainTable({
  chain,
  maxStrikes = 33,
}: {
  chain: OptionChain;
  maxStrikes?: number;
}) {
  const atmIdx = chain.rows.findIndex((r) => r.strike === chain.atmStrike);
  const half = Math.floor(maxStrikes / 2);
  const start = Math.max(0, Math.min(chain.rows.length - maxStrikes, atmIdx - half));
  const rows = chain.rows.slice(start, start + maxStrikes);
  const maxOI = Math.max(1, ...rows.flatMap((r) => [r.call.oi, r.put.oi]));
  const region = chain.instrument.region;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[820px]">
        {/* group header */}
        <div className={cn("grid", COLS)}>
          <div className="col-span-6 border-b border-border px-2 py-1.5 text-center text-2xs font-semibold uppercase tracking-wide text-call">
            Calls
          </div>
          <div className="border-b border-border px-2 py-1.5 text-center text-2xs font-semibold uppercase tracking-wide text-fg-subtle">
            Strike
          </div>
          <div className="col-span-6 border-b border-border px-2 py-1.5 text-center text-2xs font-semibold uppercase tracking-wide text-put">
            Puts
          </div>
        </div>
        {/* column header */}
        <div className={cn("grid sticky top-0 z-10 bg-panel", COLS)}>
          {["OI", "Chg", "Vol", "IV", "Δ", "LTP", "", "LTP", "Δ", "IV", "Vol", "Chg", "OI"].map(
            (h, i) => (
              <div
                key={i}
                className={cn(
                  "border-b border-border px-2 py-1 text-2xs font-medium text-fg-subtle",
                  i === 6 ? "text-center" : i < 6 ? "text-right" : "text-left",
                )}
              >
                {h}
              </div>
            ),
          )}
        </div>

        <div className="max-h-[560px] overflow-y-auto">
          {rows.map((row) => {
            const isAtm = row.strike === chain.atmStrike;
            const callItm = row.strike < chain.spot;
            const putItm = row.strike > chain.spot;
            const callChg = row.call.greeks.delta * chain.spotChange;
            const putChg = row.put.greeks.delta * chain.spotChange;
            return (
              <div
                key={row.strike}
                className={cn(
                  "grid items-center border-b border-border/60 text-2xs tnum transition-colors hover:bg-bg-sunken/60",
                  COLS,
                  isAtm && "bg-brand/[0.05]",
                )}
                style={{ height: 26 }}
              >
                {/* CALL OI w/ heat bar */}
                <Cell align="right" shade={callItm}>
                  <Bar pct={(row.call.oi / maxOI) * 100} tone="call" side="right" />
                  <span className="relative">{compact(row.call.oi, region)}</span>
                </Cell>
                <Cell align="right" shade={callItm}>
                  <span className={row.call.oiChange >= 0 ? "text-call" : "text-put"}>
                    {row.call.oiChange >= 0 ? "+" : ""}
                    {compact(row.call.oiChange, region)}
                  </span>
                </Cell>
                <Cell align="right" shade={callItm} muted>
                  {compact(row.call.volume, region)}
                </Cell>
                <Cell align="right" shade={callItm} muted>
                  {(row.call.iv * 100).toFixed(1)}
                </Cell>
                <Cell align="right" shade={callItm} muted>
                  {row.call.greeks.delta.toFixed(2)}
                </Cell>
                <Cell align="right" shade={callItm}>
                  <span className="font-semibold text-fg">{num(row.call.ltp)}</span>
                  <span className={cn("ml-1", callChg >= 0 ? "text-call" : "text-put")}>
                    {callChg >= 0 ? "▲" : "▼"}
                  </span>
                </Cell>

                {/* STRIKE */}
                <div className="px-2 text-center">
                  <span className={cn(isAtm ? "font-bold text-brand" : "font-semibold text-fg")}>
                    {row.strike.toLocaleString()}
                  </span>
                </div>

                {/* PUT side */}
                <Cell align="left" shade={putItm}>
                  <span className="font-semibold text-fg">{num(row.put.ltp)}</span>
                  <span className={cn("ml-1", putChg >= 0 ? "text-call" : "text-put")}>
                    {putChg >= 0 ? "▲" : "▼"}
                  </span>
                </Cell>
                <Cell align="left" shade={putItm} muted>
                  {row.put.greeks.delta.toFixed(2)}
                </Cell>
                <Cell align="left" shade={putItm} muted>
                  {(row.put.iv * 100).toFixed(1)}
                </Cell>
                <Cell align="left" shade={putItm} muted>
                  {compact(row.put.volume, region)}
                </Cell>
                <Cell align="left" shade={putItm}>
                  <span className={row.put.oiChange >= 0 ? "text-call" : "text-put"}>
                    {row.put.oiChange >= 0 ? "+" : ""}
                    {compact(row.put.oiChange, region)}
                  </span>
                </Cell>
                <Cell align="left" shade={putItm}>
                  <Bar pct={(row.put.oi / maxOI) * 100} tone="put" side="left" />
                  <span className="relative">{compact(row.put.oi, region)}</span>
                </Cell>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Cell({
  children,
  align,
  shade,
  muted,
}: {
  children: React.ReactNode;
  align: "left" | "right";
  shade?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden px-2",
        align === "right" ? "text-right" : "text-left",
        shade && "bg-fg/[0.025]",
        muted && "text-fg-muted",
      )}
    >
      {children}
    </div>
  );
}

function Bar({ pct, tone, side }: { pct: number; tone: "call" | "put"; side: "left" | "right" }) {
  return (
    <div
      className={cn(
        "absolute top-0 h-full",
        tone === "call" ? "bg-call/10" : "bg-put/10",
        side === "right" ? "right-0" : "left-0",
      )}
      style={{ width: `${pct}%` }}
    />
  );
}
