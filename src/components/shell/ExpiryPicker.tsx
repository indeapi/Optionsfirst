"use client";

import { useMemo } from "react";
import { provider } from "@/lib/data/provider";
import { daysToExpiry } from "@/lib/data/instruments";
import { useAppStore } from "@/lib/store/app";
import { useMarket } from "@/components/providers/market";
import { cn } from "@/lib/utils";

function fmtExpiry(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}

export function ExpiryPicker() {
  const symbol = useAppStore((s) => s.symbol);
  const setExpiry = useAppStore((s) => s.setExpiry);
  const active = useMarket().expiry;
  const expiries = useMemo(
    () => provider.getInstrument(symbol, Date.now())?.expiries ?? [],
    [symbol],
  );

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      <span className="label-eyebrow mr-1 shrink-0">Expiry</span>
      {expiries.map((e) => {
        const dte = daysToExpiry(e);
        const isActive = e === active;
        return (
          <button
            key={e}
            onClick={() => setExpiry(e)}
            className={cn(
              "flex shrink-0 flex-col items-center rounded-lg border px-2.5 py-1 transition-colors focus-ring",
              isActive
                ? "border-brand/40 bg-brand/10 text-brand"
                : "border-border bg-panel text-fg-muted hover:bg-bg-sunken",
            )}
          >
            <span className="text-2xs font-semibold leading-tight">{fmtExpiry(e)}</span>
            <span className={cn("text-[9px] leading-tight", isActive ? "text-brand/80" : "text-fg-subtle")}>
              {dte}d
            </span>
          </button>
        );
      })}
    </div>
  );
}
