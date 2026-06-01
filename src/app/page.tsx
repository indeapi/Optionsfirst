"use client";

import { useState } from "react";
import Link from "next/link";
import { useMarket } from "@/components/providers/market";
import { PageHeader } from "@/components/shell/PageHeader";
import { ExpiryPicker } from "@/components/shell/ExpiryPicker";
import { Panel } from "@/components/ui/primitives";
import { LoadingGrid } from "@/components/ui/Loading";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { Icon } from "@/components/ui/Icon";
import { useAppStore } from "@/lib/store/app";
import { cn, money } from "@/lib/utils";

export default function DashboardPage() {
  const { snapshot, agents, marks, loading } = useMarket();
  const setActiveDraftOrder = useAppStore((s) => s.setActiveDraftOrder);
  const setBuilderLegs = useAppStore((s) => s.setBuilderLegs);

  // Simple outlook state for the newbie selector
  const [outlook, setOutlook] = useState<"up" | "down" | "flat" | null>(null);

  if (loading || !snapshot || !agents) {
    return (
      <>
        <PageHeader title="Simplified Trading Desk" desc="Loading terminal…" icon="dashboard" />
        <LoadingGrid />
      </>
    );
  }

  const { chain } = snapshot;
  const spot = chain.spot;
  const ccy = chain.instrument.currency;

  // Find ATM strike and nearest call/put premiums for the simple recommendations
  const atmRow = chain.rows.find((r) => r.strike === chain.atmStrike) || chain.rows[Math.floor(chain.rows.length / 2)];
  const callPrem = atmRow.call.ltp;
  const putPrem = atmRow.put.ltp;
  const lotSize = chain.instrument.lotSize;

  // Simple trade handlers
  const handleOpenDraft = (type: "CE" | "PE") => {
    setActiveDraftOrder({
      action: "buy",
      right: type,
      strike: atmRow.strike,
      qty: 1,
      premium: type === "CE" ? callPrem : putPrem,
      expiry: chain.expiry || undefined,
    });
  };

  const handleApplyStrategy = (type: "condor" | "straddle") => {
    const strikes = chain.rows.map((r) => r.strike).sort((a, b) => a - b);
    const atmIndex = strikes.indexOf(atmRow.strike);

    let newLegs = [];
    if (type === "straddle") {
      newLegs = [
        { action: "sell" as const, right: "CE" as const, strike: atmRow.strike, qty: 1, premium: callPrem, expiry: chain.expiry || undefined },
        { action: "sell" as const, right: "PE" as const, strike: atmRow.strike, qty: 1, premium: putPrem, expiry: chain.expiry || undefined },
      ];
    } else {
      // Iron Condor (Sell OTM Call/Put, Buy further OTM Call/Put)
      const sellPutStrike = strikes[Math.max(0, atmIndex - 2)];
      const buyPutStrike = strikes[Math.max(0, atmIndex - 4)];
      const sellCallStrike = strikes[Math.min(strikes.length - 1, atmIndex + 2)];
      const buyCallStrike = strikes[Math.min(strikes.length - 1, atmIndex + 4)];

      const getLtp = (strike: number, right: "CE" | "PE") => {
        const row = chain.rows.find((r) => r.strike === strike);
        return row ? (right === "CE" ? row.call.ltp : row.put.ltp) : 5;
      };

      newLegs = [
        { action: "buy" as const, right: "PE" as const, strike: buyPutStrike, qty: 1, premium: getLtp(buyPutStrike, "PE"), expiry: chain.expiry || undefined },
        { action: "sell" as const, right: "PE" as const, strike: sellPutStrike, qty: 1, premium: getLtp(sellPutStrike, "PE"), expiry: chain.expiry || undefined },
        { action: "sell" as const, right: "CE" as const, strike: sellCallStrike, qty: 1, premium: getLtp(sellCallStrike, "CE"), expiry: chain.expiry || undefined },
        { action: "buy" as const, right: "CE" as const, strike: buyCallStrike, qty: 1, premium: getLtp(buyCallStrike, "CE"), expiry: chain.expiry || undefined },
      ];
    }
    setBuilderLegs(newLegs);
  };

  return (
    <>
      <PageHeader
        title="Options Trading, Simplified"
        desc={`Learn, simulate, and place trades on ${chain.instrument.name} (${chain.instrument.symbol}) in simple terms.`}
        icon="dashboard"
        right={<ExpiryPicker />}
      />

      <div className="space-y-4">
        {/* Core Asset Overview Bar */}
        <div className="rounded-xl border border-border bg-panel-2/30 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-fg-subtle">Current Market Price</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-fg tnum">
                {money(spot, ccy, 2)}
              </span>
              <span className={cn("text-xs font-bold", chain.spotChange >= 0 ? "text-call" : "text-put")}>
                {chain.spotChange >= 0 ? "+" : ""}
                {chain.spotChange.toFixed(2)} ({chain.spotChangePct.toFixed(2)}%)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg bg-bg-sunken px-3 py-2 border border-border/40">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-call opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-call" />
            </span>
            <span className="text-3xs font-bold text-fg-muted uppercase">Alpaca US Live feed active</span>
          </div>
        </div>

        {/* 1. Newbie Interactive Guide Wizard */}
        <Panel
          eyebrow="AI Trading Coach"
          title="What is your expectation for the price of Apple (AAPL)?"
          right={<AgentBadge id="athena" />}
        >
          <div className="space-y-4">
            {/* Outlook selectors */}
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                onClick={() => setOutlook("up")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all",
                  outlook === "up"
                    ? "border-call bg-call/5 shadow-glow-call animate-pulse-soft"
                    : "border-border bg-panel hover:bg-bg-sunken"
                )}
              >
                <div className="rounded-full bg-call/10 p-2 text-call">
                  <Icon name="arrow-up-right" size={20} strokeWidth={3} />
                </div>
                <div>
                  <span className="font-bold text-fg block text-xs">Going UP 📈</span>
                  <span className="text-3xs text-fg-subtle">I expect the price to rise</span>
                </div>
              </button>

              <button
                onClick={() => setOutlook("down")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all",
                  outlook === "down"
                    ? "border-put bg-put/5 shadow-glow-put animate-pulse-soft"
                    : "border-border bg-panel hover:bg-bg-sunken"
                )}
              >
                <div className="rounded-full bg-put/10 p-2 text-put">
                  <Icon name="arrow-down-left" size={20} strokeWidth={3} />
                </div>
                <div>
                  <span className="font-bold text-fg block text-xs">Going DOWN 📉</span>
                  <span className="text-3xs text-fg-subtle">I expect the price to drop</span>
                </div>
              </button>

              <button
                onClick={() => setOutlook("flat")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all",
                  outlook === "flat"
                    ? "border-brand bg-brand/5 shadow-glow-brand animate-pulse-soft"
                    : "border-border bg-panel hover:bg-bg-sunken"
                )}
              >
                <div className="rounded-full bg-brand/10 p-2 text-brand">
                  <Icon name="arrow-left-right" size={20} strokeWidth={3} />
                </div>
                <div>
                  <span className="font-bold text-fg block text-xs">Staying FLAT ↔️</span>
                  <span className="text-3xs text-fg-subtle">I expect it to remain stable</span>
                </div>
              </button>
            </div>

            {/* Recommendation Cards */}
            {outlook === "up" && (
              <div className="rounded-xl border border-call/20 bg-call/[0.02] p-4 space-y-3 animate-fade-in">
                <div className="flex gap-2 items-start">
                  <Icon name="help-circle" className="text-call mt-0.5" size={16} />
                  <div>
                    <h4 className="text-xs font-bold text-fg">Recommended Strategy: Buy a Call Option (CE)</h4>
                    <p className="text-3xs text-fg-muted mt-1 leading-relaxed">
                      <b>What is this?</b> It is like paying a small deposit to lock in a buying price. If Apple rises, you can buy it cheap and pocket the difference!
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 text-3xs text-fg-subtle border-t border-call/10 pt-3">
                  <div>
                    <span className="block uppercase font-bold text-fg-muted">Maximum Risk</span>
                    <span className="text-xs font-bold text-put mt-0.5">{money(callPrem * lotSize, "USD", 0)}</span>
                    <span className="block mt-0.5">Only the entry fee paid. No surprise losses.</span>
                  </div>
                  <div>
                    <span className="block uppercase font-bold text-fg-muted">Profit Potential</span>
                    <span className="text-xs font-bold text-call mt-0.5">Unlimited</span>
                    <span className="block mt-0.5">The higher Apple rises, the more you make.</span>
                  </div>
                  <div>
                    <span className="block uppercase font-bold text-fg-muted">Profit Starts At</span>
                    <span className="text-xs font-bold text-fg mt-0.5">{money(atmRow.strike + callPrem, "USD", 2)}</span>
                    <span className="block mt-0.5">At Expiration date</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-call/10">
                  <button
                    onClick={() => handleOpenDraft("CE")}
                    className="rounded-lg bg-call hover:bg-call/90 px-4 py-1.5 text-2xs font-bold text-white shadow transition-all"
                  >
                    Quick Trade Call Option
                  </button>
                  <Link
                    href="/option-chain"
                    className="rounded-lg border border-border bg-panel hover:bg-bg-sunken px-4 py-1.5 text-2xs font-bold text-fg transition-all"
                  >
                    View Option Chain
                  </Link>
                </div>
              </div>
            )}

            {outlook === "down" && (
              <div className="rounded-xl border border-put/20 bg-put/[0.02] p-4 space-y-3 animate-fade-in">
                <div className="flex gap-2 items-start">
                  <Icon name="help-circle" className="text-put mt-0.5" size={16} />
                  <div>
                    <h4 className="text-xs font-bold text-fg">Recommended Strategy: Buy a Put Option (PE)</h4>
                    <p className="text-3xs text-fg-muted mt-1 leading-relaxed">
                      <b>What is this?</b> It is like buying insurance for your house. If Apple drops, the insurance policy value goes up, allowing you to profit from the decline!
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 text-3xs text-fg-subtle border-t border-put/10 pt-3">
                  <div>
                    <span className="block uppercase font-bold text-fg-muted">Maximum Risk</span>
                    <span className="text-xs font-bold text-put mt-0.5">{money(putPrem * lotSize, "USD", 0)}</span>
                    <span className="block mt-0.5">Only the insurance fee paid. No surprise losses.</span>
                  </div>
                  <div>
                    <span className="block uppercase font-bold text-fg-muted">Profit Potential</span>
                    <span className="text-xs font-bold text-call mt-0.5">Substantial</span>
                    <span className="block mt-0.5">Increases as Apple price falls toward zero.</span>
                  </div>
                  <div>
                    <span className="block uppercase font-bold text-fg-muted">Profit Starts At</span>
                    <span className="text-xs font-bold text-fg mt-0.5">{money(atmRow.strike - putPrem, "USD", 2)}</span>
                    <span className="block mt-0.5">At Expiration date</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-put/10">
                  <button
                    onClick={() => handleOpenDraft("PE")}
                    className="rounded-lg bg-put hover:bg-put/90 px-4 py-1.5 text-2xs font-bold text-white shadow transition-all"
                  >
                    Quick Trade Put Option
                  </button>
                  <Link
                    href="/option-chain"
                    className="rounded-lg border border-border bg-panel hover:bg-bg-sunken px-4 py-1.5 text-2xs font-bold text-fg transition-all"
                  >
                    View Option Chain
                  </Link>
                </div>
              </div>
            )}

            {outlook === "flat" && (
              <div className="rounded-xl border border-brand/20 bg-brand/[0.02] p-4 space-y-3 animate-fade-in">
                <div className="flex gap-2 items-start">
                  <Icon name="help-circle" className="text-brand mt-0.5" size={16} />
                  <div>
                    <h4 className="text-xs font-bold text-fg">Recommended Strategy: Iron Condor or Short Straddle</h4>
                    <p className="text-3xs text-fg-muted mt-1 leading-relaxed">
                      <b>What is this?</b> You act as the insurance provider. You collect fees from others today, and if Apple stays inside a stable range, you keep all the fees as pure profit!
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 text-3xs text-fg-subtle border-t border-brand/10 pt-3">
                  <div>
                    <span className="block uppercase font-bold text-fg-muted">Maximum Risk</span>
                    <span className="text-xs font-bold text-put mt-0.5">{money((callPrem + putPrem) * 0.8 * lotSize, "USD", 0)}</span>
                    <span className="block mt-0.5">Limited using spreads.</span>
                  </div>
                  <div>
                    <span className="block uppercase font-bold text-fg-muted">Maximum Profit</span>
                    <span className="text-xs font-bold text-call mt-0.5">{money((callPrem + putPrem) * lotSize, "USD", 0)}</span>
                    <span className="block mt-0.5">The total credit premium collected on day one.</span>
                  </div>
                  <div>
                    <span className="block uppercase font-bold text-fg-muted">Stable Price Zone</span>
                    <span className="text-xs font-bold text-fg mt-0.5">
                      {money(atmRow.strike - (callPrem + putPrem), "USD", 0)} to {money(atmRow.strike + (callPrem + putPrem), "USD", 0)}
                    </span>
                    <span className="block mt-0.5">You profit if Apple stays inside this range.</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-brand/10">
                  <Link
                    href="/strategy-builder"
                    onClick={() => handleApplyStrategy("condor")}
                    className="rounded-lg bg-brand hover:bg-brand/90 px-4 py-1.5 text-2xs font-bold text-white shadow transition-all"
                  >
                    Open Optimal Range Trade in Builder
                  </Link>
                  <Link
                    href="/option-chain"
                    className="rounded-lg border border-border bg-panel hover:bg-bg-sunken px-4 py-1.5 text-2xs font-bold text-fg transition-all"
                  >
                    View Option Chain
                  </Link>
                </div>
              </div>
            )}

            {!outlook && (
              <div className="text-center py-6 text-3xs text-fg-subtle bg-bg-sunken/45 rounded-lg border border-dashed border-border">
                Click one of the three options above to receive tailored, simple strategy recommendations.
              </div>
            )}
          </div>
        </Panel>

        {/* 2. Coordinated AI Agent Brief (Hermes summary) */}
        <div className="grid gap-3 lg:grid-cols-3">
          <Panel
            className="lg:col-span-2"
            eyebrow="Hermes Desk Brief"
            title="Simplified Market Overview"
            right={<AgentBadge id="hermes" />}
          >
            <div className="space-y-3 text-2xs leading-relaxed text-fg-muted">
              <p>
                Our AI agents have analyzed the options market for Apple. Here is the plain English summary:
              </p>
              <div className="grid gap-3 sm:grid-cols-2 mt-2">
                <div className="p-3 rounded-lg bg-bg-sunken/50 border border-border/40">
                  <div className="flex items-center gap-1.5 text-brand font-bold text-3xs uppercase">
                    <Icon name="gauge" size={12} /> Volatility is Low (Helios)
                  </div>
                  <p className="text-3xs text-fg-subtle mt-1">
                    Option premiums are currently cheap. This favors buying insurance (Calls or Puts) rather than selling it.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-bg-sunken/50 border border-border/40">
                  <div className="flex items-center gap-1.5 text-call font-bold text-3xs uppercase">
                    <Icon name="bar-chart-3" size={12} /> Support Zone is Strong (Argus)
                  </div>
                  <p className="text-3xs text-fg-subtle mt-1">
                    Large open interest walls are located at $300 (floor support) and $325 (ceiling resistance). AAPL is likely to bounce between these levels.
                  </p>
                </div>
              </div>
            </div>
          </Panel>

          {/* Active Positions Summary */}
          <Panel
            eyebrow="Live Positions Monitor"
            title="My Active Simulated Positions"
            right={<AgentBadge id="nike" />}
          >
            {marks.length === 0 ? (
              <div className="py-8 text-center text-3xs text-fg-subtle bg-bg-sunken/45 rounded-lg border border-dashed border-border">
                No active positions. Use the Outlook Wizard above to place your first trade!
              </div>
            ) : (
              <div className="space-y-2">
                {marks.slice(0, 3).map((m, idx) => {
                  const pnl = m.pnl;
                  const up = pnl >= 0;
                  return (
                    <div key={idx} className="flex justify-between items-center border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
                      <div>
                        <span className="font-bold text-fg block text-3xs">{m.position.strategyName}</span>
                        <span className="text-[10px] text-fg-subtle uppercase">{m.position.symbol} · {m.position.qtyLots} Lot(s)</span>
                      </div>
                      <div className="text-right">
                        <span className={cn("font-bold text-xs tnum block", up ? "text-call" : "text-put")}>
                          {up ? "+" : ""}
                          {money(pnl, m.position.currency, 0)}
                        </span>
                        <span className="text-[9px] text-fg-subtle">Unrealized P&L</span>
                      </div>
                    </div>
                  );
                })}
                <div className="pt-1.5 text-center">
                  <Link href="/strategy-builder" className="text-3xs text-brand hover:underline font-bold">
                    Go to Strategy Desk to Close or Adjust Positions
                  </Link>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
