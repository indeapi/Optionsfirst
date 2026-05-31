"use client";

import { useMemo, useState } from "react";
import { provider } from "@/lib/data/provider";
import { useAppStore } from "@/lib/store/app";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";

export function InstrumentPicker() {
  const symbol = useAppStore((s) => s.symbol);
  const setSymbol = useAppStore((s) => s.setSymbol);
  const [open, setOpen] = useState(false);
  const instruments = useMemo(() => provider.listInstruments(Date.now()), []);
  const current = instruments.find((i) => i.symbol === symbol) ?? instruments[0];

  const groups = useMemo(
    () => ({
      IN: instruments.filter((i) => i.region === "IN"),
      US: instruments.filter((i) => i.region === "US"),
    }),
    [instruments],
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-left transition-colors hover:bg-bg-sunken focus-ring"
      >
        <span className="grid h-6 w-6 place-items-center rounded-md bg-brand/12 text-2xs font-bold text-brand">
          {current?.region}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold leading-none text-fg">{current?.symbol}</span>
          <span className="mt-0.5 block max-w-[120px] truncate text-2xs leading-none text-fg-subtle">
            {current?.name}
          </span>
        </span>
        <Icon name="chevron-down" size={15} className="text-fg-subtle" />
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1.5 w-72 animate-fade-in rounded-xl border border-border bg-bg-elev p-1.5 shadow-pop">
            {(["IN", "US"] as const).map((region) => (
              <div key={region} className="mb-1 last:mb-0">
                <div className="px-2 py-1 text-2xs font-semibold uppercase tracking-wide text-fg-subtle">
                  {region === "IN" ? "India · NSE (Kite)" : "United States · OPRA (IBKR)"}
                </div>
                {groups[region].map((inst) => (
                  <button
                    key={inst.symbol}
                    onClick={() => {
                      setSymbol(inst.symbol);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-bg-sunken",
                      inst.symbol === symbol && "bg-brand/8",
                    )}
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-md bg-bg-sunken text-2xs font-bold text-fg-muted">
                      {inst.kind === "index" ? "IDX" : inst.kind === "etf" ? "ETF" : "EQ"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold leading-tight text-fg">{inst.symbol}</span>
                      <span className="block truncate text-2xs text-fg-subtle">{inst.name}</span>
                    </span>
                    {inst.symbol === symbol ? <Icon name="check" size={15} className="text-brand" /> : null}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
