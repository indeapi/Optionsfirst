/**
 * Market data provider — the one entry point the UI consumes. It routes a
 * symbol to the right broker adapter, assembles the chain, then layers the
 * quant analytics, the inferred market condition and the ranked strategies so a
 * page can render an entire view from a single snapshot object.
 */

import type {
  ChainAnalytics,
  Instrument,
  MarketCondition,
  MarketRegion,
  OptionChain,
} from "./types";
import { analyzeChain, inferMarketCondition } from "@/lib/quant/oiAnalytics";
import { rankStrategies, type RankedStrategy } from "@/lib/quant/strategyRanker";
import { daysToExpiry } from "./instruments";
import {
  IBKRAdapter,
  KiteAdapter,
  type BrokerStatus,
  type MarketDataAdapter,
} from "./adapter";

export interface MarketSnapshot {
  chain: OptionChain;
  analytics: ChainAnalytics;
  condition: MarketCondition;
  ranked: RankedStrategy[];
  dte: number;
  builtAt: number;
}

class MarketDataProvider {
  private adapters: Record<MarketRegion, MarketDataAdapter> = {
    IN: new KiteAdapter(),
    US: new IBKRAdapter(),
  };

  brokerStatuses(): BrokerStatus[] {
    return [this.adapters.IN.status(), this.adapters.US.status()];
  }

  listInstruments(now = Date.now()): Instrument[] {
    return [
      ...this.adapters.IN.listInstruments(now),
      ...this.adapters.US.listInstruments(now),
    ];
  }

  private regionOf(symbol: string, now: number): MarketRegion {
    const inHit = this.adapters.IN
      .listInstruments(now)
      .some((i) => i.symbol === symbol);
    return inHit ? "IN" : "US";
  }

  getInstrument(symbol: string, now = Date.now()): Instrument | undefined {
    return this.listInstruments(now).find((i) => i.symbol === symbol);
  }

  buildSnapshot(symbol: string, expiry: string, now = Date.now()): MarketSnapshot {
    const region = this.regionOf(symbol, now);
    const chain = this.adapters[region].getOptionChain(symbol, expiry, now);
    const analytics = analyzeChain(chain);
    const dte = daysToExpiry(expiry, now);
    const condition = inferMarketCondition(chain, analytics, dte);
    const ranked = rankStrategies(chain, analytics, condition, { limit: 10 });
    return { chain, analytics, condition, ranked, dte, builtAt: now };
  }
}

export const provider = new MarketDataProvider();
