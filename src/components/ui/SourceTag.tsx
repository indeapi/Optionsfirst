"use client";

import type { DataMode, Provenance } from "@/lib/data/types";
import { formatAge, formatDelay } from "@/lib/data/freshness";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import type { Tone } from "./primitives";

const MODE_TONE: Record<DataMode, Tone> = {
  realtime: "call",
  delayed: "warn",
  eod: "info",
  computed: "neutral",
  simulated: "sim",
};

const MODE_TEXT: Record<DataMode, string> = {
  realtime: "live",
  delayed: "delayed",
  eod: "EOD",
  computed: "computed",
  simulated: "simulated",
};

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-bg-sunken text-fg-muted",
  brand: "bg-brand-soft text-brand",
  call: "bg-call-soft text-call",
  put: "bg-put-soft text-put",
  warn: "bg-warn/15 text-warn",
  info: "bg-info/15 text-info",
  sim: "bg-sim/15 text-sim",
};
const DOT_CLASS: Record<Tone, string> = {
  neutral: "bg-fg-subtle",
  brand: "bg-brand",
  call: "bg-call",
  put: "bg-put",
  warn: "bg-warn",
  info: "bg-info",
  sim: "bg-sim",
};

/**
 * The provenance pill used across the app. Shows who produced a value, its
 * mode (live / delayed / EOD / computed), the real delay, and a ★ when the
 * value is simulated — so the trader is never guessing how fresh a number is.
 */
export function SourceTag({
  prov,
  showAge,
  now,
  className,
}: {
  prov: Provenance;
  showAge?: boolean;
  now?: number;
  className?: string;
}) {
  const tone: Tone = prov.captured ? "info" : MODE_TONE[prov.mode];
  const modeText = prov.captured ? "captured" : MODE_TEXT[prov.mode];
  const delay = !prov.captured && prov.delaySec > 0 ? ` ${formatDelay(prov.delaySec)}` : "";
  const sourceText = prov.simulated ? "SIM" : prov.source;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium tnum",
        TONE_CLASS[tone],
        className,
      )}
      title={`${prov.label} · ${modeText}${delay}`}
    >
      {prov.simulated ? (
        <Icon name="star" size={10} strokeWidth={2.5} />
      ) : prov.captured ? (
        <Icon name="clock" size={10} strokeWidth={2.5} />
      ) : (
        <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASS[tone])} />
      )}
      <span>
        {sourceText} · {modeText}
        {delay}
      </span>
      {showAge && now ? (
        <span className="text-fg-subtle">· {formatAge(prov.asOf, now)}</span>
      ) : null}
    </span>
  );
}
