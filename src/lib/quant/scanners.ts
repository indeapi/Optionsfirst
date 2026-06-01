/**
 * Cross-instrument market scan — powers the Gainers/Losers, OI and spike
 * boards and the IV-rank scan (the iCharts dashboard scanners). Derived from
 * the same provider snapshots the rest of the app uses.
 */

import { provider } from "@/lib/data/provider";
import type { MarketRegion } from "@/lib/data/types";

export interface ScanRow {
  symbol: string;
  name: string;
  region: MarketRegion;
  currency: "INR" | "USD";
  price: number;
  priceChgPct: number;
  /** Total option volume across the loaded chain. */
  volume: number;
  /** Net OI change as a % of total OI. */
  oiChgPct: number;
  netOIChange: number;
  callOIChg: number;
  putOIChg: number;
  pcr: number;
  iv: number;
  ivRank: number;
  ivPercentile: number;
  maxPain: number;
  expectedMovePct: number;
}

export function scanMarket(now = Date.now()): ScanRow[] {
  const out: ScanRow[] = [];
  for (const inst of provider.listInstruments(now)) {
    if (!inst.expiries[0]) continue;
    try {
      const s = provider.buildSnapshot(inst.symbol, inst.expiries[0], now);
      const a = s.analytics;
      const c = s.chain;
      const volume = c.rows.reduce((t, r) => t + r.call.volume + r.put.volume, 0);
      const oiTot = a.totalCallOI + a.totalPutOI;
      const netOIChange = a.totalCallOIChange + a.totalPutOIChange;
      out.push({
        symbol: inst.symbol,
        name: inst.name,
        region: inst.region,
        currency: inst.currency,
        price: c.spot,
        priceChgPct: c.spotChangePct,
        volume,
        oiChgPct: oiTot ? (netOIChange / oiTot) * 100 : 0,
        netOIChange,
        callOIChg: a.totalCallOIChange,
        putOIChg: a.totalPutOIChange,
        pcr: a.pcr,
        iv: a.atmIV,
        ivRank: a.ivRank,
        ivPercentile: a.ivPercentile,
        maxPain: a.maxPain,
        expectedMovePct: a.expectedMovePct,
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

export function topBy<T extends keyof ScanRow>(rows: ScanRow[], key: T, n = 5, dir: "desc" | "asc" = "desc"): ScanRow[] {
  return [...rows]
    .sort((a, b) => (dir === "desc" ? (b[key] as number) - (a[key] as number) : (a[key] as number) - (b[key] as number)))
    .slice(0, n);
}
