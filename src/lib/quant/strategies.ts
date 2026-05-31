/**
 * Strategy catalog. Each entry is a template that knows *when* it shines and
 * how to assemble concrete legs from a live option chain. The ranking engine
 * (strategyRanker.ts) scores these against the prevailing market condition.
 */

import type { Leg } from "./payoff";

export type StrategyCategory =
  | "directional"
  | "income"
  | "volatility"
  | "hedge"
  | "arbitrage";

export type MarketView = "bullish" | "bearish" | "neutral" | "volatile";

export interface StrategyMeta {
  id: string;
  name: string;
  category: StrategyCategory;
  view: MarketView;
  risk: "defined" | "undefined";
  /** Does the position want IV to rise (long) or fall (short)? */
  ivBias: "long" | "short" | "neutral";
  summary: string;
  bestWhen: string;
}

export interface BuilderCtx {
  atm: number;
  step: number;
  spot: number;
  /** Premium lookup for a strike+right; falls back to 0 if missing. */
  premium: (strike: number, right: "CE" | "PE") => number;
}

export interface StrategyDef extends StrategyMeta {
  build: (ctx: BuilderCtx) => Leg[];
}

const L = (
  action: "buy" | "sell",
  right: "CE" | "PE" | "EQ",
  strike: number,
  premium: number,
  qty = 1,
): Leg => ({ action, right, strike, qty, premium });

export const STRATEGIES: StrategyDef[] = [
  {
    id: "long-call",
    name: "Long Call",
    category: "directional",
    view: "bullish",
    risk: "defined",
    ivBias: "long",
    summary: "Buy an ATM call. Unlimited upside, loss capped at the premium.",
    bestWhen: "Strong bullish view with room to run, IV not already rich.",
    build: (c) => [L("buy", "CE", c.atm, c.premium(c.atm, "CE"))],
  },
  {
    id: "long-put",
    name: "Long Put",
    category: "directional",
    view: "bearish",
    risk: "defined",
    ivBias: "long",
    summary: "Buy an ATM put. Profits as the underlying falls; risk = premium.",
    bestWhen: "Bearish view or hedging a long book; cheap when IV is low.",
    build: (c) => [L("buy", "PE", c.atm, c.premium(c.atm, "PE"))],
  },
  {
    id: "bull-call-spread",
    name: "Bull Call Spread",
    category: "directional",
    view: "bullish",
    risk: "defined",
    ivBias: "neutral",
    summary: "Buy ATM call, sell one strike OTM. Cheaper directional bet, capped gain.",
    bestWhen: "Moderately bullish; you want defined cost and a clear target.",
    build: (c) => [
      L("buy", "CE", c.atm, c.premium(c.atm, "CE")),
      L("sell", "CE", c.atm + c.step, c.premium(c.atm + c.step, "CE")),
    ],
  },
  {
    id: "bear-put-spread",
    name: "Bear Put Spread",
    category: "directional",
    view: "bearish",
    risk: "defined",
    ivBias: "neutral",
    summary: "Buy ATM put, sell one strike OTM. Defined-cost bearish bet.",
    bestWhen: "Moderately bearish with a downside target in mind.",
    build: (c) => [
      L("buy", "PE", c.atm, c.premium(c.atm, "PE")),
      L("sell", "PE", c.atm - c.step, c.premium(c.atm - c.step, "PE")),
    ],
  },
  {
    id: "bull-put-spread",
    name: "Bull Put Spread",
    category: "income",
    view: "bullish",
    risk: "defined",
    ivBias: "short",
    summary: "Sell ATM put, buy a lower put. Collect credit while staying bullish.",
    bestWhen: "Mildly bullish / range-bound up; harvest elevated put IV.",
    build: (c) => [
      L("sell", "PE", c.atm, c.premium(c.atm, "PE")),
      L("buy", "PE", c.atm - 2 * c.step, c.premium(c.atm - 2 * c.step, "PE")),
    ],
  },
  {
    id: "bear-call-spread",
    name: "Bear Call Spread",
    category: "income",
    view: "bearish",
    risk: "defined",
    ivBias: "short",
    summary: "Sell ATM call, buy a higher call. Credit trade with a bearish tilt.",
    bestWhen: "Mildly bearish / capped upside; sell into rich call IV.",
    build: (c) => [
      L("sell", "CE", c.atm, c.premium(c.atm, "CE")),
      L("buy", "CE", c.atm + 2 * c.step, c.premium(c.atm + 2 * c.step, "CE")),
    ],
  },
  {
    id: "long-straddle",
    name: "Long Straddle",
    category: "volatility",
    view: "volatile",
    risk: "defined",
    ivBias: "long",
    summary: "Buy ATM call + ATM put. Wins on a big move either way.",
    bestWhen: "Expecting a sharp move (event/result) while IV is still cheap.",
    build: (c) => [
      L("buy", "CE", c.atm, c.premium(c.atm, "CE")),
      L("buy", "PE", c.atm, c.premium(c.atm, "PE")),
    ],
  },
  {
    id: "long-strangle",
    name: "Long Strangle",
    category: "volatility",
    view: "volatile",
    risk: "defined",
    ivBias: "long",
    summary: "Buy OTM call + OTM put. Cheaper than a straddle, needs a bigger move.",
    bestWhen: "Big move expected but you want lower upfront cost than a straddle.",
    build: (c) => [
      L("buy", "CE", c.atm + 2 * c.step, c.premium(c.atm + 2 * c.step, "CE")),
      L("buy", "PE", c.atm - 2 * c.step, c.premium(c.atm - 2 * c.step, "PE")),
    ],
  },
  {
    id: "short-straddle",
    name: "Short Straddle",
    category: "income",
    view: "neutral",
    risk: "undefined",
    ivBias: "short",
    summary: "Sell ATM call + ATM put. Maximum premium, undefined risk.",
    bestWhen: "Range-bound tape with rich IV you expect to bleed lower.",
    build: (c) => [
      L("sell", "CE", c.atm, c.premium(c.atm, "CE")),
      L("sell", "PE", c.atm, c.premium(c.atm, "PE")),
    ],
  },
  {
    id: "short-strangle",
    name: "Short Strangle",
    category: "income",
    view: "neutral",
    risk: "undefined",
    ivBias: "short",
    summary: "Sell OTM call + OTM put. Wider safe zone than a short straddle.",
    bestWhen: "Range-bound with a buffer; high IV percentile, calm catalysts.",
    build: (c) => [
      L("sell", "CE", c.atm + 2 * c.step, c.premium(c.atm + 2 * c.step, "CE")),
      L("sell", "PE", c.atm - 2 * c.step, c.premium(c.atm - 2 * c.step, "PE")),
    ],
  },
  {
    id: "iron-condor",
    name: "Iron Condor",
    category: "income",
    view: "neutral",
    risk: "defined",
    ivBias: "short",
    summary: "Sell a strangle, buy wings. Defined-risk premium collection.",
    bestWhen: "The desk favourite for range-bound, high-IV, low-event windows.",
    build: (c) => [
      L("sell", "CE", c.atm + 2 * c.step, c.premium(c.atm + 2 * c.step, "CE")),
      L("buy", "CE", c.atm + 4 * c.step, c.premium(c.atm + 4 * c.step, "CE")),
      L("sell", "PE", c.atm - 2 * c.step, c.premium(c.atm - 2 * c.step, "PE")),
      L("buy", "PE", c.atm - 4 * c.step, c.premium(c.atm - 4 * c.step, "PE")),
    ],
  },
  {
    id: "iron-butterfly",
    name: "Iron Butterfly",
    category: "income",
    view: "neutral",
    risk: "defined",
    ivBias: "short",
    summary: "Sell ATM straddle, buy wings. Fatter credit, narrower profit zone.",
    bestWhen: "You expect the underlying pinned near the ATM into expiry.",
    build: (c) => [
      L("sell", "CE", c.atm, c.premium(c.atm, "CE")),
      L("sell", "PE", c.atm, c.premium(c.atm, "PE")),
      L("buy", "CE", c.atm + 3 * c.step, c.premium(c.atm + 3 * c.step, "CE")),
      L("buy", "PE", c.atm - 3 * c.step, c.premium(c.atm - 3 * c.step, "PE")),
    ],
  },
  {
    id: "covered-call",
    name: "Covered Call",
    category: "income",
    view: "neutral",
    risk: "defined",
    ivBias: "short",
    summary: "Hold the underlying, sell an OTM call. Yield on a position you own.",
    bestWhen: "You own the stock and expect sideways-to-mildly-up drift.",
    build: (c) => [
      L("buy", "EQ", c.spot, c.spot),
      L("sell", "CE", c.atm + c.step, c.premium(c.atm + c.step, "CE")),
    ],
  },
  {
    id: "cash-secured-put",
    name: "Cash-Secured Put",
    category: "income",
    view: "bullish",
    risk: "defined",
    ivBias: "short",
    summary: "Sell an OTM put fully cash-backed. Get paid to set a buy limit.",
    bestWhen: "Happy to own lower; collect premium while you wait.",
    build: (c) => [L("sell", "PE", c.atm - c.step, c.premium(c.atm - c.step, "PE"))],
  },
  {
    id: "call-ratio-backspread",
    name: "Call Ratio Backspread",
    category: "volatility",
    view: "bullish",
    risk: "defined",
    ivBias: "long",
    summary: "Sell 1 ATM call, buy 2 higher calls. Cheap/credit with explosive upside.",
    bestWhen: "Bullish breakout expected; you want convexity, not just delta.",
    build: (c) => [
      L("sell", "CE", c.atm, c.premium(c.atm, "CE")),
      L("buy", "CE", c.atm + 2 * c.step, c.premium(c.atm + 2 * c.step, "CE"), 2),
    ],
  },
  {
    id: "protective-put",
    name: "Protective Put",
    category: "hedge",
    view: "bullish",
    risk: "defined",
    ivBias: "long",
    summary: "Hold the underlying, buy a put. Insurance against a drawdown.",
    bestWhen: "Long and nervous into an event; pay to floor your downside.",
    build: (c) => [
      L("buy", "EQ", c.spot, c.spot),
      L("buy", "PE", c.atm - c.step, c.premium(c.atm - c.step, "PE")),
    ],
  },
];

export function getStrategy(id: string): StrategyDef | undefined {
  return STRATEGIES.find((s) => s.id === id);
}
