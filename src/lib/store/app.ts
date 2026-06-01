import { create } from "zustand";
import type { Leg } from "@/lib/quant/payoff";
import type { LivePosition } from "@/lib/agents/monitor";

export interface BrokerConnection {
  id: string;
  name: string;
  connected: boolean;
  username?: string;
  accountNo?: string;
  buyingPower: number;
  netLiq: number;
  mode: "live" | "sim";
  region: "US" | "IN";
}

interface AppState {
  symbol: string;
  /** null → the data hook auto-selects the nearest expiry. */
  expiry: string | null;
  refreshMs: number;
  
  // Strategy Builder Selected Legs
  builderLegs: Leg[];
  
  // Broker Connections
  brokerConnections: Record<string, BrokerConnection>;
  
  // Virtual positions executed by user in the Strategy Builder
  virtualHoldings: LivePosition[];

  // Alpaca Integration
  alpacaCredentials: { key: string; secret: string; environment: "live" | "paper" } | null;
  alpacaConnection: { connected: boolean; latencyMs: number };
  
  // Slide Drawer Active Order Leg
  activeDraftOrder: Leg | null;

  // Closed trades list for Journaling
  closedTrades: any[];
  
  setSymbol: (s: string) => void;
  setExpiry: (e: string | null) => void;
  setRefreshMs: (n: number) => void;
  
  // Builder actions
  setBuilderLegs: (legs: Leg[]) => void;
  toggleBuilderLeg: (leg: Leg) => void;
  clearBuilderLegs: () => void;
  
  // Broker actions
  connectBroker: (id: string, username: string, mode: "live" | "sim") => void;
  disconnectBroker: (id: string) => void;

  // Alpaca Actions
  setAlpacaCredentials: (creds: { key: string; secret: string; environment: "live" | "paper" } | null) => void;
  setAlpacaConnection: (conn: { connected: boolean; latencyMs: number }) => void;
  
  // Draft Order Actions
  setActiveDraftOrder: (order: Leg | null) => void;
  
  // Closed trades actions
  addClosedTrade: (trade: any) => void;
  
  // Virtual positions actions
  addVirtualPosition: (pos: LivePosition) => void;
  clearVirtualPositions: () => void;
}

const DEFAULT_BROKERS: Record<string, BrokerConnection> = {
  alpaca: { id: "alpaca", name: "Alpaca Broker API", connected: false, buyingPower: 171402, netLiq: 56900, mode: "sim", region: "US" },
  ibkr: { id: "ibkr", name: "Interactive Brokers", connected: false, buyingPower: 85000, netLiq: 124000, mode: "sim", region: "US" },
  schwab: { id: "schwab", name: "Charles Schwab", connected: false, buyingPower: 50000, netLiq: 72000, mode: "sim", region: "US" },
  robinhood: { id: "robinhood", name: "Robinhood", connected: false, buyingPower: 12000, netLiq: 18500, mode: "sim", region: "US" },
  webull: { id: "webull", name: "Webull", connected: false, buyingPower: 25000, netLiq: 38000, mode: "sim", region: "US" },
  saxo: { id: "saxo", name: "Saxo Bank", connected: false, buyingPower: 95000, netLiq: 150000, mode: "sim", region: "US" },
  tradestation: { id: "tradestation", name: "TradeStation", connected: false, buyingPower: 40000, netLiq: 60000, mode: "sim", region: "US" },
  kite: { id: "kite", name: "Zerodha Kite", connected: false, buyingPower: 350000, netLiq: 500000, mode: "sim", region: "IN" },
};

export const useAppStore = create<AppState>((set) => ({
  symbol: "AAPL",
  expiry: null,
  refreshMs: 4000,
  builderLegs: [],
  brokerConnections: DEFAULT_BROKERS,
  virtualHoldings: [],
  alpacaCredentials: null,
  alpacaConnection: { connected: false, latencyMs: 0 },
  activeDraftOrder: null,
  closedTrades: [],
  
  setSymbol: (symbol) => set({ symbol, expiry: null }),
  setExpiry: (expiry) => set({ expiry }),
  setRefreshMs: (refreshMs) => set({ refreshMs }),
  
  setBuilderLegs: (builderLegs) => set({ builderLegs }),
  toggleBuilderLeg: (leg) =>
    set((state) => {
      const exists = state.builderLegs.some(
        (l) => l.strike === leg.strike && l.right === leg.right && l.action === leg.action
      );
      if (exists) {
        return {
          builderLegs: state.builderLegs.filter(
            (l) => !(l.strike === leg.strike && l.right === leg.right && l.action === leg.action)
          ),
        };
      } else {
        return { builderLegs: [...state.builderLegs, leg] };
      }
    }),
  clearBuilderLegs: () => set({ builderLegs: [] }),
  
  connectBroker: (id, username, mode) =>
    set((state) => {
      const broker = state.brokerConnections[id];
      if (!broker) return {};
      const prefix = broker.region === "US" ? "U" : "";
      const accountNo = `${prefix}${Math.floor(1000000 + Math.random() * 9000000)}`;
      return {
        brokerConnections: {
          ...state.brokerConnections,
          [id]: {
            ...broker,
            connected: true,
            username,
            accountNo,
            mode,
          },
        },
      };
    }),
  disconnectBroker: (id) =>
    set((state) => {
      const broker = state.brokerConnections[id];
      if (!broker) return {};
      return {
        brokerConnections: {
          ...state.brokerConnections,
          [id]: {
            ...broker,
            connected: false,
            username: undefined,
            accountNo: undefined,
          },
        },
      };
    }),

  setAlpacaCredentials: (alpacaCredentials) => set({ alpacaCredentials }),
  setAlpacaConnection: (alpacaConnection) => set({ alpacaConnection }),
  setActiveDraftOrder: (activeDraftOrder) => set({ activeDraftOrder }),
  addClosedTrade: (trade) => set((s) => ({ closedTrades: [trade, ...s.closedTrades] })),
  
  addVirtualPosition: (pos) =>
    set((state) => ({
      virtualHoldings: [pos, ...state.virtualHoldings],
    })),
  clearVirtualPositions: () => set({ virtualHoldings: [] }),
}));
