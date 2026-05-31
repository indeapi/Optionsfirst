/**
 * Simulated market engine.
 *
 * Produces realistic, gently-evolving option chains so Options First is fully
 * functional before a live IBKR/Kite key is attached. The structure (OI walls,
 * IV skew, greeks) is deterministic per instrument/expiry; a light random walk
 * advances spot and premiums on each refresh for a true real-time feel.
 *
 * Everything it returns is stamped SIMULATED so the UI ★-marks it — there is no
 * pretending this is a live feed.
 */

import { bsGreeks, bsPrice } from "@/lib/quant/blackScholes";
import { getProvenance } from "./freshness";
import { daysToExpiry, type InstrumentSeed } from "./instruments";
import type { OptionChain, OptionChainRow, OptionQuote, TrackedField } from "./types";

// ---- deterministic PRNG ----------------------------------------------------
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rng(seed: string): () => number {
  return mulberry32(hashStr(seed));
}

// ---- live walk state (persists across refreshes within a session) ----------
interface WalkState {
  spot: number;
  prevClose: number;
  lastTick: number;
}
const walks = new Map<string, WalkState>();

function todayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function advanceSpot(seed: InstrumentSeed, now: number): WalkState {
  const existing = walks.get(seed.symbol);
  if (!existing) {
    // Anchor a deterministic intraday drift so different names trend differently.
    const r = rng(`${seed.symbol}:${todayKey(now)}`);
    const driftPct = (r() - 0.48) * 2.4; // roughly ±1.2%
    const prevClose = seed.refSpot;
    const spot = prevClose * (1 + driftPct / 100);
    const st = { spot, prevClose, lastTick: now };
    walks.set(seed.symbol, st);
    return st;
  }
  // GBM step scaled by elapsed time, capped so a tab left open doesn't explode.
  const dt = Math.min(5, Math.max(0, (now - existing.lastTick) / 1000)) / (252 * 6.5 * 3600);
  if (dt > 0) {
    const r = rng(`${seed.symbol}:${now}`);
    const z = gaussian(r);
    const vol = seed.baseIV;
    const step = Math.exp((-0.5 * vol * vol) * dt + vol * Math.sqrt(dt) * z);
    existing.spot *= step;
    existing.lastTick = now;
  }
  return existing;
}

function gaussian(r: () => number): number {
  // Box-Muller.
  const u = Math.max(1e-9, r());
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---- chain construction ----------------------------------------------------
function strikeRange(spot: number, step: number, iv: number, t: number) {
  const expMove = spot * iv * Math.sqrt(Math.max(t, 1 / 365));
  const half = Math.min(21, Math.max(8, Math.round((1.6 * expMove) / step)));
  const atm = Math.round(spot / step) * step;
  const strikes: number[] = [];
  for (let i = -half; i <= half; i++) strikes.push(atm + i * step);
  return { strikes, atm, expMove };
}

function skewedIV(seed: InstrumentSeed, strike: number, spot: number): number {
  // Smile + put skew: OTM puts richer, deep OTM calls slightly firmer.
  const m = (strike - spot) / spot; // moneyness
  const smile = 0.55 * m * m * 4; // curvature
  const putSkew = m < 0 ? -m * seed.skew * 3.2 : 0;
  return Math.max(0.03, seed.baseIV + smile + putSkew);
}

function oiProfile(
  seed: InstrumentSeed,
  strike: number,
  atm: number,
  expMove: number,
  right: "CE" | "PE",
  r: () => number,
): { oi: number; oiChange: number } {
  const peak = seed.kind === "equity" ? 7200 : seed.region === "IN" ? 118000 : 41000;
  const width = Math.max(seed.strikeStep * 2, expMove * 0.85);
  const dist = strike - atm;
  let base = peak * Math.exp(-0.5 * (dist / width) ** 2);
  // Calls build above the money, puts below — typical positioning.
  if (right === "CE" && dist > 0) base *= 1.15;
  if (right === "PE" && dist < 0) base *= 1.15;
  // Round-number "walls" attract OI.
  const roundStep = seed.strikeStep * (seed.region === "IN" ? 10 : 5);
  if (Math.abs(strike % roundStep) < 1e-6) base *= 1.45;
  const noise = 0.8 + r() * 0.5;
  const oi = Math.round(base * noise);
  // Fresh OI: writers add above (calls) / below (puts) on quiet days.
  const oiChange = Math.round((r() - 0.42) * base * 0.22);
  return { oi, oiChange };
}

function quote(
  seed: InstrumentSeed,
  strike: number,
  right: "CE" | "PE",
  spot: number,
  atm: number,
  t: number,
  expMove: number,
  r: () => number,
): OptionQuote {
  const iv = skewedIV(seed, strike, spot);
  const inp = { s: spot, k: strike, t, r: seed.rate, sigma: iv, right } as const;
  const fair = bsPrice(inp);
  const greeks = bsGreeks(inp);
  const tick = seed.region === "IN" ? 0.05 : 0.01;
  const ltp = Math.max(tick, roundTo(fair * (0.997 + r() * 0.006), tick));
  const spreadPct = seed.kind === "equity" ? 0.012 : 0.006;
  const half = Math.max(tick, roundTo(ltp * spreadPct, tick));
  const { oi, oiChange } = oiProfile(seed, strike, atm, expMove, right, r);
  const moneyness = Math.abs(strike - atm) / (expMove || 1);
  const volume = Math.round(oi * (0.18 + 0.5 * Math.exp(-moneyness)) * (0.6 + r() * 0.8));
  return {
    strike,
    right,
    ltp,
    bid: Math.max(tick, roundTo(ltp - half, tick)),
    ask: roundTo(ltp + half, tick),
    volume,
    oi,
    oiChange,
    iv,
    greeks,
    atm: strike === atm,
  };
}

function roundTo(x: number, step: number): number {
  return Math.round(x / step) * step;
}

/** Build a full simulated option chain for an instrument + expiry. */
export function buildSimulatedChain(
  seed: InstrumentSeed,
  expiry: string,
  now = Date.now(),
): OptionChain {
  const walk = advanceSpot(seed, now);
  const spot = walk.spot;
  const dte = daysToExpiry(expiry, now);
  const t = Math.max(0.5 / 365, dte / 365);
  const iv = seed.baseIV;
  const { strikes, atm, expMove } = strikeRange(spot, seed.strikeStep, iv, t);

  const rows: OptionChainRow[] = strikes.map((strike) => {
    const r = rng(`${seed.symbol}:${expiry}:${strike}:${todayKey(now)}`);
    return {
      strike,
      call: quote(seed, strike, "CE", spot, atm, t, expMove, r),
      put: quote(seed, strike, "PE", spot, atm, t, expMove, r),
    };
  });

  const fields: TrackedField[] = [
    "ltp",
    "bidAsk",
    "volume",
    "oi",
    "iv",
    "greeks",
    "spot",
    "pcr",
    "maxPain",
  ];
  const freshness = Object.fromEntries(
    fields.map((f) => [f, getProvenance(seed.region, f, { simulated: true, asOf: now })]),
  ) as OptionChain["freshness"];

  const spotChange = spot - walk.prevClose;

  return {
    instrument: { ...seed, expiries: [expiry] },
    expiry,
    spot,
    spotChange,
    spotChangePct: (spotChange / walk.prevClose) * 100,
    rows,
    freshness,
    atmStrike: atm,
    builtAt: now,
  };
}
