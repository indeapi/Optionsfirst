/**
 * Strategy payoff math — the engine behind every payoff diagram and the
 * max-profit / max-loss / breakeven figures shown on a strategy card.
 */

import { normCdf } from "./blackScholes";

export interface Leg {
  action: "buy" | "sell";
  /** "CE"/"PE" for options, "EQ" for an underlying/stock leg (covered call etc). */
  right: "CE" | "PE" | "EQ";
  strike: number;
  /** Number of lots / contracts. */
  qty: number;
  /** Entry price per unit (option premium, or share price for EQ legs). */
  premium: number;
}

export interface PayoffPoint {
  price: number;
  pnl: number;
}

export interface PayoffResult {
  points: PayoffPoint[];
  maxProfit: number; // Infinity if unbounded
  maxLoss: number; // -Infinity if unbounded
  breakevens: number[];
  /** Net premium: negative = debit paid, positive = credit received (per lot set, ×lotSize). */
  netPremium: number;
  /** reward:risk ratio (undefined when a side is unbounded). */
  rewardRisk: number | undefined;
  /** Model-estimated probability of profit (lognormal, ATM-IV based). */
  pop: number | undefined;
}

const sign = (a: "buy" | "sell") => (a === "buy" ? 1 : -1);

/** P&L of a single leg at expiry price S, per 1 unit of underlying. */
function legPnlPerUnit(leg: Leg, s: number): number {
  let intrinsic: number;
  if (leg.right === "EQ") intrinsic = s;
  else if (leg.right === "CE") intrinsic = Math.max(s - leg.strike, 0);
  else intrinsic = Math.max(leg.strike - s, 0);
  // buy: gain intrinsic, pay premium. sell: receive premium, owe intrinsic.
  return sign(leg.action) * (intrinsic - leg.premium) * leg.qty;
}

/** Total P&L (in currency) of the position at expiry price S. */
export function payoffAt(legs: Leg[], s: number, lotSize: number): number {
  let pnl = 0;
  for (const leg of legs) pnl += legPnlPerUnit(leg, s);
  return pnl * lotSize;
}

/** Net premium in currency: negative = net debit, positive = net credit. */
export function netPremium(legs: Leg[], lotSize: number): number {
  let prem = 0;
  for (const leg of legs) prem += -sign(leg.action) * leg.premium * leg.qty;
  return prem * lotSize;
}

export interface BuildPayoffOpts {
  spot: number;
  lotSize: number;
  /** Fractional half-width of the price grid around spot (0.18 = ±18%). */
  span?: number;
  steps?: number;
  /** ATM IV + days-to-expiry let us estimate probability of profit. */
  atmIV?: number;
  dte?: number;
}

export function buildPayoff(legs: Leg[], opts: BuildPayoffOpts): PayoffResult {
  const { spot, lotSize, span = 0.16, steps = 161 } = opts;
  const lo = spot * (1 - span);
  const hi = spot * (1 + span);
  const dx = (hi - lo) / (steps - 1);

  const points: PayoffPoint[] = [];
  let maxProfit = -Infinity;
  let maxLoss = Infinity;
  for (let i = 0; i < steps; i++) {
    const price = lo + i * dx;
    const pnl = payoffAt(legs, price, lotSize);
    points.push({ price, pnl });
    if (pnl > maxProfit) maxProfit = pnl;
    if (pnl < maxLoss) maxLoss = pnl;
  }

  // Detect unbounded sides from the slope at the extremes.
  const slopeHi =
    payoffAt(legs, hi + dx, lotSize) - payoffAt(legs, hi, lotSize);
  const slopeLo =
    payoffAt(legs, lo, lotSize) - payoffAt(legs, lo - dx, lotSize);
  if (slopeHi > 1e-6) maxProfit = Infinity;
  if (slopeLo < -1e-6) maxProfit = Infinity;
  if (slopeHi < -1e-6) maxLoss = -Infinity;
  if (slopeLo > 1e-6) maxLoss = -Infinity;

  // Breakevens: where the curve crosses zero.
  const breakevens: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.pnl === 0) breakevens.push(a.price);
    else if (a.pnl < 0 !== b.pnl < 0) {
      const tCross = a.pnl / (a.pnl - b.pnl);
      breakevens.push(a.price + tCross * (b.price - a.price));
    }
  }

  const net = netPremium(legs, lotSize);
  const rewardRisk =
    Number.isFinite(maxProfit) && Number.isFinite(maxLoss) && maxLoss !== 0
      ? Math.abs(maxProfit / maxLoss)
      : undefined;

  return {
    points,
    maxProfit,
    maxLoss,
    breakevens: dedupe(breakevens),
    netPremium: net,
    rewardRisk,
    pop: estimatePOP(legs, breakevens, opts),
  };
}

function dedupe(xs: number[]): number[] {
  const out: number[] = [];
  for (const x of xs) {
    if (!out.some((y) => Math.abs(y - x) < 1e-6)) out.push(x);
  }
  return out.sort((a, b) => a - b);
}

/**
 * Probability of profit under a lognormal terminal-price assumption using the
 * ATM IV as the move estimate. Approximate, but enough to rank strategies and
 * give the trader a feel for the odds.
 */
function estimatePOP(
  legs: Leg[],
  breakevens: number[],
  opts: BuildPayoffOpts,
): number | undefined {
  const { spot, lotSize, atmIV, dte } = opts;
  if (!atmIV || !dte || breakevens.length === 0) return undefined;
  const t = dte / 365;
  const vol = atmIV * Math.sqrt(t);
  if (vol <= 0) return undefined;
  // Probability the terminal price lands below a level x (lognormal).
  const cdf = (x: number) => {
    const z = (Math.log(x / spot) + 0.5 * vol * vol * 0) / vol; // drift-free
    return normCdf(z);
  };
  // Walk the price line in segments split by breakevens; sum probability mass
  // over the profitable segments.
  const cuts = [0, ...breakevens.sort((a, b) => a - b), Infinity];
  let prob = 0;
  for (let i = 0; i < cuts.length - 1; i++) {
    const mid = Number.isFinite(cuts[i + 1])
      ? 0.5 * (cuts[i] + cuts[i + 1])
      : cuts[i] * 1.5 + 1;
    const profitable = payoffAt(legs, mid, lotSize) > 0;
    if (!profitable) continue;
    const pLo = cuts[i] <= 0 ? 0 : cdf(cuts[i]);
    const pHi = Number.isFinite(cuts[i + 1]) ? cdf(cuts[i + 1]) : 1;
    prob += Math.max(0, pHi - pLo);
  }
  return Math.min(1, Math.max(0, prob));
}
