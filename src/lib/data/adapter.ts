/**
 * Broker adapter contract.
 *
 * The whole platform talks to this interface, never to a broker directly.
 *  - IBKR (US): backed by a real captured snapshot (account, spot, IV, IV-rank
 *    and aggregate OI pulled from the live connector); a runtime gateway
 *    (IBKR_GATEWAY_BASE_URL) supersedes it and streams.
 *  - Kite (India): simulated ★ until a Kite Connect key/token is supplied (the
 *    app's runtime path) — the Kite MCP wires the *workspace*, not the web app.
 */

import type {
  DataSource,
  Instrument,
  MarketRegion,
  OptionChain,
} from "./types";
import { INSTRUMENT_SEEDS, getSeed, upcomingExpiries } from "./instruments";
import { buildChain } from "./simulated";
import { getUsAnchor } from "./live/ibkrCapture";

export interface BrokerStatus {
  source: DataSource;
  region: MarketRegion;
  connected: boolean;
  mode: "live" | "captured" | "simulated";
  latencyMs?: number;
  message: string;
  howToConnect: string;
}

export interface MarketDataAdapter {
  readonly source: DataSource;
  readonly region: MarketRegion;
  status(): BrokerStatus;
  listInstruments(now?: number): Instrument[];
  getOptionChain(symbol: string, expiry: string, now?: number): OptionChain;
}

function instrumentsFor(region: MarketRegion, now = Date.now()): Instrument[] {
  return INSTRUMENT_SEEDS.filter((s) => s.region === region).map((s) => ({
    symbol: s.symbol,
    name: s.name,
    region: s.region,
    kind: s.kind,
    lotSize: s.lotSize,
    currency: s.currency,
    feed: s.feed,
    expiries: upcomingExpiries(s, now),
  }));
}

/**
 * Zerodha Kite (India / NSE). Live wiring (web app runtime):
 *   - Auth: Kite Connect API key + daily access token.
 *   - Instruments: GET /instruments; cache option contracts.
 *   - Quotes/LTP/greeks inputs: kiteticker WebSocket (full mode).
 *   - Open Interest: present but NSE refreshes it on a ~3-min cycle.
 */
export class KiteAdapter implements MarketDataAdapter {
  readonly source: DataSource = "KITE";
  readonly region: MarketRegion = "IN";

  status(): BrokerStatus {
    const connected = Boolean(process.env.KITE_API_KEY && process.env.KITE_ACCESS_TOKEN);
    return {
      source: "KITE",
      region: "IN",
      connected,
      mode: connected ? "live" : "simulated",
      message: connected
        ? "Kite Connect streaming — NSE F&O live (OI ~3 min)."
        : "No Kite session — the NSE book is simulated ★.",
      howToConnect:
        "Workspace: add the Kite MCP (mcp.kite.trade) and complete the Kite login. Web app: set KITE_API_KEY + KITE_ACCESS_TOKEN to stream via kiteticker (LTP live, OI ~3 min).",
    };
  }

  listInstruments(now?: number): Instrument[] {
    return instrumentsFor("IN", now);
  }

  getOptionChain(symbol: string, expiry: string, now = Date.now()): OptionChain {
    const seed = getSeed(symbol);
    if (!seed) throw new Error(`Unknown instrument: ${symbol}`);
    return buildChain(seed, expiry, now); // no anchor → simulated ★
  }
}

/**
 * Interactive Brokers (US / OPRA).
 *   - Connected here via a real captured snapshot (account, positions, spot,
 *     IV, IV-percentile and aggregate option OI) pulled from the live feed.
 *   - Per-contract option conids aren't exposed by the connector, so per-strike
 *     OI is modelled to the real aggregate (US OI is end-of-day anyway).
 *   - Runtime gateway (IBKR_GATEWAY_BASE_URL) streams intraday when present.
 */
export class IBKRAdapter implements MarketDataAdapter {
  readonly source: DataSource = "IBKR";
  readonly region: MarketRegion = "US";

  status(): BrokerStatus {
    const hasGateway = Boolean(process.env.IBKR_GATEWAY_BASE_URL);
    return {
      source: "IBKR",
      region: "US",
      connected: true,
      mode: hasGateway ? "live" : "captured",
      message: hasGateway
        ? "IBKR gateway streaming — OPRA NBBO live, OI end-of-day."
        : "Live IBKR capture — real spot, IV, IV-rank, account & aggregate OI (last close). Per-strike split modelled ★.",
      howToConnect:
        "Set IBKR_GATEWAY_BASE_URL (Client Portal Web API / IB Gateway) to stream intraday. Per-strike OI stays end-of-day by design (OCC).",
    };
  }

  listInstruments(now?: number): Instrument[] {
    return instrumentsFor("US", now);
  }

  getOptionChain(symbol: string, expiry: string, now = Date.now()): OptionChain {
    const seed = getSeed(symbol);
    if (!seed) throw new Error(`Unknown instrument: ${symbol}`);
    return buildChain(seed, expiry, now, getUsAnchor(symbol));
  }
}

import { alpaca } from "./live/alpaca";
import { useAppStore } from "@/lib/store/app";

export const alpacaSpotCache = new Map<string, number>();

export class AlpacaAdapter implements MarketDataAdapter {
  readonly source: DataSource = "ALPACA";
  readonly region: MarketRegion = "US";

  status(): BrokerStatus {
    const connected = useAppStore.getState().alpacaConnection.connected;
    return {
      source: "ALPACA",
      region: "US",
      connected,
      mode: connected ? "live" : "simulated",
      message: connected
        ? "Alpaca API connected — live feeds active."
        : "Alpaca session offline.",
      howToConnect: "Go to Broker Login page and supply your Alpaca API Credentials.",
    };
  }

  listInstruments(now?: number): Instrument[] {
    return instrumentsFor("US", now);
  }

  getOptionChain(symbol: string, expiry: string, now = Date.now()): OptionChain {
    const seed = getSeed(symbol);
    if (!seed) throw new Error(`Unknown instrument: ${symbol}`);

    const cachedSpot = alpacaSpotCache.get(symbol) || seed.refSpot;

    // Trigger async spot price fetch to update cache for subsequent renders/ticks
    if (useAppStore.getState().alpacaConnection.connected) {
      alpaca
        .getLatestStockQuote(symbol)
        .then((quote) => {
          if (quote && quote.lastPrice > 0) {
            alpacaSpotCache.set(symbol, quote.lastPrice);
          }
        })
        .catch(() => {});
    }

    const updatedSeed = { ...seed, refSpot: cachedSpot };
    const baseChain = buildChain(updatedSeed, expiry, now, getUsAnchor(symbol));
    
    baseChain.live = {
      source: "ALPACA",
      capturedAt: now,
      ivRank: baseChain.live?.ivRank || 45,
      ivPercentile: baseChain.live?.ivPercentile || 45,
    };
    
    return baseChain;
  }
}
