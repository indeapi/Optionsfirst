/**
 * Open-Interest analytics: PCR, max-pain, OI walls (support/resistance),
 * ATM straddle and the implied expected move. These power the OI bar chart
 * and the positioning read on the dashboard.
 */

import type { ChainAnalytics, OptionChain } from "@/lib/data/types";

/** Max-pain: the strike at which option writers pay out the least at expiry. */
export function maxPain(chain: OptionChain): number {
  const strikes = chain.rows.map((r) => r.strike);
  let best = strikes[0];
  let bestLoss = Infinity;
  for (const settle of strikes) {
    let loss = 0;
    for (const row of chain.rows) {
      if (settle > row.strike) loss += row.call.oi * (settle - row.strike);
      if (settle < row.strike) loss += row.put.oi * (row.strike - settle);
    }
    if (loss < bestLoss) {
      bestLoss = loss;
      best = settle;
    }
  }
  return best;
}

function topStrikesBy(
  chain: OptionChain,
  pick: (r: OptionChain["rows"][number]) => number,
  n = 3,
): number[] {
  return [...chain.rows]
    .sort((a, b) => pick(b) - pick(a))
    .slice(0, n)
    .map((r) => r.strike)
    .sort((a, b) => a - b);
}

/**
 * IV rank / percentile. With only a snapshot we normalise the ATM IV against a
 * plausible regional band — a stand-in for a true rolling 1-year window, which
 * the live build will replace with historical IV from the broker feed.
 */
function ivStats(atmIV: number, region: OptionChain["instrument"]["region"]) {
  const band = region === "IN" ? { lo: 0.08, hi: 0.32 } : { lo: 0.1, hi: 0.55 };
  const clamped = Math.min(band.hi, Math.max(band.lo, atmIV));
  const rank = (clamped - band.lo) / (band.hi - band.lo);
  return { ivRank: rank, ivPercentile: Math.min(1, Math.max(0, rank * 0.95 + 0.02)) };
}

export function analyzeChain(chain: OptionChain): ChainAnalytics {
  let totalCallOI = 0;
  let totalPutOI = 0;
  let totalCallOIChange = 0;
  let totalPutOIChange = 0;
  for (const row of chain.rows) {
    totalCallOI += row.call.oi;
    totalPutOI += row.put.oi;
    totalCallOIChange += row.call.oiChange;
    totalPutOIChange += row.put.oiChange;
  }

  const atmRow =
    chain.rows.find((r) => r.strike === chain.atmStrike) ??
    chain.rows[Math.floor(chain.rows.length / 2)];
  const atmStraddle = atmRow.call.ltp + atmRow.put.ltp;
  const atmIV = (atmRow.call.iv + atmRow.put.iv) / 2;
  // Anchored chains carry a real IV percentile from the broker feed; otherwise
  // we normalise ATM IV against a regional band as a stand-in.
  const { ivRank, ivPercentile } = chain.live
    ? { ivRank: chain.live.ivRank, ivPercentile: chain.live.ivPercentile }
    : ivStats(atmIV, chain.instrument.region);

  return {
    pcr: totalCallOI > 0 ? totalPutOI / totalCallOI : 0,
    maxPain: maxPain(chain),
    totalCallOI,
    totalPutOI,
    totalCallOIChange,
    totalPutOIChange,
    resistance: topStrikesBy(chain, (r) => r.call.oi).filter(
      (s) => s >= chain.spot - chain.atmStrike * 0.002,
    ),
    support: topStrikesBy(chain, (r) => r.put.oi).filter(
      (s) => s <= chain.spot + chain.atmStrike * 0.002,
    ),
    atmStraddle,
    expectedMovePct: (atmStraddle / chain.spot) * 100,
    ivRank,
    ivPercentile,
    atmIV,
  };
}

/** Classify the tape from chain analytics — feeds the strategy ranker. */
export function inferMarketCondition(
  chain: OptionChain,
  analytics: ChainAnalytics,
  dte: number,
): import("@/lib/data/types").MarketCondition {
  const { pcr, ivRank, totalCallOIChange, totalPutOIChange } = analytics;

  // Direction: blend spot momentum with where fresh OI is being written.
  // Heavy fresh put writing = support building = bullish, and vice-versa.
  const oiTilt = totalPutOIChange - totalCallOIChange;
  let direction: import("@/lib/data/types").MarketCondition["direction"];
  const momentum = chain.spotChangePct;
  if (Math.abs(momentum) < 0.25 && Math.abs(oiTilt) < 0.15 * (analytics.totalCallOI + 1)) {
    direction = "neutral";
  } else if (momentum + oiTilt / (analytics.totalCallOI + 1) > 0.25) {
    direction = "bullish";
  } else if (momentum + oiTilt / (analytics.totalCallOI + 1) < -0.25) {
    direction = "bearish";
  } else {
    direction = "neutral";
  }
  // A very rich expected move with balanced PCR reads as "volatile".
  if (analytics.expectedMovePct > (chain.instrument.region === "IN" ? 1.6 : 4.5) && pcr > 0.8 && pcr < 1.25) {
    direction = "volatile";
  }

  const ivRegime: "low" | "elevated" | "high" =
    ivRank < 0.33 ? "low" : ivRank < 0.66 ? "elevated" : "high";

  return {
    direction,
    ivRegime,
    dte,
    trendStrength: Math.min(1, Math.abs(momentum) / 1.5),
  };
}
