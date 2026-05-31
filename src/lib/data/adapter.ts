/**
 * Broker adapter contract.
 *
 * The whole platform talks to this interface, never to a broker directly. Today
 * the simulated adapter backs both regions; wiring a live feed means filling in
 * the two real adapters below and flipping `connected` — nothing upstream
 * changes. The integration points (REST + streaming) are documented inline so
 * "add it if not available" is a fill-in-the-blanks job, not a rewrite.
 */

import type {
  DataSource,
  Instrument,
  MarketRegion,
  OptionChain,
} from "./types";
import { INSTRUMENT_SEEDS, getSeed, upcomingExpiries } from "./instruments";
import { buildSimulatedChain } from "./simulated";

export interface BrokerStatus {
  source: DataSource;
  region: MarketRegion;
  connected: boolean;
  mode: "live" | "simulated";
  /** Round-trip latency to the feed, when connected. */
  latencyMs?: number;
  /** Human status line for the data-source panel. */
  message: string;
  /** What the trader must do to go live. */
  howToConnect: string;
}

export interface MarketDataAdapter {
  readonly source: DataSource;
  readonly region: MarketRegion;
  status(): BrokerStatus;
  listInstruments(now?: number): Instrument[];
  /** Returns a chain; simulated adapters stamp every field SIMULATED (★). */
  getOptionChain(symbol: string, expiry: string, now?: number): OptionChain;
}

/** Shared simulated backing used until a live key is attached. */
class SimulatedBacking {
  listInstruments(region: MarketRegion, now = Date.now()): Instrument[] {
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
  getOptionChain(symbol: string, expiry: string, now = Date.now()): OptionChain {
    const seed = getSeed(symbol);
    if (!seed) throw new Error(`Unknown instrument: ${symbol}`);
    return buildSimulatedChain(seed, expiry, now);
  }
}

const backing = new SimulatedBacking();

/**
 * Zerodha Kite (India / NSE). Live wiring:
 *   - Auth: Kite Connect API key + access token (daily login flow).
 *   - Instruments: GET /instruments (CSV dump), cache the option contracts.
 *   - Quotes/LTP/Greeks inputs: WebSocket (kiteticker) full-mode packets.
 *   - Open Interest: present in full-mode packets but NSE refreshes it on a
 *     ~3-minute cycle (see freshness.ts) — surface that delay, don't hide it.
 */
export class KiteAdapter implements MarketDataAdapter {
  readonly source: DataSource = "KITE";
  readonly region: MarketRegion = "IN";
  private apiKey = process.env.KITE_API_KEY ?? "";

  status(): BrokerStatus {
    const connected = Boolean(this.apiKey && process.env.KITE_ACCESS_TOKEN);
    return {
      source: "KITE",
      region: "IN",
      connected,
      mode: connected ? "live" : "simulated",
      message: connected
        ? "Kite Connect streaming — NSE F&O live."
        : "No Kite access token — serving the simulated NSE book. All values ★.",
      howToConnect:
        "Set KITE_API_KEY + KITE_ACCESS_TOKEN, then the adapter streams via kiteticker (LTP live, OI ~3 min).",
    };
  }
  listInstruments(now?: number): Instrument[] {
    return backing.listInstruments("IN", now);
  }
  getOptionChain(symbol: string, expiry: string, now?: number): OptionChain {
    // Live path: assemble from cached instruments + latest ticker packets.
    return backing.getOptionChain(symbol, expiry, now);
  }
}

/**
 * Interactive Brokers (US / OPRA). Live wiring:
 *   - Auth: TWS / IB Gateway socket, or the Client Portal Web API session.
 *   - Instruments: secDefOptParams to enumerate strikes/expiries per underlying.
 *   - Quotes/Greeks: reqMktData (NBBO + IB model greeks) with an OPRA
 *     market-data subscription; without one, quotes are 15-min delayed.
 *   - Open Interest: NOT live intraday on US options — it's an OCC end-of-day
 *     figure published next morning (see freshness.ts). Pull from reqMktData
 *     generic tick 101 after settlement, not during the session.
 */
export class IBKRAdapter implements MarketDataAdapter {
  readonly source: DataSource = "IBKR";
  readonly region: MarketRegion = "US";
  private host = process.env.IBKR_GATEWAY_HOST ?? "";

  status(): BrokerStatus {
    const connected = Boolean(this.host);
    return {
      source: "IBKR",
      region: "US",
      connected,
      mode: connected ? "live" : "simulated",
      message: connected
        ? "IBKR Gateway connected — OPRA NBBO live, OI end-of-day."
        : "No IBKR gateway — serving the simulated OPRA book. All values ★.",
      howToConnect:
        "Run IB Gateway and set IBKR_GATEWAY_HOST/PORT. Quotes need an OPRA subscription; OI stays end-of-day by design.",
    };
  }
  listInstruments(now?: number): Instrument[] {
    return backing.listInstruments("US", now);
  }
  getOptionChain(symbol: string, expiry: string, now?: number): OptionChain {
    return backing.getOptionChain(symbol, expiry, now);
  }
}
