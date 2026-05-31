"use client";

import { provider } from "@/lib/data/provider";
import { buildDataDictionary, getFieldSpec } from "@/lib/data/freshness";
import type { DataMode, OptionChain, TrackedField } from "@/lib/data/types";
import { useNow } from "@/lib/hooks/useNow";
import { cn } from "@/lib/utils";
import { SourceTag } from "@/components/ui/SourceTag";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { Icon } from "@/components/ui/Icon";
import { useMemo } from "react";

const FIELD_LABEL: Record<TrackedField, string> = {
  ltp: "Last traded price",
  bidAsk: "Bid / Ask",
  volume: "Volume",
  oi: "Open Interest",
  iv: "Implied Volatility",
  greeks: "Greeks (Δ Γ Θ V)",
  spot: "Underlying spot",
  pcr: "Put-Call Ratio",
  maxPain: "Max Pain",
};

const MODE_TONE: Record<DataMode, string> = {
  realtime: "bg-call-soft text-call",
  delayed: "bg-warn/15 text-warn",
  eod: "bg-info/15 text-info",
  computed: "bg-bg-sunken text-fg-muted",
  simulated: "bg-sim/15 text-sim",
};

function ModeChip({ mode, delaySec }: { mode: DataMode; delaySec: number }) {
  const text =
    mode === "realtime"
      ? "Live"
      : mode === "delayed"
        ? `Delayed ${delaySec >= 60 ? `${Math.round(delaySec / 60)}m` : `${delaySec}s`}`
        : mode === "eod"
          ? "End-of-day"
          : mode === "computed"
            ? "Computed live"
            : "Simulated ★";
  return <span className={cn("chip", MODE_TONE[mode])}>{text}</span>;
}

/** Live provenance + delay for every field on the active chain. */
export function DataSourcePanel({ chain }: { chain: OptionChain }) {
  const now = useNow(1000);
  const statuses = useMemo(() => provider.brokerStatuses(), []);
  const regionStatus = statuses.find((s) => s.region === chain.instrument.region);
  const fields = Object.keys(chain.freshness) as TrackedField[];

  return (
    <div className="flex flex-col gap-3">
      {regionStatus ? (
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-lg border p-2.5",
            regionStatus.mode === "live"
              ? "border-call/30 bg-call/[0.06]"
              : regionStatus.mode === "captured"
                ? "border-info/30 bg-info/[0.06]"
                : "border-sim/30 bg-sim/[0.06]",
          )}
        >
          <Icon
            name={regionStatus.mode === "live" ? "signal" : regionStatus.mode === "captured" ? "clock" : "star"}
            size={15}
            className={cn(
              "mt-0.5",
              regionStatus.mode === "live" ? "text-call" : regionStatus.mode === "captured" ? "text-info" : "text-sim",
            )}
          />
          <div className="min-w-0">
            <div className="text-2xs font-semibold text-fg">
              {regionStatus.source} · {regionStatus.region} feed —{" "}
              {regionStatus.mode === "live" ? "live" : regionStatus.mode === "captured" ? "captured (real)" : "simulated ★"}
            </div>
            <p className="mt-0.5 text-2xs text-fg-muted">{regionStatus.message}</p>
            <p className="mt-0.5 text-2xs text-fg-subtle">{regionStatus.howToConnect}</p>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-2xs">
          <thead>
            <tr className="bg-bg-sunken text-fg-subtle">
              <th className="px-2.5 py-1.5 text-left font-medium">Field</th>
              <th className="px-2.5 py-1.5 text-left font-medium">Source &amp; age</th>
              <th className="hidden px-2.5 py-1.5 text-left font-medium sm:table-cell">Cadence</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => {
              const prov = chain.freshness[f]!;
              return (
                <tr key={f} className="border-t border-border align-top">
                  <td className="px-2.5 py-1.5 font-medium text-fg">{FIELD_LABEL[f]}</td>
                  <td className="px-2.5 py-1.5">
                    <SourceTag prov={prov} showAge now={now} />
                  </td>
                  <td className="hidden px-2.5 py-1.5 text-fg-subtle sm:table-cell">
                    {getFieldSpec(chain.instrument.region, f).note}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The US-vs-India "which data is available when" dictionary. */
export function DataDictionary() {
  const rows = useMemo(() => buildDataDictionary(), []);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-2xs">
        <thead>
          <tr className="text-fg-subtle">
            <th className="px-2.5 py-2 text-left font-medium">Datapoint</th>
            <th className="px-2.5 py-2 text-left font-medium">
              <span className="inline-flex items-center gap-1">
                <span className="grid h-4 w-4 place-items-center rounded bg-brand/12 text-[9px] font-bold text-brand">IN</span>
                India · Kite
              </span>
            </th>
            <th className="px-2.5 py-2 text-left font-medium">
              <span className="inline-flex items-center gap-1">
                <span className="grid h-4 w-4 place-items-center rounded bg-brand/12 text-[9px] font-bold text-brand">US</span>
                United States · IBKR
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.field} className="border-t border-border align-top">
              <td className="px-2.5 py-2.5 font-semibold text-fg">{r.label}</td>
              <td className="px-2.5 py-2.5">
                <ModeChip mode={r.in.mode} delaySec={r.in.delaySec} />
                <p className="mt-1 max-w-xs leading-relaxed text-fg-subtle">{r.in.note}</p>
              </td>
              <td className="px-2.5 py-2.5">
                <ModeChip mode={r.us.mode} delaySec={r.us.delaySec} />
                <p className="mt-1 max-w-xs leading-relaxed text-fg-subtle">{r.us.note}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-bg-sunken px-3 py-2">
        <AgentBadge id="iris" size="sm" />
        <p className="text-2xs text-fg-subtle">
          Iris stamps every value above with its real source and delay, and ★-marks anything simulated — so OI-derived
          signals are never mistaken for live.
        </p>
      </div>
    </div>
  );
}
