/**
 * Data-freshness catalog.
 *
 * This is the source of truth for "which datapoint is available when" — the
 * single most misunderstood thing when you trade two markets at once. US and
 * Indian option feeds expose *different* fields on *different* cadences, and
 * this module makes that explicit so the dashboard can always tell the trader
 * the real delay (and ★-mark anything we had to simulate).
 */

import type {
  DataMode,
  DataSource,
  MarketRegion,
  Provenance,
  TrackedField,
} from "./types";

export const REAL_FEED_BY_REGION: Record<MarketRegion, DataSource> = {
  IN: "KITE",
  US: "IBKR",
};

interface FieldSpec {
  mode: DataMode;
  /** Nominal real-world delay in seconds the live feed carries for this field. */
  delaySec: number;
  /** Plain-language explanation shown in the data dictionary. */
  note: string;
}

/**
 * Per-region cadence. These reflect how the real venues behave:
 *  - India (NSE via Kite): LTP/quotes stream tick-by-tick, but Open Interest is
 *    disseminated on a slower cycle — practically refreshed about every 3 min.
 *  - US (OPRA via IBKR): quotes stream in real time *with* a market-data
 *    subscription, but Open Interest is an end-of-day figure published by the
 *    OCC the next morning — there is no live intraday OI on US options.
 */
const CATALOG: Record<MarketRegion, Record<TrackedField, FieldSpec>> = {
  IN: {
    ltp: { mode: "realtime", delaySec: 0, note: "NSE tick stream via Kite WebSocket — sub-second." },
    bidAsk: { mode: "realtime", delaySec: 0, note: "Top-of-book from Kite full-mode quotes." },
    volume: { mode: "realtime", delaySec: 0, note: "Cumulative traded volume, streamed live." },
    oi: {
      mode: "delayed",
      delaySec: 180,
      note: "NSE disseminates Open Interest on a slow cycle — Kite refreshes it roughly every 3 minutes, so OI is real but lagged.",
    },
    iv: { mode: "computed", delaySec: 0, note: "Implied vol solved locally from live LTP (Black-76)." },
    greeks: { mode: "computed", delaySec: 0, note: "Greeks computed locally from live spot + solved IV." },
    spot: { mode: "realtime", delaySec: 0, note: "Index / futures spot streamed live via Kite." },
    pcr: { mode: "delayed", delaySec: 180, note: "Put-Call Ratio inherits OI's ~3 min cadence." },
    maxPain: { mode: "delayed", delaySec: 180, note: "Max-pain recomputed each time OI refreshes (~3 min)." },
  },
  US: {
    ltp: { mode: "realtime", delaySec: 0, note: "OPRA NBBO via IBKR — real time with a market-data subscription (else 15 min delayed)." },
    bidAsk: { mode: "realtime", delaySec: 0, note: "NBBO bid/ask via IBKR top-of-book." },
    volume: { mode: "realtime", delaySec: 0, note: "Contract volume streamed live via IBKR." },
    oi: {
      mode: "eod",
      delaySec: 86400,
      note: "US option Open Interest is an end-of-day figure from the OCC, published the next morning. There is NO live intraday OI on US options — yesterday's settled OI is the freshest number that exists.",
    },
    iv: { mode: "computed", delaySec: 0, note: "Implied vol solved locally from live NBBO (Black-Scholes)." },
    greeks: { mode: "computed", delaySec: 0, note: "Greeks computed locally from live spot + solved IV." },
    spot: { mode: "realtime", delaySec: 0, note: "Underlying last price streamed live via IBKR." },
    pcr: { mode: "eod", delaySec: 86400, note: "PCR built on OI inherits the OCC end-of-day cadence." },
    maxPain: { mode: "eod", delaySec: 86400, note: "Max-pain uses settled OI — refreshes once per session." },
  },
};

const MODE_LABEL: Record<DataMode, string> = {
  realtime: "live",
  delayed: "delayed",
  eod: "end-of-day",
  computed: "computed",
  simulated: "simulated",
};

/** "0s" → live, sub-minute → "45s", sub-hour → "3m", else "~1d". */
export function formatDelay(delaySec: number): string {
  if (delaySec <= 0) return "live";
  if (delaySec < 60) return `${Math.round(delaySec)}s`;
  if (delaySec < 3600) return `${Math.round(delaySec / 60)}m`;
  if (delaySec < 86400) return `${Math.round(delaySec / 3600)}h`;
  return `${Math.round(delaySec / 86400)}d`;
}

/** Human "X ago" for an as-of timestamp. */
export function formatAge(asOf: number, now = Date.now()): string {
  const sec = Math.max(0, Math.round((now - asOf) / 1000));
  if (sec < 2) return "just now";
  return `${formatDelay(sec)} ago`;
}

export function getFieldSpec(region: MarketRegion, field: TrackedField): FieldSpec {
  return CATALOG[region][field];
}

/**
 * Build a Provenance stamp for a field. When `simulated` is true the source
 * flips to SIMULATED and mode to "simulated" (→ ★), but we preserve the
 * *nominal* real-world delay so the data dictionary can still explain what the
 * live feed would deliver.
 */
export function getProvenance(
  region: MarketRegion,
  field: TrackedField,
  opts: { simulated: boolean; asOf?: number },
): Provenance {
  const spec = CATALOG[region][field];
  const asOf = opts.asOf ?? Date.now();
  if (opts.simulated) {
    return {
      source: "SIMULATED",
      mode: "simulated",
      delaySec: spec.delaySec,
      asOf,
      simulated: true,
      label: "Simulated ★",
    };
  }
  const source = REAL_FEED_BY_REGION[region];
  return {
    source,
    mode: spec.mode,
    delaySec: spec.delaySec,
    asOf,
    simulated: false,
    label: `${source} · ${MODE_LABEL[spec.mode]}`,
  };
}

/** Rows for the in-app "Data Dictionary" comparison (US vs India). */
export interface DictionaryRow {
  field: TrackedField;
  label: string;
  in: FieldSpec & { source: DataSource };
  us: FieldSpec & { source: DataSource };
}

const FIELD_LABELS: Record<TrackedField, string> = {
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

export function buildDataDictionary(): DictionaryRow[] {
  return (Object.keys(FIELD_LABELS) as TrackedField[]).map((field) => ({
    field,
    label: FIELD_LABELS[field],
    in: { ...CATALOG.IN[field], source: REAL_FEED_BY_REGION.IN },
    us: { ...CATALOG.US[field], source: REAL_FEED_BY_REGION.US },
  }));
}
