"use client";

import { useMemo } from "react";
import { provider } from "@/lib/data/provider";
import { useMarket } from "@/components/providers/market";
import { useNow } from "@/lib/hooks/useNow";
import { formatAge } from "@/lib/data/freshness";
import { cn, num, pct } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";
import { InstrumentPicker } from "./InstrumentPicker";
import { ThemeToggle } from "./ThemeToggle";
import { BrandMark } from "./BrandMark";

import { useAppStore } from "@/lib/store/app";
import Link from "next/link";

export function Topbar() {
  const { snapshot, lastUpdated } = useMarket();
  const now = useNow(1000);
  const brokerConnections = useAppStore((s) => s.brokerConnections);
  const chain = snapshot?.chain;
  const up = (chain?.spotChange ?? 0) >= 0;

  // Find user-connected brokers
  const connectedBrokers = useMemo(() => {
    return Object.values(brokerConnections).filter((b) => b.connected);
  }, [brokerConnections]);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg-elev/90 px-3 backdrop-blur lg:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="md:hidden">
          <BrandMark size={26} withWordmark={false} />
        </div>
        <InstrumentPicker />
        {chain ? (
          <div className="hidden items-baseline gap-2 sm:flex">
            <span className="tnum text-[15px] font-bold text-fg">
              {chain.spot.toLocaleString(undefined, { maximumFractionDigits: chain.spot > 1000 ? 0 : 2 })}
            </span>
            <span className={cn("tnum text-xs font-semibold", up ? "text-call" : "text-put")}>
              {up ? "+" : ""}
              {num(chain.spotChange, chain.spot > 1000 ? 0 : 2)} ({pct(chain.spotChangePct)})
            </span>
            {chain.freshness.spot?.simulated ? (
              <span className="chip bg-sim/15 text-sim">
                <Icon name="star" size={9} strokeWidth={2.5} /> SIM
              </span>
            ) : useAppStore.getState().alpacaConnection.connected && chain.instrument.region === "US" ? (
              <span className="chip bg-call/15 text-call font-bold">
                <Icon name="refresh" size={9} strokeWidth={2.5} className="animate-spin" /> ALPACA LIVE
              </span>
            ) : chain.freshness.spot?.captured ? (
              <span className="chip bg-info/15 text-info">
                <Icon name="clock" size={9} strokeWidth={2.5} /> IBKR
              </span>
            ) : null}
          </div>
        ) : (
          <div className="h-5 w-28 animate-pulse-soft rounded bg-bg-sunken" />
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-1.5 md:flex">
          {connectedBrokers.length === 0 ? (
            <Link
              href="/broker-login"
              className="inline-flex items-center gap-1.5 rounded-lg border border-warn/30 bg-warn/10 px-2.5 py-1 text-2xs font-semibold text-warn hover:bg-warn/15 transition-colors"
            >
              <Icon name="wallet" size={10} />
              No Brokers Connected
            </Link>
          ) : (
            connectedBrokers.map((b) => {
              const alpacaConnection = useAppStore.getState().alpacaConnection;
              const latencyText = b.id === "alpaca" && alpacaConnection.connected ? ` · ${alpacaConnection.latencyMs}ms` : "";
              return (
                <span
                  key={b.id}
                  title={`${b.name} Session: ${b.username}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-call/30 bg-call/10 px-2 py-1 text-2xs font-medium text-call"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-call animate-pulse-soft" />
                  <span className="font-bold uppercase text-[9px]">{b.id}</span>
                  <span className="opacity-75">{b.mode === "live" ? "LIVE" : "SANDBOX"}{latencyText}</span>
                </span>
              );
            })
          )}
        </div>

        <span className="hidden items-center gap-1.5 rounded-lg border border-border bg-panel px-2 py-1 text-2xs text-fg-muted lg:inline-flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-brand opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
          </span>
          {lastUpdated ? formatAge(lastUpdated, now) : "connecting…"}
        </span>

        <ThemeToggle />
      </div>
    </header>
  );
}
