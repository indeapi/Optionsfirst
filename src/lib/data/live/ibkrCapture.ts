/**
 * Real IBKR market-data capture.
 *
 * These are genuine values pulled from the connected Interactive Brokers feed
 * (account, positions, underlying prices, implied vol, IV percentile and
 * aggregate option open interest). The web app cannot call the session's MCP
 * connector at runtime, so this capture is baked in and used to *anchor* the US
 * chains to reality — real spot, real IV/IV-rank, real total OI and PCR — with
 * only the per-strike distribution and per-contract quotes modelled (those
 * per-contract conids are not exposed by the connector).
 *
 * When the app runs next to a live IBKR gateway (IBKR_GATEWAY_BASE_URL), the
 * gateway adapter supersedes this capture and the data streams.
 *
 * Captured: 2026-05-31 (US session closed — figures are last/close).
 */

export const IBKR_CAPTURED_AT = Date.parse("2026-05-31T20:05:00Z");
export const IBKR_MARKET_CLOSED = true;

export interface IbkrUnderlying {
  symbol: string;
  conid: number;
  exchange: string;
  spot: number;
  priorClose: number;
  change: number;
  changePct: number;
  /** Underlying implied vol (fraction). */
  underlyingIV: number;
  /** 30-day historical vol (fraction). */
  histVol: number;
  /** 52-week IV percentile (fraction, 0..1). */
  ivPercentile: number;
  /** Real aggregate option open interest across the whole chain. */
  callOI: number;
  putOI: number;
  callOptVol: number;
  putOptVol: number;
}

export const IBKR_UNDERLYINGS: Record<string, IbkrUnderlying> = {
  SPX: {
    symbol: "SPX", conid: 416904, exchange: "CBOE",
    spot: 7581.25, priorClose: 7563.63, change: 17.62, changePct: 0.23,
    underlyingIV: 0.1237, histVol: 0.0991, ivPercentile: 0.2072,
    callOI: 19779586, putOI: 27760062, callOptVol: 5903368, putOptVol: 5196242,
  },
  SPY: {
    symbol: "SPY", conid: 756733, exchange: "ARCA",
    spot: 754.6, priorClose: 754.6, change: 0, changePct: 0,
    underlyingIV: 0.1253, histVol: 0.1043, ivPercentile: 0.2032,
    callOI: 4534352, putOI: 9593404, callOptVol: 5274131, putOptVol: 4728525,
  },
  QQQ: {
    symbol: "QQQ", conid: 320227571, exchange: "NASDAQ",
    spot: 735.6, priorClose: 735.6, change: 0, changePct: 0,
    underlyingIV: 0.1977, histVol: 0.1629, ivPercentile: 0.6454,
    callOI: 3501147, putOI: 5586486, callOptVol: 3183159, putOptVol: 2978961,
  },
  AAPL: {
    symbol: "AAPL", conid: 265598, exchange: "NASDAQ",
    spot: 312.51, priorClose: 312.51, change: 0, changePct: 0,
    underlyingIV: 0.2115, histVol: 0.2317, ivPercentile: 0.0956,
    callOI: 2605346, putOI: 1577497, callOptVol: 1063776, putOptVol: 299304,
  },
  NVDA: {
    symbol: "NVDA", conid: 4815747, exchange: "NASDAQ",
    spot: 214.25, priorClose: 214.25, change: 0, changePct: 0,
    underlyingIV: 0.3929, histVol: 0.3682, ivPercentile: 0.5259,
    callOI: 7850467, putOI: 5250244, callOptVol: 3008192, putOptVol: 1274914,
  },
  TSLA: {
    symbol: "TSLA", conid: 76792991, exchange: "NASDAQ",
    spot: 442.1, priorClose: 442.1, change: 0, changePct: 0,
    underlyingIV: 0.4114, histVol: 0.4232, ivPercentile: 0.0717,
    callOI: 3126065, putOI: 1820178, callOptVol: 2344827, putOptVol: 1293509,
  },
};

export interface IbkrPosition {
  symbol: string;
  conid: number;
  assetClass: string;
  quantity: number;
  avgPrice: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  currency: "USD" | "EUR";
}

export interface IbkrBalance {
  currency: string;
  cash: number;
  netLiquidation: number;
  marketValue: number;
  unrealizedPnl: number;
  /** FX rate to the account base currency. */
  fxToBase: number;
}

export interface IbkrAccount {
  baseCurrency: "EUR";
  netLiquidation: number;
  availableFunds: number;
  buyingPower: number;
  equityWithLoan: number;
  totalCash: number;
  positions: IbkrPosition[];
  balances: IbkrBalance[];
}

export const IBKR_ACCOUNT: IbkrAccount = {
  baseCurrency: "EUR",
  netLiquidation: 87.2374,
  availableFunds: 1.4665,
  buyingPower: 1.4665,
  equityWithLoan: 87.2374,
  totalCash: 1.46,
  positions: [
    { symbol: "DLR", conid: 31832526, assetClass: "STK", quantity: 0.1796, avgPrice: 168.66, marketPrice: 189.96, marketValue: 34.117, unrealizedPnl: 3.826, currency: "USD" },
    { symbol: "NVDA", conid: 4815747, assetClass: "STK", quantity: 0.0492, avgPrice: 122.988, marketPrice: 212.48, marketValue: 10.454, unrealizedPnl: 4.403, currency: "USD" },
    { symbol: "SNDK", conid: 760250490, assetClass: "STK", quantity: 0.0329, avgPrice: 1408.717, marketPrice: 1683.8, marketValue: 55.397, unrealizedPnl: 9.05, currency: "USD" },
  ],
  balances: [
    { currency: "BASE", cash: 1.46, netLiquidation: 87.2374, marketValue: 85.7774, unrealizedPnl: 14.826, fxToBase: 1 },
    { currency: "USD", cash: 0, netLiquidation: 99.9679, marketValue: 99.9679, unrealizedPnl: 17.279, fxToBase: 0.85805 },
    { currency: "EUR", cash: 1.46, netLiquidation: 1.46, marketValue: 0, unrealizedPnl: 0, fxToBase: 1 },
  ],
};

/** Real USD→EUR rate from the account (1 USD = 0.85805 EUR ⇒ EUR/USD ≈ 1.1654). */
export const IBKR_USD_EUR = 0.85805;

export function getUsAnchor(symbol: string): IbkrUnderlying | undefined {
  return IBKR_UNDERLYINGS[symbol];
}
