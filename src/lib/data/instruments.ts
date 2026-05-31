/**
 * Instrument universe across both markets. The `seed` fields drive the
 * simulated engine; when a live IBKR/Kite feed is wired in, only the adapter
 * changes — instrument identity (lot size, strike step, currency) stays here.
 */

import type { Instrument, MarketRegion } from "./types";

export interface InstrumentSeed extends Instrument {
  /** Reference spot used to anchor the simulated random walk. */
  refSpot: number;
  /** Baseline ATM implied vol (fraction). */
  baseIV: number;
  /** Distance between adjacent strikes. */
  strikeStep: number;
  /** Put-over-call IV skew (vol points added to deep puts). */
  skew: number;
  /** Annualised risk-free rate for pricing. */
  rate: number;
}

export const RISK_FREE: Record<MarketRegion, number> = { IN: 0.066, US: 0.045 };

const IN_SEEDS: InstrumentSeed[] = [
  mk("NIFTY", "Nifty 50", "index", 75, "INR", 24820, 0.122, 50, 0.05),
  mk("BANKNIFTY", "Nifty Bank", "index", 35, "INR", 53180, 0.152, 100, 0.06),
  mk("FINNIFTY", "Nifty Financial", "index", 65, "INR", 25460, 0.142, 50, 0.05),
  mk("SENSEX", "BSE Sensex", "index", 20, "INR", 81240, 0.118, 100, 0.05),
  mk("RELIANCE", "Reliance Industries", "equity", 500, "INR", 1462, 0.224, 10, 0.07),
];

const US_SEEDS: InstrumentSeed[] = [
  mk("SPX", "S&P 500 Index", "index", 100, "USD", 5912, 0.158, 25, 0.04),
  mk("SPY", "SPDR S&P 500 ETF", "etf", 100, "USD", 590.4, 0.149, 1, 0.04),
  mk("QQQ", "Invesco QQQ Trust", "etf", 100, "USD", 511.2, 0.198, 1, 0.05),
  mk("AAPL", "Apple Inc.", "equity", 100, "USD", 229.6, 0.276, 2.5, 0.09),
  mk("NVDA", "NVIDIA Corp.", "equity", 100, "USD", 134.8, 0.452, 2.5, 0.11),
  mk("TSLA", "Tesla Inc.", "equity", 100, "USD", 348.5, 0.552, 5, 0.13),
];

function mk(
  symbol: string,
  name: string,
  kind: Instrument["kind"],
  lotSize: number,
  currency: Instrument["currency"],
  refSpot: number,
  baseIV: number,
  strikeStep: number,
  skew: number,
): InstrumentSeed {
  const region: MarketRegion = currency === "INR" ? "IN" : "US";
  return {
    symbol,
    name,
    region,
    kind,
    lotSize,
    currency,
    feed: region === "IN" ? "KITE" : "IBKR",
    expiries: [], // filled at runtime by upcomingExpiries()
    refSpot,
    baseIV,
    strikeStep,
    skew,
    rate: RISK_FREE[region],
  };
}

export const INSTRUMENT_SEEDS: InstrumentSeed[] = [...IN_SEEDS, ...US_SEEDS];

export function getSeed(symbol: string): InstrumentSeed | undefined {
  return INSTRUMENT_SEEDS.find((s) => s.symbol === symbol);
}

const DAY = 86400_000;

function nextWeekday(from: Date, weekday: number): Date {
  const d = new Date(from);
  const diff = (weekday - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

/**
 * Upcoming expiries from `now`:
 *  - India indices expire weekly (Thursday) plus the monthly.
 *  - US options expire weekly (Friday) plus the standard 3rd-Friday monthly.
 * Equities use monthlies only.
 */
export function upcomingExpiries(seed: InstrumentSeed, now = Date.now()): string[] {
  const base = new Date(now);
  const weekday = seed.region === "IN" ? 4 : 5; // Thu / Fri
  const out: number[] = [];
  if (seed.kind === "index" || seed.kind === "etf") {
    let cur = nextWeekday(base, weekday);
    for (let i = 0; i < 6; i++) {
      out.push(cur.getTime());
      cur = new Date(cur.getTime() + 7 * DAY);
    }
  }
  // Monthlies for the next 3 months (last weekday of month for IN, 3rd Fri US).
  for (let m = 0; m < 3; m++) {
    const month = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + m, 1));
    const monthly =
      seed.region === "IN"
        ? lastWeekdayOfMonth(month, weekday)
        : nthWeekdayOfMonth(month, weekday, 3);
    if (monthly.getTime() > now) out.push(monthly.getTime());
  }
  return Array.from(new Set(out))
    .sort((a, b) => a - b)
    .slice(0, 8)
    .map((t) => new Date(t).toISOString().slice(0, 10));
}

function lastWeekdayOfMonth(monthStart: Date, weekday: number): Date {
  const d = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function nthWeekdayOfMonth(monthStart: Date, weekday: number, n: number): Date {
  const d = new Date(monthStart);
  let count = 0;
  while (true) {
    if (d.getUTCDay() === weekday) {
      count++;
      if (count === n) return d;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

/** Calendar days to an ISO expiry (min 0). */
export function daysToExpiry(expiryISO: string, now = Date.now()): number {
  return Math.max(0, Math.round((new Date(expiryISO + "T15:30:00Z").getTime() - now) / DAY));
}
