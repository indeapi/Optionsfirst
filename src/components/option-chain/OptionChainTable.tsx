"use client";

import type { OptionChain } from "@/lib/data/types";
import { cn, compact, num } from "@/lib/utils";
import { useAppStore } from "@/lib/store/app";

/**
 * Option-chain grid. Calls on the left, strike in the centre, puts on the
 * right — the layout every options trader already reads. OI cells carry an
 * inline heat bar, the ATM row is highlighted, and ITM cells are shaded.
 * Checked legs are updated in the global builder state.
 */
const COLS = "grid-cols-[0.4fr_1.1fr_0.8fr_0.8fr_0.7fr_0.6fr_0.9fr_0.9fr_0.9fr_0.6fr_0.7fr_0.8fr_0.8fr_1.1fr_0.4fr]";

export function OptionChainTable({
  chain,
  maxStrikes = 33,
}: {
  chain: OptionChain;
  maxStrikes?: number;
}) {
  const builderLegs = useAppStore((s) => s.builderLegs);
  const toggleBuilderLeg = useAppStore((s) => s.toggleBuilderLeg);
  const setActiveDraftOrder = useAppStore((s) => s.setActiveDraftOrder);

  const atmIdx = chain.rows.findIndex((r) => r.strike === chain.atmStrike);
  const half = Math.floor(maxStrikes / 2);
  const start = Math.max(0, Math.min(chain.rows.length - maxStrikes, atmIdx - half));
  const rows = chain.rows.slice(start, start + maxStrikes);
  const maxOI = Math.max(1, ...rows.flatMap((r) => [r.call.oi, r.put.oi]));
  const region = chain.instrument.region;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[860px]">
        {/* group header */}
        <div className={cn("grid", COLS)}>
          <div className="col-span-7 border-b border-border px-2 py-1.5 text-center text-2xs font-semibold uppercase tracking-wide text-call">
            Calls
          </div>
          <div className="border-b border-border px-2 py-1.5 text-center text-2xs font-semibold uppercase tracking-wide text-fg-subtle">
            Strike
          </div>
          <div className="col-span-7 border-b border-border px-2 py-1.5 text-center text-2xs font-semibold uppercase tracking-wide text-put">
            Puts
          </div>
        </div>
        {/* column header */}
        <div className={cn("grid sticky top-0 z-10 bg-panel border-b border-border/60", COLS)}>
          {[
            { label: "Select", desc: "Check this box to add this option leg to your Strategy Builder basket." },
            { label: "OI", desc: "Open Interest: The total number of active contracts held by market participants. High OI indicates strong interest at this strike." },
            { label: "Chg", desc: "Open Interest Change: The change in active contracts compared to the previous trading day." },
            { label: "Vol", desc: "Volume: The total number of contracts traded today." },
            { label: "IV", desc: "Implied Volatility: The market's expectation of future volatility, shown as a percentage. Higher IV means higher option prices." },
            { label: "Δ", desc: "Delta: Shows how much this option's price will change for a $1 increase in the stock price." },
            { label: "LTP", desc: "Last Traded Price: The price of the most recent transaction. Click this cell to trade it directly!" },
            { label: "Strike", desc: "The locked-in target price of the underlying stock." },
            { label: "LTP", desc: "Last Traded Price: The price of the most recent transaction. Click this cell to trade it directly!" },
            { label: "Δ", desc: "Delta: Shows how much this option's price will change for a $1 increase in the stock price." },
            { label: "IV", desc: "Implied Volatility: The market's expectation of future volatility, shown as a percentage. Higher IV means higher option prices." },
            { label: "Vol", desc: "Volume: The total number of contracts traded today." },
            { label: "Chg", desc: "Open Interest Change: The change in active contracts compared to the previous trading day." },
            { label: "OI", desc: "Open Interest: The total number of active contracts held by market participants. High OI indicates strong interest at this strike." },
            { label: "Select", desc: "Check this box to add this option leg to your Strategy Builder basket." }
          ].map(
            (h, i) => (
              <div
                key={i}
                title={h.desc}
                className={cn(
                  "px-2 py-1 text-2xs font-semibold text-fg-muted cursor-help transition-colors hover:text-brand",
                  i === 7 ? "text-center font-bold" : i < 7 ? "text-right" : "text-left",
                  (i === 0 || i === 14) && "text-center font-normal opacity-80"
                )}
              >
                {h.label}
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

            const isCallSelected = builderLegs.some(
              (l) => l.strike === row.strike && l.right === "CE"
            );
            const isPutSelected = builderLegs.some(
              (l) => l.strike === row.strike && l.right === "PE"
            );

            return (
              <div
                key={row.strike}
                className={cn(
                  "grid items-center border-b border-border/60 text-2xs tnum transition-colors hover:bg-bg-sunken/60",
                  COLS,
                  isAtm && "bg-brand/[0.04]",
                )}
                style={{ height: 26 }}
              >
                {/* CALL Selection Checkbox */}
                <div className={cn("flex justify-center px-1 h-full items-center border-r border-border/40", isCallSelected && "bg-call/10")}>
                  <input
                    type="checkbox"
                    checked={isCallSelected}
                    onChange={() =>
                      toggleBuilderLeg({
                        action: "buy",
                        right: "CE",
                        strike: row.strike,
                        qty: 1,
                        premium: row.call.ltp,
                        iv: row.call.iv,
                        expiry: chain.expiry,
                      })
                    }
                    className="h-3 w-3 rounded border-border text-call focus:ring-call bg-panel"
                  />
                </div>

                {/* CALL OI w/ heat bar */}
                <Cell align="right" shade={callItm} selected={isCallSelected}>
                  <Bar pct={(row.call.oi / maxOI) * 100} tone="call" side="right" />
                  <span className="relative">{compact(row.call.oi, region)}</span>
                </Cell>
                <Cell align="right" shade={callItm} selected={isCallSelected}>
                  <span className={row.call.oiChange >= 0 ? "text-call" : "text-put"}>
                    {row.call.oiChange >= 0 ? "+" : ""}
                    {compact(row.call.oiChange, region)}
                  </span>
                </Cell>
                <Cell align="right" shade={callItm} selected={isCallSelected} muted>
                  {compact(row.call.volume, region)}
                </Cell>
                <Cell align="right" shade={callItm} selected={isCallSelected} muted>
                  {(row.call.iv * 100).toFixed(1)}
                </Cell>
                <Cell align="right" shade={callItm} selected={isCallSelected} muted>
                  {row.call.greeks.delta.toFixed(2)}
                </Cell>
                
                {/* Click-to-Buy CALL LTP Cell */}
                <Cell
                  align="right"
                  shade={callItm}
                  selected={isCallSelected}
                  className="cursor-pointer hover:bg-call/20 transition-all select-none border-l border-border/40 font-bold"
                  onClick={() =>
                    setActiveDraftOrder({
                      action: "buy",
                      right: "CE",
                      strike: row.strike,
                      qty: 1,
                      premium: row.call.ltp,
                      iv: row.call.iv,
                      expiry: chain.expiry || undefined,
                    })
                  }
                  title="Click to Buy Call"
                >
                  <span className="font-semibold text-fg hover:text-call">{num(row.call.ltp)}</span>
                  <span className={cn("ml-1", callChg >= 0 ? "text-call" : "text-put")}>
                    {callChg >= 0 ? "▲" : "▼"}
                  </span>
                </Cell>

                {/* STRIKE */}
                <div className="px-2 text-center h-full flex items-center justify-center bg-bg-sunken/40 border-x border-border/40">
                  <span className={cn(isAtm ? "font-bold text-brand" : "font-semibold text-fg")}>
                    {row.strike.toLocaleString()}
                  </span>
                </div>

                {/* Click-to-Buy PUT LTP Cell */}
                <Cell
                  align="left"
                  shade={putItm}
                  selected={isPutSelected}
                  className="cursor-pointer hover:bg-put/20 transition-all select-none border-r border-border/40 font-bold"
                  onClick={() =>
                    setActiveDraftOrder({
                      action: "buy",
                      right: "PE",
                      strike: row.strike,
                      qty: 1,
                      premium: row.put.ltp,
                      iv: row.put.iv,
                      expiry: chain.expiry || undefined,
                    })
                  }
                  title="Click to Buy Put"
                >
                  <span className="font-semibold text-fg hover:text-put">{num(row.put.ltp)}</span>
                  <span className={cn("ml-1", putChg >= 0 ? "text-call" : "text-put")}>
                    {putChg >= 0 ? "▲" : "▼"}
                  </span>
                </Cell>

                <Cell align="left" shade={putItm} selected={isPutSelected} muted>
                  {row.put.greeks.delta.toFixed(2)}
                </Cell>
                <Cell align="left" shade={putItm} selected={isPutSelected} muted>
                  {(row.put.iv * 100).toFixed(1)}
                </Cell>
                <Cell align="left" shade={putItm} selected={isPutSelected} muted>
                  {compact(row.put.volume, region)}
                </Cell>
                <Cell align="left" shade={putItm} selected={isPutSelected}>
                  <span className={row.put.oiChange >= 0 ? "text-call" : "text-put"}>
                    {row.put.oiChange >= 0 ? "+" : ""}
                    {compact(row.put.oiChange, region)}
                  </span>
                </Cell>
                <Cell align="left" shade={putItm} selected={isPutSelected}>
                  <Bar pct={(row.put.oi / maxOI) * 100} tone="put" side="left" />
                  <span className="relative">{compact(row.put.oi, region)}</span>
                </Cell>

                {/* PUT Selection Checkbox */}
                <div className={cn("flex justify-center px-1 h-full items-center border-l border-border/40", isPutSelected && "bg-put/10")}>
                  <input
                    type="checkbox"
                    checked={isPutSelected}
                    onChange={() =>
                      toggleBuilderLeg({
                        action: "buy",
                        right: "PE",
                        strike: row.strike,
                        qty: 1,
                        premium: row.put.ltp,
                        iv: row.put.iv,
                        expiry: chain.expiry,
                      })
                    }
                    className="h-3 w-3 rounded border-border text-put focus:ring-put bg-panel"
                  />
                </div>
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
  selected,
  className,
  ...props
}: {
  children: React.ReactNode;
  align: "left" | "right";
  shade?: boolean;
  muted?: boolean;
  selected?: boolean;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden px-2 h-full flex items-center",
        align === "right" ? "text-right justify-end" : "text-left justify-start",
        shade && "bg-fg/[0.025]",
        selected && (align === "right" ? "bg-call/5 font-medium" : "bg-put/5 font-medium"),
        muted && "text-fg-muted",
        className
      )}
      {...props}
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
