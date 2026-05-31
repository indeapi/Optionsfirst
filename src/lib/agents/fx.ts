/**
 * Cross-border FX layer (Plutus).
 *
 * Because Options First spans US and Indian markets, a trader's *currency* is
 * part of the edge. This module tracks the relevant pairs against their 30-day
 * average and flags remittance windows — e.g. when a EUR or USD holder sending
 * money to INR gets meaningfully more rupees than usual.
 *
 * Rates are simulated (deterministic per day) until a live FX feed is attached.
 */

export interface FxRate {
  pair: string;
  base: "USD" | "EUR" | "GBP";
  quote: "INR" | "USD";
  rate: number;
  avg30: number;
  /** Rate vs its 30-day average, in percent. */
  changePct: number;
  simulated: boolean;
}

export interface RemittanceAlert {
  id: string;
  from: "USD" | "EUR" | "GBP";
  to: "INR";
  rate: number;
  avg30: number;
  /** Extra value vs the 30-day average, in percent. */
  benefitPct: number;
  severity: "positive" | "watch" | "info";
  headline: string;
  detail: string;
  /** Worked example. */
  exampleAmount: number;
  exampleInrNow: number;
  exampleInrAvg: number;
}

interface PairSeed {
  pair: string;
  base: FxRate["base"];
  quote: FxRate["quote"];
  ref: number;
}

const PAIRS: PairSeed[] = [
  { pair: "USD/INR", base: "USD", quote: "INR", ref: 85.4 },
  { pair: "EUR/INR", base: "EUR", quote: "INR", ref: 92.6 },
  { pair: "GBP/INR", base: "GBP", quote: "INR", ref: 108.3 },
  { pair: "EUR/USD", base: "EUR", quote: "USD", ref: 1.084 },
];

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dailyDrift(pair: string, now: number): number {
  const day = new Date(now).toISOString().slice(0, 10);
  const h = hashStr(`${pair}:${day}`);
  // Deterministic ±0.65% drift vs the 30-day average.
  return ((h % 1300) / 1000 - 0.65) / 100;
}

export function getFxRates(now = Date.now()): FxRate[] {
  return PAIRS.map((p) => {
    const drift = dailyDrift(p.pair, now);
    const rate = p.ref * (1 + drift);
    return {
      pair: p.pair,
      base: p.base,
      quote: p.quote,
      rate,
      avg30: p.ref,
      changePct: drift * 100,
      simulated: true,
    };
  });
}

/** Remittance windows for the cross-border users sending money home to INR. */
export function remittanceAlerts(now = Date.now()): RemittanceAlert[] {
  const rates = getFxRates(now).filter((r) => r.quote === "INR");
  const examples: Record<string, number> = { USD: 10000, EUR: 10000, GBP: 10000 };
  return rates.map((r) => {
    const benefitPct = r.changePct;
    const exampleAmount = examples[r.base];
    const exampleInrNow = exampleAmount * r.rate;
    const exampleInrAvg = exampleAmount * r.avg30;
    let severity: RemittanceAlert["severity"];
    let headline: string;
    if (benefitPct >= 0.25) {
      severity = "positive";
      headline = `Favourable ${r.base}→INR window — ${benefitPct.toFixed(2)}% above 30-day average`;
    } else if (benefitPct <= -0.25) {
      severity = "watch";
      headline = `${r.base}→INR soft — ${Math.abs(benefitPct).toFixed(2)}% below average, consider waiting`;
    } else {
      severity = "info";
      headline = `${r.base}→INR near fair value (${benefitPct >= 0 ? "+" : ""}${benefitPct.toFixed(2)}%)`;
    }
    return {
      id: `rem-${r.base}`,
      from: r.base,
      to: "INR",
      rate: r.rate,
      avg30: r.avg30,
      benefitPct,
      severity,
      headline,
      detail:
        severity === "positive"
          ? `Sending ${r.base} ${exampleAmount.toLocaleString()} now yields ₹${Math.round(
              exampleInrNow,
            ).toLocaleString()} — about ₹${Math.round(
              exampleInrNow - exampleInrAvg,
            ).toLocaleString()} more than the 30-day average. Good window to fund an INR options account or repatriate gains.`
          : severity === "watch"
            ? `${r.base}→INR is below its 30-day average; ₹${Math.round(
                exampleInrAvg - exampleInrNow,
              ).toLocaleString()} less on ${r.base} ${exampleAmount.toLocaleString()} than typical. No urgency to remit.`
            : `${r.base}→INR is roughly at fair value. No currency edge either way right now.`,
      exampleAmount,
      exampleInrNow,
      exampleInrAvg,
    };
  });
}
