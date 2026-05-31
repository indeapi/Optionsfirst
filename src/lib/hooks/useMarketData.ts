"use client";

import { useEffect, useRef, useState } from "react";
import { provider, type MarketSnapshot } from "@/lib/data/provider";
import { remittanceAlerts, type RemittanceAlert } from "@/lib/agents/fx";
import { runHermes, type AgentRunResult } from "@/lib/agents/orchestrator";
import {
  buildSamplePositions,
  markToMarket,
  type LivePosition,
  type PositionMark,
} from "@/lib/agents/monitor";

export interface MarketView {
  snapshot: MarketSnapshot | null;
  agents: AgentRunResult | null;
  marks: PositionMark[];
  remittance: RemittanceAlert[];
  expiry: string | null;
  lastUpdated: number | null;
  loading: boolean;
}

const EMPTY: MarketView = {
  snapshot: null,
  agents: null,
  marks: [],
  remittance: [],
  expiry: null,
  lastUpdated: null,
  loading: true,
};

/**
 * Builds (and keeps refreshing) the full market view for a symbol/expiry:
 * snapshot → FX → live-position marks → Hermes run. Sample positions are
 * generated once per symbol+expiry so Nike's P&L evolves with each tick.
 */
export function useMarketData(
  symbol: string,
  expiry: string | null,
  refreshMs = 4000,
): MarketView {
  const [view, setView] = useState<MarketView>(EMPTY);
  const posRef = useRef<{ key: string; positions: LivePosition[] }>({
    key: "",
    positions: [],
  });

  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      const now = Date.now();
      const inst = provider.getInstrument(symbol, now);
      if (!inst || inst.expiries.length === 0) return;
      const exp =
        expiry && inst.expiries.includes(expiry) ? expiry : inst.expiries[0];
      const snapshot = provider.buildSnapshot(symbol, exp, now);

      const key = `${symbol}:${exp}`;
      if (posRef.current.key !== key) {
        posRef.current = { key, positions: buildSamplePositions(snapshot.chain) };
      }
      const marks: PositionMark[] = posRef.current.positions.map((p) =>
        markToMarket(p, snapshot.chain),
      );
      const remittance = remittanceAlerts(now);
      const agents = runHermes(snapshot, { remittance, marks });

      if (!cancelled) {
        setView({
          snapshot,
          agents,
          marks,
          remittance,
          expiry: exp,
          lastUpdated: now,
          loading: false,
        });
      }
    };

    setView((v) => ({ ...v, loading: true }));
    tick();
    const id = setInterval(tick, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol, expiry, refreshMs]);

  return view;
}
