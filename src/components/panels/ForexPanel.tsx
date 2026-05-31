"use client";

import { useMemo } from "react";
import { getFxRates, type RemittanceAlert } from "@/lib/agents/fx";
import { cn, num } from "@/lib/utils";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { Icon } from "@/components/ui/Icon";
import { Chip, type Tone } from "@/components/ui/primitives";

const SEV_TONE: Record<RemittanceAlert["severity"], Tone> = {
  positive: "call",
  watch: "warn",
  info: "info",
};

export function FxStrip() {
  const rates = useMemo(() => getFxRates(Date.now()), []);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {rates.map((r) => {
        const up = r.changePct >= 0;
        return (
          <div key={r.pair} className="rounded-lg border border-border bg-panel p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-semibold text-fg">{r.pair}</span>
              <span className="chip bg-sim/15 text-sim">
                <Icon name="star" size={9} strokeWidth={2.5} /> SIM
              </span>
            </div>
            <div className="tnum mt-1 text-base font-bold text-fg">{num(r.rate, r.quote === "USD" ? 4 : 3)}</div>
            <div className={cn("tnum text-2xs font-medium", up ? "text-call" : "text-put")}>
              {up ? "+" : ""}
              {r.changePct.toFixed(2)}% vs 30d avg
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RemittanceAlerts({ alerts }: { alerts: RemittanceAlert[] }) {
  const sorted = [...alerts].sort((a, b) => b.benefitPct - a.benefitPct);
  return (
    <div className="flex flex-col gap-2">
      {sorted.map((a) => {
        const tone = SEV_TONE[a.severity];
        return (
          <div key={a.id} className="rounded-lg border border-border bg-panel-2 p-3">
            <div className="flex items-start gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-bg-sunken text-2xs font-bold text-fg-muted">
                {a.from}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-fg">{a.headline}</span>
                  <Chip tone={tone} className="ml-auto tnum">
                    {a.benefitPct >= 0 ? "+" : ""}
                    {a.benefitPct.toFixed(2)}%
                  </Chip>
                </div>
                <p className="mt-1 text-2xs leading-relaxed text-fg-muted">{a.detail}</p>
                <div className="mt-2 flex items-center gap-3 text-2xs tnum text-fg-subtle">
                  <span>
                    Now <b className="text-fg">₹{Math.round(a.exampleInrNow).toLocaleString()}</b>
                  </span>
                  <span>
                    30d avg ₹{Math.round(a.exampleInrAvg).toLocaleString()}
                  </span>
                  <span className="text-fg-subtle">on {a.from} {a.exampleAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-2 rounded-lg bg-bg-sunken px-3 py-2">
        <AgentBadge id="plutus" size="sm" />
        <p className="text-2xs text-fg-subtle">
          Plutus compares each pair to its 30-day average and flags windows where funding an INR account or repatriating
          gains earns extra rupees. Rates are ★ simulated until an FX feed is attached.
        </p>
      </div>
    </div>
  );
}
