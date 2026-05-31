"use client";

import type { ChainAnalytics, OptionChain } from "@/lib/data/types";
import type { RankedStrategy } from "@/lib/quant/strategyRanker";
import { cn, money } from "@/lib/utils";
import { Chip } from "@/components/ui/primitives";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { Icon } from "@/components/ui/Icon";
import { PayoffChart } from "@/components/charts/PayoffChart";

const VIEW_TONE = {
  bullish: "call",
  bearish: "put",
  neutral: "info",
  volatile: "warn",
} as const;

function scoreColor(score: number): string {
  if (score >= 70) return "bg-call";
  if (score >= 50) return "bg-brand";
  if (score >= 35) return "bg-warn";
  return "bg-fg-subtle";
}

function fmtProfit(v: number, ccy: "INR" | "USD"): string {
  if (!Number.isFinite(v)) return v > 0 ? "Unlimited" : "Undefined";
  return money(v, ccy, 0);
}

export function StrategyRankList({
  ranked,
  selectedId,
  onSelect,
}: {
  ranked: RankedStrategy[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <ol className="space-y-1.5">
      {ranked.map((s, i) => {
        const selected = s.meta.id === selectedId;
        return (
          <li key={s.meta.id}>
            <button
              onClick={() => onSelect?.(s.meta.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors",
                selected ? "border-brand/40 bg-brand/[0.06]" : "border-border bg-panel hover:bg-bg-sunken",
              )}
            >
              <span className="tnum w-5 shrink-0 text-center text-sm font-bold text-fg-subtle">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-semibold text-fg">{s.meta.name}</span>
                  <Chip tone={VIEW_TONE[s.meta.view]} className="capitalize">
                    {s.meta.view}
                  </Chip>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-bg-sunken">
                    <span className={cn("block h-full rounded-full", scoreColor(s.score))} style={{ width: `${s.score}%` }} />
                  </span>
                  <span className="text-2xs text-fg-subtle">
                    {s.payoff.pop !== undefined ? `${(s.payoff.pop * 100).toFixed(0)}% POP` : s.meta.category}
                  </span>
                </div>
              </div>
              <span className="tnum text-sm font-bold text-fg">{s.score}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function StrategyDetail({
  item,
  chain,
  analytics,
}: {
  item: RankedStrategy;
  chain: OptionChain;
  analytics: ChainAnalytics;
}) {
  const ccy = chain.instrument.currency;
  const p = item.payoff;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-fg">{item.meta.name}</h3>
            <Chip tone={VIEW_TONE[item.meta.view]} className="capitalize">
              {item.meta.view}
            </Chip>
            <span className="tnum rounded-md bg-brand/10 px-1.5 py-0.5 text-2xs font-bold text-brand">
              {item.score}/100
            </span>
          </div>
          <p className="mt-1 max-w-xl text-2xs text-fg-muted">{item.meta.summary}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {item.tags.map((t) => (
            <span key={t} className="rounded bg-bg-sunken px-1.5 py-0.5 text-2xs text-fg-subtle">
              {t}
            </span>
          ))}
        </div>
      </div>

      <PayoffChart
        payoff={p}
        spot={chain.spot}
        currency={ccy}
        expectedMovePct={analytics.expectedMovePct}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Max profit" value={fmtProfit(p.maxProfit, ccy)} tone="call" />
        <Metric label="Max loss" value={fmtProfit(p.maxLoss, ccy)} tone="put" />
        <Metric
          label={p.netPremium >= 0 ? "Net credit" : "Net debit"}
          value={money(Math.abs(p.netPremium), ccy, 0)}
        />
        <Metric
          label="Breakeven"
          value={p.breakevens.map((b) => b.toLocaleString(undefined, { maximumFractionDigits: 0 })).join(" / ") || "—"}
        />
      </div>

      <div className="rounded-lg border border-border bg-panel-2 p-3">
        <div className="mb-2 flex items-center gap-2">
          <AgentBadge id="athena" size="sm" />
          <span className="label-eyebrow">why this ranks here</span>
        </div>
        <ul className="space-y-1">
          {item.reasons.map((r, i) => (
            <li key={i} className="flex gap-2 text-2xs text-fg-muted">
              <Icon name="chevron-right" size={12} className="mt-0.5 shrink-0 text-fg-subtle" />
              {r}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="label-eyebrow mb-1.5">Legs</div>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-2xs tnum">
            <thead>
              <tr className="bg-bg-sunken text-fg-subtle">
                <th className="px-2 py-1.5 text-left font-medium">Action</th>
                <th className="px-2 py-1.5 text-left font-medium">Type</th>
                <th className="px-2 py-1.5 text-right font-medium">Strike</th>
                <th className="px-2 py-1.5 text-right font-medium">Qty</th>
                <th className="px-2 py-1.5 text-right font-medium">Premium</th>
              </tr>
            </thead>
            <tbody>
              {item.legs.map((leg, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-2 py-1.5">
                    <span className={leg.action === "buy" ? "font-semibold text-call" : "font-semibold text-put"}>
                      {leg.action.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-fg-muted">{leg.right === "EQ" ? "Underlying" : leg.right}</td>
                  <td className="px-2 py-1.5 text-right">{leg.right === "EQ" ? "—" : leg.strike.toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-right">{leg.qty}</td>
                  <td className="px-2 py-1.5 text-right">{money(leg.premium, ccy, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "call" | "put" }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-2.5">
      <div className="label-eyebrow">{label}</div>
      <div
        className={cn(
          "tnum mt-1 text-sm font-bold",
          tone === "call" ? "text-call" : tone === "put" ? "text-put" : "text-fg",
        )}
      >
        {value}
      </div>
    </div>
  );
}
