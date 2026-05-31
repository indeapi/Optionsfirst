/**
 * Strategy ranking engine.
 *
 * Scores every template in the catalog against the prevailing market condition
 * across four transparent axes — directional fit, IV regime fit, time-to-expiry
 * fit and risk shape — then refines with the realised payoff (probability of
 * profit, reward:risk). Every score ships with the *reasons* behind it, because
 * the Athena agent has to be able to explain itself on the dashboard.
 */

import type { ChainAnalytics, MarketCondition, OptionChain } from "@/lib/data/types";
import { buildPayoff, type Leg, type PayoffResult } from "./payoff";
import {
  STRATEGIES,
  type BuilderCtx,
  type MarketView,
  type StrategyMeta,
} from "./strategies";

export interface RankedStrategy {
  meta: StrategyMeta;
  legs: Leg[];
  payoff: PayoffResult;
  score: number;
  reasons: string[];
  tags: string[];
}

const VIEW_MATCH: Record<MarketCondition["direction"], Record<MarketView, number>> = {
  bullish: { bullish: 1, bearish: 0, neutral: 0.45, volatile: 0.5 },
  bearish: { bullish: 0, bearish: 1, neutral: 0.45, volatile: 0.5 },
  neutral: { bullish: 0.4, bearish: 0.4, neutral: 1, volatile: 0.25 },
  volatile: { bullish: 0.55, bearish: 0.55, neutral: 0.2, volatile: 1 },
};

function ivScore(
  regime: MarketCondition["ivRegime"],
  bias: StrategyMeta["ivBias"],
): number {
  if (regime === "high") return bias === "short" ? 1 : bias === "neutral" ? 0.45 : 0.15;
  if (regime === "low") return bias === "long" ? 1 : bias === "neutral" ? 0.45 : 0.2;
  return bias === "short" ? 0.6 : bias === "long" ? 0.5 : 0.55; // elevated
}

function dteScore(dte: number, meta: StrategyMeta): number {
  if (dte <= 7) {
    if (meta.category === "income") return 1;
    if (meta.category === "volatility") return 0.3; // gamma bleed on longs
    return 0.45;
  }
  if (dte <= 30) return meta.category === "income" ? 0.8 : 0.7;
  // Longer-dated: directional & long-vol get room to work.
  if (meta.category === "directional" || meta.category === "volatility") return 0.85;
  return 0.55;
}

function riskScore(meta: StrategyMeta, cond: MarketCondition): number {
  if (meta.risk === "defined") return 0.85;
  // Undefined risk only earns its keep in a calm, high-IV, neutral tape.
  if (cond.direction === "neutral" && cond.ivRegime === "high") return 0.7;
  return 0.3;
}

function buildCtx(chain: OptionChain): BuilderCtx {
  const step =
    chain.rows.length > 1
      ? Math.round(chain.rows[1].strike - chain.rows[0].strike)
      : 50;
  const byStrike = new Map(chain.rows.map((r) => [r.strike, r]));
  const premium = (strike: number, right: "CE" | "PE") => {
    const row = byStrike.get(strike);
    if (row) return right === "CE" ? row.call.ltp : row.put.ltp;
    // Wing beyond the loaded chain: fall back to a small time-value floor.
    return Math.max(0.05, step * 0.02);
  };
  return { atm: chain.atmStrike, step, spot: chain.spot, premium };
}

export function rankStrategies(
  chain: OptionChain,
  analytics: ChainAnalytics,
  condition: MarketCondition,
  opts: { limit?: number } = {},
): RankedStrategy[] {
  const ctx = buildCtx(chain);
  const dte = condition.dte;

  const ranked = STRATEGIES.map((def) => {
    const legs = def.build(ctx);
    const payoff = buildPayoff(legs, {
      spot: chain.spot,
      lotSize: chain.instrument.lotSize,
      atmIV: analytics.atmIV,
      dte,
      span: chain.instrument.region === "IN" ? 0.1 : 0.2,
    });

    const sView = VIEW_MATCH[condition.direction][def.view];
    const sIV = ivScore(condition.ivRegime, def.ivBias);
    const sDte = dteScore(dte, def);
    const sRisk = riskScore(def, condition);

    // Weighted blend, then nudge by realised payoff quality.
    let score =
      100 * (0.4 * sView + 0.27 * sIV + 0.18 * sDte + 0.15 * sRisk);
    if (payoff.pop !== undefined) score += (payoff.pop - 0.5) * 18;
    if (payoff.rewardRisk !== undefined && payoff.rewardRisk < 0.33) score -= 8;
    if (!Number.isFinite(payoff.maxLoss)) score -= 6; // unbounded downside
    score = Math.max(1, Math.min(100, score));

    const reasons = buildReasons(def, condition, analytics, payoff, {
      sView,
      sIV,
      sDte,
    });
    const tags = buildTags(def, condition, payoff);

    return { meta: def, legs, payoff, score: Math.round(score), reasons, tags };
  });

  ranked.sort((a, b) => b.score - a.score);
  return opts.limit ? ranked.slice(0, opts.limit) : ranked;
}

function buildReasons(
  meta: StrategyMeta,
  cond: MarketCondition,
  analytics: ChainAnalytics,
  payoff: PayoffResult,
  s: { sView: number; sIV: number; sDte: number },
): string[] {
  const out: string[] = [];
  if (s.sView >= 0.9)
    out.push(`Directional fit: your read is ${cond.direction} and this is a ${meta.view} structure.`);
  else if (s.sView <= 0.1)
    out.push(`Counter-trend: works against the current ${cond.direction} read — sizing caution.`);

  if (s.sIV >= 0.9) {
    out.push(
      meta.ivBias === "short"
        ? `IV is ${cond.ivRegime} (rank ${(analytics.ivRank * 100).toFixed(0)}) — selling premium is favoured.`
        : `IV is ${cond.ivRegime} (rank ${(analytics.ivRank * 100).toFixed(0)}) — long options are cheap.`,
    );
  }
  if (s.sDte >= 0.9)
    out.push(`Time-to-expiry (${cond.dte}d) suits this structure's theta/gamma profile.`);

  if (payoff.pop !== undefined)
    out.push(`Model probability of profit ≈ ${(payoff.pop * 100).toFixed(0)}%.`);
  if (payoff.rewardRisk !== undefined)
    out.push(`Reward:risk ≈ ${payoff.rewardRisk.toFixed(2)} : 1.`);
  if (!Number.isFinite(payoff.maxLoss))
    out.push(`Undefined downside — define risk or hedge the tails before sizing up.`);
  return out;
}

function buildTags(
  meta: StrategyMeta,
  cond: MarketCondition,
  payoff: PayoffResult,
): string[] {
  const tags = [
    meta.category[0].toUpperCase() + meta.category.slice(1),
    meta.risk === "defined" ? "Defined risk" : "Undefined risk",
  ];
  if (meta.ivBias === "short") tags.push("Short vega");
  if (meta.ivBias === "long") tags.push("Long vega");
  if (cond.ivRegime === "high" && meta.ivBias === "short") tags.push("IV harvest");
  if (payoff.netPremium > 0) tags.push("Net credit");
  else if (payoff.netPremium < 0) tags.push("Net debit");
  return tags;
}
