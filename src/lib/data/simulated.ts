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
import { IBKR_CAPTURED_AT, type IbkrUnderlying } from "./live/ibkrCapture";
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

/**
 * Build a full option chain for an instrument + expiry.
 *
 * With an `anchor` (real IBKR capture) the chain is pinned to reality: real
 * spot, real underlying IV, and per-strike OI scaled so the call/put totals
 * match the real aggregate OI exactly (→ real PCR). Per-strike prices/greeks
 * are then computed from those real inputs; bid/ask and per-strike volume stay
 * modelled. Without an anchor everything is simulated ★ and the spot walks.
 */
export function buildChain(
  seed: InstrumentSeed,
  expiry: string,
  now = Date.now(),
  anchor?: IbkrUnderlying,
): OptionChain {
  // The spot always walks intraday so the terminal updates every tick. For
  // anchored (real IBKR) US names the walk starts from the real captured price
  // (the US seeds carry it) and IV/OI stay pinned to the real figures below.
  const walk = advanceSpot(seed, now);
  const spot = walk.spot;
  const prevClose = walk.prevClose;
  const baseIV = anchor ? anchor.underlyingIV : seed.baseIV;
  const wseed: InstrumentSeed = anchor ? { ...seed, baseIV } : seed;
  const dte = daysToExpiry(expiry, now);
  const t = Math.max(0.5 / 365, dte / 365);
  const { strikes, atm, expMove } = strikeRange(spot, seed.strikeStep, baseIV, t);

  const rows: OptionChainRow[] = strikes.map((strike) => {
    const r = rng(`${seed.symbol}:${expiry}:${strike}:${todayKey(now)}`);
    return {
      strike,
      call: quote(wseed, strike, "CE", spot, atm, t, expMove, r),
      put: quote(wseed, strike, "PE", spot, atm, t, expMove, r),
    };
  });
  if (anchor) scaleOIToReal(rows, anchor.callOI, anchor.putOI);

  const spotChange = spot - prevClose;
  const chain: OptionChain = {
    instrument: { ...seed, expiries: [expiry] },
    expiry,
    spot,
    spotChange,
    spotChangePct: (spotChange / prevClose) * 100,
    rows,
    freshness: buildFreshness(seed.region, now, anchor),
    atmStrike: atm,
    builtAt: now,
  };
  if (anchor) {
    chain.live = {
      source: "IBKR",
      capturedAt: IBKR_CAPTURED_AT,
      ivRank: anchor.ivPercentile,
      ivPercentile: anchor.ivPercentile,
    };
  }
  return chain;
}

/** Back-compat alias. */
export const buildSimulatedChain = buildChain;

/** Scale modelled per-strike OI so the call/put totals match the real feed. */
function scaleOIToReal(rows: OptionChainRow[], callTotal: number, putTotal: number) {
  const sc = rows.reduce((a, r) => a + r.call.oi, 0) || 1;
  const sp = rows.reduce((a, r) => a + r.put.oi, 0) || 1;
  const fc = callTotal / sc;
  const fp = putTotal / sp;
  for (const r of rows) {
    r.call.oi = Math.round(r.call.oi * fc);
    r.call.oiChange = Math.round(r.call.oiChange * fc);
    r.put.oi = Math.round(r.put.oi * fp);
    r.put.oiChange = Math.round(r.put.oiChange * fp);
  }
}

/**
 * Per-field provenance. Anchored (real IBKR) chains keep IV / OI / PCR pinned
 * to the real captured figures, derive greeks / max-pain from them, and let the
 * intraday-moving fields (spot, prices, volume) be ★ simulated movement around
 * the real reference. Un-anchored chains are all ★.
 */
function buildFreshness(
  region: OptionChain["instrument"]["region"],
  now: number,
  anchor?: IbkrUnderlying,
): OptionChain["freshness"] {
  const fields: TrackedField[] = [
    "ltp", "bidAsk", "volume", "oi", "iv", "greeks", "spot", "pcr", "maxPain",
  ];
  const captured = new Set<TrackedField>(["iv", "oi", "pcr"]);
  const computed = new Set<TrackedField>(["greeks", "maxPain"]);
  const out: OptionChain["freshness"] = {};
  for (const f of fields) {
    if (!anchor) {
      out[f] = getProvenance(region, f, { simulated: true, asOf: now });
    } else if (captured.has(f)) {
      out[f] = getProvenance(region, f, { simulated: false, captured: true, asOf: IBKR_CAPTURED_AT });
    } else if (computed.has(f)) {
      out[f] = getProvenance(region, f, { simulated: false, computed: true, asOf: now });
    } else {
      out[f] = getProvenance(region, f, { simulated: true, asOf: now });
    }
  }
  return out;
}
