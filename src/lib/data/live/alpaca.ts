/**
 * Alpaca Broker API client.
 * Connects to the local server-side proxy /api/alpaca,
 * manages account details, active positions, and executes paper/live option orders.
 * Automatically falls back to a stateful simulated local ledger when offline or using dummy keys.
 */

export interface AlpacaAccount {
  id: string;
  accountNumber: string;
  status: string;
  currency: string;
  cash: number;
  buyingPower: number;
  portfolioValue: number;
  patternDayTrader: boolean;
  tradingBlocked: boolean;
  transfersBlocked: boolean;
  createdAt: string;
}

export interface AlpacaPosition {
  assetId: string;
  symbol: string; // e.g. "AAPL  260619C00180000" or "AAPL"
  exchange: string;
  assetClass: string;
  avgEntryPrice: number;
  qty: number;
  side: "long" | "short";
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  currentPrice: number;
  lastdayPrice: number;
  changeToday: number;
}

export interface AlpacaOrder {
  id: string;
  clientOrderId: string;
  createdAt: string;
  submittedAt: string;
  filledAt: string | null;
  expiredAt: string | null;
  canceledAt: string | null;
  assetId: string;
  symbol: string;
  assetClass: string;
  qty: string;
  filledQty: string;
  type: string;
  side: string;
  timeInForce: string;
  limitPrice: string | null;
  stopPrice: string | null;
  status: string;
}

/** Formats option leg components into the standard 21-character OSI format used by Alpaca. */
export function formatAlpacaOptionSymbol(
  underlying: string,
  expiryDate: string,
  right: "CE" | "PE" | "EQ",
  strike: number
): string {
  if (right === "EQ") return underlying.toUpperCase();

  const und = underlying.toUpperCase().padEnd(6, " ");
  
  // Format expiry to YYMMDD
  const parts = expiryDate.split("-");
  let yy = "";
  let mm = "";
  let dd = "";
  if (parts.length === 3) {
    yy = parts[0].slice(-2);
    mm = parts[1].padStart(2, "0");
    dd = parts[2].padStart(2, "0");
  } else {
    const d = new Date(expiryDate);
    yy = d.getFullYear().toString().slice(-2);
    mm = (d.getMonth() + 1).toString().padStart(2, "0");
    dd = d.getDate().toString().padStart(2, "0");
  }
  const exp = `${yy}${mm}${dd}`;
  const type = right === "CE" ? "C" : "P";
  const strikeVal = Math.round(strike * 1000);
  const strk = strikeVal.toString().padStart(8, "0");

  return `${und}${exp}${type}${strk}`;
}

class AlpacaClient {
  private apiKey: string = "";
  private apiSecret: string = "";
  private environment: "live" | "paper" = "paper";
  private isSimulated: boolean = true;

  setCredentials(key: string, secret: string, env: "live" | "paper") {
    this.apiKey = key;
    this.apiSecret = secret;
    this.environment = env;
    // If keys are blank or are explicit dummy mock keys, flag as simulated
    this.isSimulated = !key || !secret || key.startsWith("PK_DUMMY") || key.toLowerCase().includes("mock") || key.length < 12;
  }

  get isConnected() {
    return !!this.apiKey && !!this.apiSecret;
  }

  private async request(path: string, method: "GET" | "POST" = "GET", body?: any) {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error("Credentials not supplied");
    }
    const response = await fetch("/api/alpaca", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path,
        method,
        key: this.apiKey,
        secret: this.apiSecret,
        environment: this.environment,
        body,
      }),
    });
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.details || errData.error || "Alpaca API request failed");
    }
    return response.json();
  }

  async testConnection(): Promise<{ success: boolean; latencyMs: number; message: string }> {
    if (!this.apiKey || !this.apiSecret) {
      return { success: false, latencyMs: 0, message: "Credentials not supplied" };
    }
    const start = Date.now();
    if (this.isSimulated) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return {
        success: true,
        latencyMs: Date.now() - start,
        message: "Successfully connected to stateful local paper trading sandbox.",
      };
    }
    try {
      await this.request("/v2/account");
      return {
        success: true,
        latencyMs: Date.now() - start,
        message: `Successfully connected to Alpaca ${this.environment.toUpperCase()} account.`,
      };
    } catch (err: any) {
      return { success: false, latencyMs: 0, message: err.message || "Connection refused" };
    }
  }

  // --- Local state storage for simulated fallback ---
  private getLocalLedger() {
    if (typeof window === "undefined") return { cash: 100000, positions: [] };
    const saved = localStorage.getItem("alpaca_sandbox_ledger");
    if (saved) return JSON.parse(saved);

    const defaultLedger = {
      cash: 100000,
      positions: [
        {
          assetId: "b8c3-42e1",
          symbol: "AAPL",
          exchange: "NASDAQ",
          assetClass: "us_equity",
          avgEntryPrice: 175.40,
          qty: 50,
          side: "long" as const,
          marketValue: 9025.00,
          costBasis: 8770.00,
          unrealizedPnl: 255.00,
          unrealizedPnlPct: 2.91,
          currentPrice: 180.50,
          lastdayPrice: 179.80,
          changeToday: 0.39,
        }
      ]
    };
    localStorage.setItem("alpaca_sandbox_ledger", JSON.stringify(defaultLedger));
    return defaultLedger;
  }

  private saveLocalLedger(ledger: any) {
    if (typeof window !== "undefined") {
      localStorage.setItem("alpaca_sandbox_ledger", JSON.stringify(ledger));
    }
  }

  async getAccount(): Promise<AlpacaAccount> {
    if (this.isSimulated) {
      const ledger = this.getLocalLedger();
      const posValue = ledger.positions.reduce((acc: number, p: any) => acc + p.marketValue, 0);
      return {
        id: "sandbox-p1",
        accountNumber: "APCA-SANDBOX",
        status: "ACTIVE",
        currency: "USD",
        cash: ledger.cash,
        buyingPower: ledger.cash * 4,
        portfolioValue: ledger.cash + posValue,
        patternDayTrader: false,
        tradingBlocked: false,
        transfersBlocked: false,
        createdAt: new Date().toISOString(),
      };
    }
    try {
      const acc = await this.request("/v2/account");
      return {
        id: acc.id,
        accountNumber: acc.account_number,
        status: acc.status,
        currency: acc.currency,
        cash: Number(acc.cash),
        buyingPower: Number(acc.buying_power),
        portfolioValue: Number(acc.portfolio_value),
        patternDayTrader: acc.pattern_day_trader,
        tradingBlocked: acc.trading_blocked,
        transfersBlocked: acc.transfers_blocked,
        createdAt: acc.created_at,
      };
    } catch {
      // Fallback
      this.isSimulated = true;
      return this.getAccount();
    }
  }

  async getPositions(): Promise<AlpacaPosition[]> {
    if (this.isSimulated) {
      return this.getLocalLedger().positions;
    }
    try {
      const positions = await this.request("/v2/positions");
      return positions.map((p: any) => ({
        assetId: p.asset_id,
        symbol: p.symbol,
        exchange: p.exchange,
        assetClass: p.asset_class,
        avgEntryPrice: Number(p.avg_entry_price),
        qty: Math.abs(Number(p.qty)),
        side: Number(p.qty) >= 0 ? "long" : "short",
        marketValue: Number(p.market_value),
        costBasis: Number(p.cost_basis),
        unrealizedPnl: Number(p.unrealized_intraday_pl),
        unrealizedPnlPct: Number(p.unrealized_intraday_plpc) * 100,
        currentPrice: Number(p.current_price),
        lastdayPrice: Number(p.lastday_price),
        changeToday: Number(p.change_today),
      }));
    } catch {
      return this.getLocalLedger().positions;
    }
  }

  async placeOrder(order: {
    symbol: string;
    qty: number;
    side: "buy" | "sell";
    type: "market" | "limit";
    limitPrice?: number;
    timeInForce?: "day" | "gtc";
  }): Promise<AlpacaOrder> {
    if (this.isSimulated) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const ledger = this.getLocalLedger();
      const currentPrice = order.limitPrice || 100.0;
      const totalCost = currentPrice * order.qty * 100; // Options are 100 multiplier

      if (order.side === "buy" && ledger.cash < totalCost) {
        throw new Error("Insufficient cash for buying option contracts in sandbox");
      }

      // Execute transaction inside local simulation ledger
      if (order.side === "buy") {
        ledger.cash -= totalCost;
        const existing = ledger.positions.find((p: any) => p.symbol === order.symbol);
        if (existing) {
          const totalQty = existing.qty + order.qty;
          existing.avgEntryPrice = (existing.avgEntryPrice * existing.qty + currentPrice * order.qty) / totalQty;
          existing.qty = totalQty;
          existing.costBasis += totalCost;
          existing.marketValue = existing.qty * currentPrice * 100;
        } else {
          ledger.positions.push({
            assetId: `asset-${Date.now()}`,
            symbol: order.symbol,
            exchange: "OPRA",
            assetClass: "us_option",
            avgEntryPrice: currentPrice,
            qty: order.qty,
            side: "long",
            marketValue: totalCost,
            costBasis: totalCost,
            unrealizedPnl: 0,
            unrealizedPnlPct: 0,
            currentPrice: currentPrice,
            lastdayPrice: currentPrice,
            changeToday: 0,
          });
        }
      } else {
        // Sell
        const existing = ledger.positions.find((p: any) => p.symbol === order.symbol);
        if (existing) {
          if (existing.qty < order.qty) {
            // Naked short options
            existing.qty -= order.qty; // becomes negative or smaller
            ledger.cash += totalCost;
          } else {
            existing.qty -= order.qty;
            ledger.cash += totalCost;
            if (existing.qty === 0) {
              ledger.positions = ledger.positions.filter((p: any) => p.symbol !== order.symbol);
            }
          }
        } else {
          // Naked Sell
          ledger.cash += totalCost;
          ledger.positions.push({
            assetId: `asset-${Date.now()}`,
            symbol: order.symbol,
            exchange: "OPRA",
            assetClass: "us_option",
            avgEntryPrice: currentPrice,
            qty: order.qty,
            side: "short",
            marketValue: -totalCost,
            costBasis: -totalCost,
            unrealizedPnl: 0,
            unrealizedPnlPct: 0,
            currentPrice: currentPrice,
            lastdayPrice: currentPrice,
            changeToday: 0,
          });
        }
      }

      this.saveLocalLedger(ledger);

      return {
        id: `ord-${Date.now()}`,
        clientOrderId: `clord-${Date.now()}`,
        createdAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
        filledAt: new Date().toISOString(),
        expiredAt: null,
        canceledAt: null,
        assetId: `asset-${Date.now()}`,
        symbol: order.symbol,
        assetClass: "us_option",
        qty: order.qty.toString(),
        filledQty: order.qty.toString(),
        type: order.type,
        side: order.side,
        timeInForce: order.timeInForce || "day",
        limitPrice: order.limitPrice?.toString() || null,
        stopPrice: null,
        status: "filled",
      };
    }

    // Direct HTTP API execution via proxy
    const payload = {
      symbol: order.symbol,
      qty: order.qty.toString(),
      side: order.side,
      type: order.type,
      time_in_force: order.timeInForce || "day",
      ...(order.type === "limit" ? { limit_price: order.limitPrice?.toString() } : {}),
    };

    const res = await this.request("/v2/orders", "POST", payload);
    return {
      id: res.id,
      clientOrderId: res.client_order_id,
      createdAt: res.created_at,
      submittedAt: res.submitted_at,
      filledAt: res.filled_at || null,
      expiredAt: res.expired_at || null,
      canceledAt: res.canceled_at || null,
      assetId: res.asset_id,
      symbol: res.symbol,
      assetClass: res.asset_class,
      qty: res.qty,
      filledQty: res.filled_qty,
      type: res.type,
      side: res.side,
      timeInForce: res.time_in_force,
      limitPrice: res.limit_price || null,
      stopPrice: res.stop_price || null,
      status: res.status,
    };
  }

  // Fetch the latest stock price bar (from Alpaca Market Data API)
  async getLatestStockQuote(symbol: string): Promise<{ lastPrice: number }> {
    if (this.isSimulated) {
      return { lastPrice: 180.50 }; // default simulation price
    }
    try {
      // Use proxy to get latest bar of the symbol
      // This routes to data.alpaca.markets/v2/stocks/bars/latest?symbols=AAPL
      const res = await this.request(`/v2/stocks/bars/latest?symbols=${symbol}`);
      const bar = res.bars?.[symbol];
      if (bar && bar.c) {
        return { lastPrice: bar.c };
      }
      return { lastPrice: 180.50 };
    } catch {
      return { lastPrice: 180.50 };
    }
  }
}

export const alpaca = new AlpacaClient();
