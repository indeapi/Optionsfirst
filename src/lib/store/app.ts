"use client";

import { create } from "zustand";

interface AppState {
  symbol: string;
  /** null → the data hook auto-selects the nearest expiry. */
  expiry: string | null;
  refreshMs: number;
  setSymbol: (s: string) => void;
  setExpiry: (e: string | null) => void;
  setRefreshMs: (n: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  symbol: "NIFTY",
  expiry: null,
  refreshMs: 4000,
  setSymbol: (symbol) => set({ symbol, expiry: null }),
  setExpiry: (expiry) => set({ expiry }),
  setRefreshMs: (refreshMs) => set({ refreshMs }),
}));
