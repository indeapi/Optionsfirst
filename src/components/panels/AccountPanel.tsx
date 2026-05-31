"use client";

import {
  IBKR_ACCOUNT,
  IBKR_CAPTURED_AT,
  IBKR_USD_EUR,
} from "@/lib/data/live/ibkrCapture";
import { formatAge } from "@/lib/data/freshness";
import { useNow } from "@/lib/hooks/useNow";
import { cn, money, num, pct } from "@/lib/utils";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { Icon } from "@/components/ui/Icon";

function CapturedTag() {
  const now = useNow(1000);
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-info/15 px-1.5 py-0.5 text-2xs font-medium text-info tnum">
      <Icon name="clock" size={10} strokeWidth={2.5} /> IBKR · captured · {formatAge(IBKR_CAPTURED_AT, now)}
    </span>
  );
}

/** The user's real Interactive Brokers account + holdings (captured snapshot). */
export function IbkrAccountPanel() {
  const a = IBKR_ACCOUNT;
  const totalUpnl = a.positions.reduce((s, p) => s + p.unrealizedPnl, 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
          <Mini label="Net liquidation" value={money(a.netLiquidation, "EUR", 2)} />
          <Mini label="Available funds" value={money(a.availableFunds, "EUR", 2)} />
          <Mini label="Buying power" value={money(a.buyingPower, "EUR", 2)} />
          <Mini label="Unrealised P&L" value={`+${money(totalUpnl, "USD", 2)}`} tone="call" />
        </div>
        <CapturedTag />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-2xs tnum">
          <thead>
            <tr className="bg-bg-sunken text-fg-subtle">
              <th className="px-2.5 py-1.5 text-left font-medium">Symbol</th>
              <th className="px-2.5 py-1.5 text-right font-medium">Qty</th>
              <th className="px-2.5 py-1.5 text-right font-medium">Avg</th>
              <th className="px-2.5 py-1.5 text-right font-medium">Last</th>
              <th className="px-2.5 py-1.5 text-right font-medium">Value</th>
              <th className="px-2.5 py-1.5 text-right font-medium">Unrl. P&L</th>
            </tr>
          </thead>
          <tbody>
            {a.positions.map((p) => {
              const up = p.unrealizedPnl >= 0;
              const retPct = ((p.marketPrice - p.avgPrice) / p.avgPrice) * 100;
              return (
                <tr key={p.symbol} className="border-t border-border">
                  <td className="px-2.5 py-1.5">
                    <span className="font-semibold text-fg">{p.symbol}</span>
                    <span className="ml-1 text-fg-subtle">{p.assetClass}</span>
                  </td>
                  <td className="px-2.5 py-1.5 text-right text-fg-muted">{num(p.quantity, 4)}</td>
                  <td className="px-2.5 py-1.5 text-right text-fg-muted">{num(p.avgPrice)}</td>
                  <td className="px-2.5 py-1.5 text-right text-fg">{num(p.marketPrice)}</td>
                  <td className="px-2.5 py-1.5 text-right text-fg">{money(p.marketValue, p.currency, 2)}</td>
                  <td className={cn("px-2.5 py-1.5 text-right font-semibold", up ? "text-call" : "text-put")}>
                    {up ? "+" : ""}
                    {money(p.unrealizedPnl, p.currency, 2)}
                    <span className="ml-1 font-normal opacity-70">{pct(retPct, 1)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Real USD↔EUR exposure for this cross-border (EUR-base) account. */
export function CrossBorderExposure() {
  const usd = IBKR_ACCOUNT.balances.find((b) => b.currency === "USD");
  const usdNetLiq = usd?.netLiquidation ?? 0;
  const eurValue = usdNetLiq * IBKR_USD_EUR;
  const eurUsd = 1 / IBKR_USD_EUR;
  // Sensitivity: 1% USD weakening vs EUR on the USD book, in EUR.
  const oneePctSwing = eurValue * 0.01;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border bg-panel-2 p-3">
        <div className="flex items-center justify-between">
          <span className="label-eyebrow">USD book → EUR base</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-info/15 px-1.5 py-0.5 text-2xs font-medium text-info tnum">
            <Icon name="clock" size={10} strokeWidth={2.5} /> live FX {num(IBKR_USD_EUR, 5)}
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="tnum text-xl font-bold text-fg">{money(usdNetLiq, "USD", 2)}</span>
          <Icon name="arrow-left-right" size={14} className="text-fg-subtle" />
          <span className="tnum text-xl font-bold text-fg">{money(eurValue, "EUR", 2)}</span>
        </div>
        <div className="mt-1 text-2xs text-fg-subtle tnum">
          EUR/USD {num(eurUsd, 4)} · USD/EUR {num(IBKR_USD_EUR, 5)} (from your IBKR balances)
        </div>
      </div>

      <div className="rounded-lg bg-bg-sunken px-3 py-2.5">
        <div className="flex items-center gap-2">
          <AgentBadge id="plutus" size="sm" />
          <span className="label-eyebrow">currency read</span>
        </div>
        <p className="mt-1.5 text-2xs leading-relaxed text-fg-muted">
          Almost your entire book is USD-denominated while your base currency is EUR. A 1% move in USD vs EUR is worth
          about <b className="text-fg">{money(oneePctSwing, "EUR", 2)}</b> on the current exposure — independent of how
          the options themselves perform. Plutus folds this into cross-border P&amp;L and flags favourable conversion
          windows.
        </p>
      </div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "call" | "put" }) {
  return (
    <div>
      <div className="label-eyebrow">{label}</div>
      <div className={cn("tnum mt-0.5 text-sm font-bold", tone === "call" ? "text-call" : "text-fg")}>{value}</div>
    </div>
  );
}
