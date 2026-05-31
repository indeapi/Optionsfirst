/**
 * Black-Scholes-Merton pricing, greeks, and an implied-vol solver.
 *
 * One engine serves both markets: for Indian index options we feed the
 * (near-)futures price as the underlying, which is the Black-76 convention,
 * and for US equity/ETF options we feed spot with a carry/dividend yield.
 * Greeks are returned in *trader* units: vega per 1% vol, theta per calendar
 * day, rho per 1% rate — the way they're read on a desk.
 */

import type { Greeks } from "@/lib/data/types";

export interface BSInputs {
  /** Underlying spot (or future) price. */
  s: number;
  /** Strike. */
  k: number;
  /** Time to expiry in years. */
  t: number;
  /** Risk-free rate (annualised, e.g. 0.065 for India, 0.045 for US). */
  r: number;
  /** Volatility as a fraction (0.18 = 18%). */
  sigma: number;
  /** Carry / dividend yield. 0 for index/future underlyings. */
  q?: number;
  right: "CE" | "PE";
}

const SQRT_2PI = Math.sqrt(2 * Math.PI);

/** Standard normal PDF. */
export function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

/** Standard normal CDF via Abramowitz-Stegun 7.1.26 (max error ~7.5e-8). */
export function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

function d1d2({ s, k, t, r, sigma, q = 0 }: BSInputs): [number, number] {
  const vt = sigma * Math.sqrt(t);
  const d1 = (Math.log(s / k) + (r - q + 0.5 * sigma * sigma) * t) / vt;
  return [d1, d1 - vt];
}

export function bsPrice(inp: BSInputs): number {
  const { s, k, t, r, q = 0, right } = inp;
  if (t <= 0 || inp.sigma <= 0) {
    // Intrinsic value at/after expiry.
    return right === "CE" ? Math.max(s - k, 0) : Math.max(k - s, 0);
  }
  const [d1, d2] = d1d2(inp);
  const disc = Math.exp(-r * t);
  const carry = Math.exp(-q * t);
  if (right === "CE") {
    return s * carry * normCdf(d1) - k * disc * normCdf(d2);
  }
  return k * disc * normCdf(-d2) - s * carry * normCdf(-d1);
}

/** Greeks in trader units: vega/1%, theta/day, rho/1%. */
export function bsGreeks(inp: BSInputs): Greeks {
  const { s, k, t, r, sigma, q = 0, right } = inp;
  if (t <= 0 || sigma <= 0) {
    const intrinsicDelta = right === "CE" ? (s > k ? 1 : 0) : s < k ? -1 : 0;
    return { delta: intrinsicDelta, gamma: 0, theta: 0, vega: 0, rho: 0 };
  }
  const [d1, d2] = d1d2(inp);
  const carry = Math.exp(-q * t);
  const disc = Math.exp(-r * t);
  const pdf = normPdf(d1);
  const sqrtT = Math.sqrt(t);

  const delta =
    right === "CE" ? carry * normCdf(d1) : carry * (normCdf(d1) - 1);
  const gamma = (carry * pdf) / (s * sigma * sqrtT);
  const vegaPerUnit = s * carry * pdf * sqrtT; // per 1.00 vol
  const thetaPerYear =
    right === "CE"
      ? -(s * carry * pdf * sigma) / (2 * sqrtT) -
        r * k * disc * normCdf(d2) +
        q * s * carry * normCdf(d1)
      : -(s * carry * pdf * sigma) / (2 * sqrtT) +
        r * k * disc * normCdf(-d2) -
        q * s * carry * normCdf(-d1);
  const rhoPerUnit =
    right === "CE"
      ? k * t * disc * normCdf(d2)
      : -k * t * disc * normCdf(-d2);

  return {
    delta,
    gamma,
    vega: vegaPerUnit / 100, // per 1% vol
    theta: thetaPerYear / 365, // per calendar day
    rho: rhoPerUnit / 100, // per 1% rate
  };
}

/**
 * Implied volatility from a traded price. Bisection — robust and monotone,
 * which matters when we solve thousands of strikes on every refresh.
 */
export function impliedVol(
  price: number,
  inp: Omit<BSInputs, "sigma">,
  opts: { lo?: number; hi?: number; tol?: number; maxIter?: number } = {},
): number {
  const { lo = 0.005, hi = 5, tol = 1e-4, maxIter = 64 } = opts;
  let a = lo;
  let b = hi;
  const f = (vol: number) => bsPrice({ ...inp, sigma: vol }) - price;
  let fa = f(a);
  const fb = f(b);
  if (fa * fb > 0) {
    // Price outside the model's reachable range — fall back to a sane mid.
    return 0.2;
  }
  let mid = 0.2;
  for (let i = 0; i < maxIter; i++) {
    mid = 0.5 * (a + b);
    const fm = f(mid);
    if (Math.abs(fm) < tol) return mid;
    if (fa * fm < 0) {
      b = mid;
    } else {
      a = mid;
      fa = fm;
    }
  }
  return mid;
}
