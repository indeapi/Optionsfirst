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
  AlpacaAdapter,
  type BrokerStatus,
  type MarketDataAdapter,
} from "./adapter";
import { useAppStore } from "@/lib/store/app";

export interface MarketSnapshot {
  chain: OptionChain;
  analytics: ChainAnalytics;
  condition: MarketCondition;
  ranked: RankedStrategy[];
  dte: number;
  builtAt: number;
}

class MarketDataProvider {
  private inAdapter = new KiteAdapter();
  private usIbkrAdapter = new IBKRAdapter();
  private usAlpacaAdapter = new AlpacaAdapter();

  private getAdapter(region: MarketRegion): MarketDataAdapter {
    if (region === "IN") return this.inAdapter;
    const useAlpaca = useAppStore.getState().alpacaConnection.connected;
    return useAlpaca ? this.usAlpacaAdapter : this.usIbkrAdapter;
  }

  brokerStatuses(): BrokerStatus[] {
    const useAlpaca = useAppStore.getState().alpacaConnection.connected;
    return [
      this.inAdapter.status(),
      useAlpaca ? this.usAlpacaAdapter.status() : this.usIbkrAdapter.status(),
    ];
  }

  listInstruments(now = Date.now()): Instrument[] {
    const useAlpaca = useAppStore.getState().alpacaConnection.connected;
    return [
      ...this.inAdapter.listInstruments(now),
      ...(useAlpaca ? this.usAlpacaAdapter.listInstruments(now) : this.usIbkrAdapter.listInstruments(now)),
    ];
  }

  private regionOf(symbol: string, now: number): MarketRegion {
    const inHit = this.inAdapter
      .listInstruments(now)
      .some((i) => i.symbol === symbol);
    return inHit ? "IN" : "US";
  }

  getInstrument(symbol: string, now = Date.now()): Instrument | undefined {
    return this.listInstruments(now).find((i) => i.symbol === symbol);
  }

  buildSnapshot(symbol: string, expiry: string, now = Date.now()): MarketSnapshot {
    const region = this.regionOf(symbol, now);
    const adapter = this.getAdapter(region);
    const chain = adapter.getOptionChain(symbol, expiry, now);
    const analytics = analyzeChain(chain);
    const dte = daysToExpiry(expiry, now);
    const condition = inferMarketCondition(chain, analytics, dte);
    const ranked = rankStrategies(chain, analytics, condition, { limit: 10 });
    return { chain, analytics, condition, ranked, dte, builtAt: now };
  }
}

export const provider = new MarketDataProvider();
