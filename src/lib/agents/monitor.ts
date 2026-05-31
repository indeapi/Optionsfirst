/**
 * Live trade monitor (Nike).
 *
 * Revalues open positions against the latest chain, tracks P&L versus target
 * and stop, and raises findings when a trade needs attention. This is the
 * "continuous monitoring while the trade is live" layer.
 */

import type { Leg } from "@/lib/quant/payoff";
import { buildPayoff } from "@/lib/quant/payoff";
import type { Finding } from "./registry";
import type { MarketRegion, OptionChain } from "@/lib/data/types";

export interface LivePosition {
  id: string;
  symbol: string;
  region: MarketRegion;
  strategyId: string;
  strategyName: string;
  legs: Leg[];
  qtyLots: number;
  lotSize: number;
  currency: "INR" | "USD";
  /** Net cost at entry in currency (negative = debit paid, positive = credit). */
  entryNet: number;
  target: number; // profit target in currency
  stop: number; // max loss in currency (negative)
  openedAt: number;
}

export type PositionStatus =
  | "running"
  | "near-target"
  | "target-hit"
  | "near-stop"
  | "stop-hit";

export interface PositionMark {
  position: LivePosition;
  currentNet: number;
  pnl: number;
  pnlPct: number;
  status: PositionStatus;
  spot: number;
}

function priceLeg(leg: Leg, chain: OptionChain): number {
  if (leg.right === "EQ") return chain.spot;
  const row = chain.rows.find((r) => r.strike === leg.strike);
  if (!row) return leg.premium; // fall back to entry if strike rolled off-chain
  return leg.right === "CE" ? row.call.ltp : row.put.ltp;
}

/** Position value = what you'd net to close now (buy legs +, sold legs -). */
function positionValue(
  legs: Leg[],
  price: (leg: Leg) => number,
  lotSize: number,
): number {
  let v = 0;
  for (const leg of legs) {
    const s = leg.action === "buy" ? 1 : -1;
    v += s * price(leg) * leg.qty;
  }
  return v * lotSize;
}

export function markToMarket(position: LivePosition, chain: OptionChain): PositionMark {
  const entryValue = positionValue(position.legs, (l) => l.premium, position.lotSize);
  const currentValue = positionValue(position.legs, (l) => priceLeg(l, chain), position.lotSize);
  const pnl = (currentValue - entryValue) * position.qtyLots;
  const denom = Math.max(1, Math.abs(position.entryNet || entryValue) * position.qtyLots);
  const pnlPct = (pnl / denom) * 100;

  let status: PositionStatus = "running";
  if (pnl >= position.target) status = "target-hit";
  else if (pnl <= position.stop) status = "stop-hit";
  else if (pnl >= 0.8 * position.target) status = "near-target";
  else if (pnl <= 0.8 * position.stop) status = "near-stop";

  return {
    position,
    currentNet: currentValue * position.qtyLots,
    pnl,
    pnlPct,
    status,
    spot: chain.spot,
  };
}

const fmt = (ccy: "INR" | "USD", v: number) =>
  `${ccy === "INR" ? "₹" : "$"}${Math.round(v).toLocaleString()}`;

export function monitorFindings(mark: PositionMark): Finding[] {
  const { position: p, pnl, status } = mark;
  const sign = pnl >= 0 ? "+" : "−";
  const money = `${sign}${fmt(p.currency, Math.abs(pnl))}`;
  const base = `${p.strategyName} on ${p.symbol} · ${p.qtyLots} lot${p.qtyLots > 1 ? "s" : ""}`;

  switch (status) {
    case "target-hit":
      return [
        {
          agent: "nike",
          severity: "positive",
          title: `${p.symbol}: target hit — book or trail`,
          detail: `${base} is at ${money}, past its ${fmt(p.currency, p.target)} target. Nike suggests booking or trailing a stop to lock it in.`,
          metric: money,
        },
      ];
    case "stop-hit":
      return [
        {
          agent: "nike",
          severity: "alert",
          title: `${p.symbol}: stop breached — exit`,
          detail: `${base} is at ${money}, beyond its ${fmt(p.currency, Math.abs(p.stop))} stop. Nike flags this for an exit or defined-risk adjustment.`,
          metric: money,
        },
      ];
    case "near-target":
      return [
        {
          agent: "nike",
          severity: "watch",
          title: `${p.symbol}: approaching target`,
          detail: `${base} is at ${money}, ~80% of the way to target. Tighten the trail.`,
          metric: money,
        },
      ];
    case "near-stop":
      return [
        {
          agent: "nike",
          severity: "watch",
          title: `${p.symbol}: pressure near stop`,
          detail: `${base} is at ${money}, nearing its stop. Decide the adjustment before it triggers.`,
          metric: money,
        },
      ];
    default:
      return [
        {
          agent: "nike",
          severity: "info",
          title: `${p.symbol}: in range`,
          detail: `${base} is at ${money}, inside its target/stop band. Nothing to do.`,
          metric: money,
        },
      ];
  }
}

/** Build a couple of plausible open positions from a live chain (demo seed). */
export function buildSamplePositions(chain: OptionChain): LivePosition[] {
  const step =
    chain.rows.length > 1 ? chain.rows[1].strike - chain.rows[0].strike : 50;
  const atm = chain.atmStrike;
  const byStrike = new Map(chain.rows.map((r) => [r.strike, r]));
  const prem = (k: number, right: "CE" | "PE") => {
    const row = byStrike.get(k);
    return row ? (right === "CE" ? row.call.ltp : row.put.ltp) : step * 0.1;
  };
  const lot = chain.instrument.lotSize;

  if (chain.instrument.region === "IN") {
    // Iron condor opened "earlier" — entry credit a touch richer than now.
    const legs: Leg[] = [
      { action: "sell", right: "CE", strike: atm + 2 * step, qty: 1, premium: prem(atm + 2 * step, "CE") * 1.18 },
      { action: "buy", right: "CE", strike: atm + 4 * step, qty: 1, premium: prem(atm + 4 * step, "CE") * 1.12 },
      { action: "sell", right: "PE", strike: atm - 2 * step, qty: 1, premium: prem(atm - 2 * step, "PE") * 1.18 },
      { action: "buy", right: "PE", strike: atm - 4 * step, qty: 1, premium: prem(atm - 4 * step, "PE") * 1.12 },
    ];
    const payoff = buildPayoff(legs, { spot: chain.spot, lotSize: lot });
    return [
      {
        id: "pos-in-1",
        symbol: chain.instrument.symbol,
        region: "IN",
        strategyId: "iron-condor",
        strategyName: "Iron Condor",
        legs,
        qtyLots: 4,
        lotSize: lot,
        currency: "INR",
        entryNet: payoff.netPremium,
        target: Math.abs(payoff.netPremium) * 0.6 * 4,
        stop: -Math.abs(payoff.maxLoss) * 0.8 * 4,
        openedAt: chain.builtAt - 2 * 3600_000,
      },
    ];
  }

  // US: a bull call spread.
  const legs: Leg[] = [
    { action: "buy", right: "CE", strike: atm, qty: 1, premium: prem(atm, "CE") * 0.9 },
    { action: "sell", right: "CE", strike: atm + step, qty: 1, premium: prem(atm + step, "CE") * 0.92 },
  ];
  const payoff = buildPayoff(legs, { spot: chain.spot, lotSize: lot });
  return [
    {
      id: "pos-us-1",
      symbol: chain.instrument.symbol,
      region: "US",
      strategyId: "bull-call-spread",
      strategyName: "Bull Call Spread",
      legs,
      qtyLots: 3,
      lotSize: lot,
      currency: "USD",
      entryNet: payoff.netPremium,
      target: Math.abs(payoff.maxProfit) * 0.7 * 3,
      stop: -Math.abs(payoff.netPremium) * 0.5 * 3,
      openedAt: chain.builtAt - 4 * 3600_000,
    },
  ];
}
