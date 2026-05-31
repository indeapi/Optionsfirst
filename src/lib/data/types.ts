/**
 * Core domain model for Options First.
 *
 * Design rule: data is never just a number. Every market value travels with
 * provenance — which broker produced it, when, and how stale it is — so the UI
 * can always tell the trader the *actual* delay and ★-mark anything simulated.
 */

export type MarketRegion = "IN" | "US";

/** Upstream that produced a value. */
export type DataSource = "IBKR" | "KITE" | "SIMULATED";

/**
 * How fresh a value is, independent of who produced it.
 *  - realtime : streamed tick / sub-second
 *  - delayed  : real but lagged a fixed amount (e.g. KITE OI republishes ~3 min)
 *  - eod      : only settled once per session (e.g. OPRA open interest)
 *  - computed : derived locally from fresher inputs (greeks, max-pain)
 *  - simulated: synthesised by Options First — always rendered with a ★
 */
export type DataMode = "realtime" | "delayed" | "eod" | "computed" | "simulated";

/** Provenance attached to a field or a group of fields. */
export interface Provenance {
  source: DataSource;
  mode: DataMode;
  /** Nominal delay in seconds for this field+source (0 for true realtime). */
  delaySec: number;
  /** Epoch ms the underlying value was captured upstream. */
  asOf: number;
  /** Convenience flag mirroring mode === 'simulated'. Drives the ★ marker. */
  simulated: boolean;
  /** Short human label, e.g. "KITE · delayed 3m" or "Simulated ★". */
  label: string;
}

/** The fields whose freshness we track independently per region/source. */
export type TrackedField =
  | "ltp"
  | "bidAsk"
  | "volume"
  | "oi"
  | "iv"
  | "greeks"
  | "spot"
  | "pcr"
  | "maxPain";

export interface Instrument {
  symbol: string;
  name: string;
  region: MarketRegion;
  kind: "index" | "equity" | "etf";
  /** Contract multiplier: lot size (IN) or shares-per-contract (US, usually 100). */
  lotSize: number;
  /** Currency the contract is denominated in. */
  currency: "INR" | "USD";
  /** Sorted available expiries (ISO date). */
  expiries: string[];
  /** Broker the live feed would come from for this instrument. */
  feed: DataSource;
}

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

/** One side (call or put) of an option-chain row. */
export interface OptionQuote {
  strike: number;
  right: "CE" | "PE";
  ltp: number;
  bid: number;
  ask: number;
  volume: number;
  oi: number;
  /** Change in OI vs previous settlement. */
  oiChange: number;
  /** Implied volatility, as a fraction (0.18 = 18%). */
  iv: number;
  greeks: Greeks;
  /** True if this strike sits at/near the money. */
  atm?: boolean;
}

export interface OptionChainRow {
  strike: number;
  call: OptionQuote;
  put: OptionQuote;
}

export interface OptionChain {
  instrument: Instrument;
  expiry: string;
  /** Underlying spot / futures price. */
  spot: number;
  /** Day change of the underlying in price + percent. */
  spotChange: number;
  spotChangePct: number;
  rows: OptionChainRow[];
  /** Per-field provenance for this snapshot. */
  freshness: Partial<Record<TrackedField, Provenance>>;
  /** ATM strike used for straddle / centering. */
  atmStrike: number;
  /** When this snapshot object was assembled (epoch ms). */
  builtAt: number;
}

/** Aggregate positioning analytics derived from the chain. */
export interface ChainAnalytics {
  pcr: number;
  maxPain: number;
  totalCallOI: number;
  totalPutOI: number;
  totalCallOIChange: number;
  totalPutOIChange: number;
  /** Strikes acting as resistance (call OI walls) and support (put OI walls). */
  resistance: number[];
  support: number[];
  /** ATM straddle price = ATM call + ATM put. */
  atmStraddle: number;
  /** Straddle as % of spot — the market's expected move. */
  expectedMovePct: number;
  ivRank: number;
  ivPercentile: number;
  atmIV: number;
}

/** A trader's read of the tape, used to rank strategies. */
export interface MarketCondition {
  direction: "bullish" | "bearish" | "neutral" | "volatile";
  /** IV regime relative to its own history. */
  ivRegime: "low" | "elevated" | "high";
  /** Days to the nearest meaningful expiry. */
  dte: number;
  /** Trend strength 0..1. */
  trendStrength: number;
}
