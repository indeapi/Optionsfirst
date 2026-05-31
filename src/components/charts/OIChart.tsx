"use client";

import type { ChainAnalytics, OptionChain } from "@/lib/data/types";
import { cn, compact } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";

/**
 * Open-Interest bar chart — diverging horizontal bars, strikes down the centre.
 * Call OI grows left, Put OI grows right; the brighter inner segment is the
 * *fresh* OI (today's change), so you see at a glance where positions are being
 * built or unwound. Spot, ATM, max-pain and the heaviest OI walls (support /
 * resistance) are all marked.
 */
export function OIChart({
  chain,
  analytics,
  maxStrikes = 18,
}: {
  chain: OptionChain;
  analytics: ChainAnalytics;
  maxStrikes?: number;
}) {
  const region = chain.instrument.region;
  // Window the strikes around ATM so the chart stays readable.
  const atmIdx = chain.rows.findIndex((r) => r.strike === chain.atmStrike);
  const half = Math.floor(maxStrikes / 2);
  const start = Math.max(0, Math.min(chain.rows.length - maxStrikes, atmIdx - half));
  const rows = chain.rows.slice(start, start + maxStrikes);

  const maxOI = Math.max(1, ...rows.flatMap((r) => [r.call.oi, r.put.oi]));
  const maxCallStrike = rows.reduce((a, b) => (b.call.oi > a.call.oi ? b : a), rows[0]).strike;
  const maxPutStrike = rows.reduce((a, b) => (b.put.oi > a.put.oi ? b : a), rows[0]).strike;

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-3 text-2xs">
          <Legend className="bg-call" label="Call OI" />
          <Legend className="bg-put" label="Put OI" />
          <span className="flex items-center gap-1 text-fg-subtle">
            <span className="h-2 w-2 rounded-sm bg-fg-muted/70" /> fresh OI (Δ)
          </span>
        </div>
        <div className="flex items-center gap-3 text-2xs text-fg-muted tnum">
          <span>
            PCR <b className="text-fg">{analytics.pcr.toFixed(2)}</b>
          </span>
          <span>
            Max pain <b className="text-fg">{analytics.maxPain.toLocaleString()}</b>
          </span>
        </div>
      </div>

      {chain.live ? (
        <div className="mb-1.5 flex items-center gap-1 text-[10px] leading-tight text-fg-subtle">
          <Icon name="info" size={11} className="shrink-0 text-info" />
          Call/put OI totals &amp; PCR are real ({chain.live.source}); the per-strike split is modelled to that real
          aggregate (per-contract OI isn&apos;t exposed by the feed).
        </div>
      ) : null}

      <div className="flex flex-col">
        {rows.map((row, i) => {
          const isAtm = row.strike === chain.atmStrike;
          const callPct = (row.call.oi / maxOI) * 100;
          const putPct = (row.put.oi / maxOI) * 100;
          const callChgPct = (Math.min(Math.abs(row.call.oiChange), row.call.oi) / maxOI) * 100;
          const putChgPct = (Math.min(Math.abs(row.put.oiChange), row.put.oi) / maxOI) * 100;
          const prev = rows[i - 1];
          const spotBetween =
            prev && chain.spot <= prev.strike && chain.spot > row.strike;

          return (
            <div key={row.strike} className="relative">
              {spotBetween ? <SpotLine value={chain.spot} /> : null}
              <div
                className={cn(
                  "grid items-center",
                  isAtm && "rounded-md bg-brand/[0.06]",
                )}
                style={{ gridTemplateColumns: "48px 1fr 70px 1fr 48px", height: 22 }}
              >
                {/* Call OI value + resistance tag */}
                <div className="flex items-center justify-end gap-1 pr-1.5 text-2xs tnum text-fg-muted">
                  {row.strike === maxCallStrike ? (
                    <span className="rounded bg-put/15 px-1 text-[9px] font-bold text-put">R</span>
                  ) : null}
                  {compact(row.call.oi, region)}
                </div>
                {/* Call bar (grows left) */}
                <div className="relative h-3">
                  <div
                    className="absolute right-0 top-0 h-3 rounded-l bg-call/35"
                    style={{ width: `${callPct}%` }}
                  />
                  <div
                    className={cn(
                      "absolute right-0 top-0 h-3 rounded-l",
                      row.call.oiChange >= 0 ? "bg-call/85" : "bg-call/30 ring-1 ring-inset ring-call/60",
                    )}
                    style={{ width: `${callChgPct}%` }}
                  />
                </div>
                {/* Strike */}
                <div className="text-center">
                  <span
                    className={cn(
                      "text-2xs tnum",
                      isAtm ? "font-bold text-brand" : "font-medium text-fg",
                    )}
                  >
                    {row.strike.toLocaleString()}
                  </span>
                  {row.strike === analytics.maxPain ? (
                    <span className="ml-1 text-[9px] font-bold text-warn">MP</span>
                  ) : null}
                </div>
                {/* Put bar (grows right) */}
                <div className="relative h-3">
                  <div
                    className="absolute left-0 top-0 h-3 rounded-r bg-put/35"
                    style={{ width: `${putPct}%` }}
                  />
                  <div
                    className={cn(
                      "absolute left-0 top-0 h-3 rounded-r",
                      row.put.oiChange >= 0 ? "bg-put/85" : "bg-put/30 ring-1 ring-inset ring-put/60",
                    )}
                    style={{ width: `${putChgPct}%` }}
                  />
                </div>
                {/* Put OI value + support tag */}
                <div className="flex items-center gap-1 pl-1.5 text-2xs tnum text-fg-muted">
                  {compact(row.put.oi, region)}
                  {row.strike === maxPutStrike ? (
                    <span className="rounded bg-call/15 px-1 text-[9px] font-bold text-call">S</span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-fg-subtle">
      <span className={cn("h-2 w-2 rounded-sm", className)} />
      {label}
    </span>
  );
}

function SpotLine({ value }: { value: number }) {
  return (
    <div className="pointer-events-none absolute -top-px left-0 right-0 z-10 flex items-center">
      <div className="h-px flex-1 bg-brand/50" />
      <span className="mx-1 rounded bg-brand px-1 py-px text-[9px] font-bold text-white tnum">
        SPOT {value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </span>
      <div className="h-px flex-1 bg-brand/50" />
    </div>
  );
}
