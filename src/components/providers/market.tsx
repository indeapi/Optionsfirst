"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useMarketData, type MarketView } from "@/lib/hooks/useMarketData";
import { useAppStore } from "@/lib/store/app";

const MarketCtx = createContext<MarketView | null>(null);

/** Runs the single market-refresh loop and shares it with the whole app. */
export function MarketProvider({ children }: { children: ReactNode }) {
  const symbol = useAppStore((s) => s.symbol);
  const expiry = useAppStore((s) => s.expiry);
  const refreshMs = useAppStore((s) => s.refreshMs);
  const view = useMarketData(symbol, expiry, refreshMs);
  return <MarketCtx.Provider value={view}>{children}</MarketCtx.Provider>;
}

export function useMarket(): MarketView {
  const v = useContext(MarketCtx);
  if (!v) throw new Error("useMarket must be used within MarketProvider");
  return v;
}
