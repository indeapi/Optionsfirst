"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store/app";
import { scanMarket, topBy, type ScanRow } from "@/lib/quant/scanners";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel } from "@/components/ui/primitives";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { cn, compact, money, num, pct } from "@/lib/utils";

export default function ScannersPage() {
  const rows = useMemo(() => scanMarket(Date.now()), []);

  return (
    <>
      <PageHeader
        title="Scanners"
        desc="Where the money and the open interest are moving — price & OI gainers / losers and volatility extremes across every instrument."
        icon="search"
        right={<AgentBadge id="argus" showTitle />}
      />

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Board title="Price gainers" rows={topBy(rows, "priceChgPct", 6, "desc")} render={(r) => pctCell(r.priceChgPct)} />
          <Board title="Price losers" rows={topBy(rows, "priceChgPct", 6, "asc")} render={(r) => pctCell(r.priceChgPct)} />
          <Board title="OI gainers" rows={topBy(rows, "oiChgPct", 6, "desc")} render={(r) => pctCell(r.oiChgPct)} sub="net OI add" />
          <Board title="OI losers" rows={topBy(rows, "oiChgPct", 6, "asc")} render={(r) => pctCell(r.oiChgPct)} sub="OI unwind" />
        </div>

        <Panel eyebrow="Anomalies" title="Spikes & extremes" right={<AgentBadge id="argus" />}>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniTable
              title="OI surge"
              hint="Largest absolute OI shift — fresh positioning."
              rows={[...rows].sort((a, b) => Math.abs(b.oiChgPct) - Math.abs(a.oiChgPct)).slice(0, 5)}
              render={(r) => pctCell(r.oiChgPct)}
            />
            <MiniTable
              title="Volume leaders"
              hint="Heaviest option turnover today."
              rows={topBy(rows, "volume", 5, "desc")}
              render={(r) => <span className="tnum text-fg-muted">{compact(r.volume, r.region)}</span>}
            />
            <MiniTable
              title="High IV rank"
              hint="Richest premium vs own history — sellers' tape."
              rows={topBy(rows, "ivRank", 5, "desc")}
              render={(r) => <span className="tnum font-semibold text-warn">{(r.ivRank * 100).toFixed(0)}</span>}
            />
          </div>
        </Panel>
      </div>
    </>
  );
}

function pctCell(v: number) {
  return (
    <span className={cn("tnum font-semibold", v >= 0 ? "text-call" : "text-put")}>
      {pct(v, 1)}
    </span>
  );
}

function Row({ r, right }: { r: ScanRow; right: React.ReactNode }) {
  const setSymbol = useAppStore((s) => s.setSymbol);
  return (
    <Link
      href="/option-chain"
      onClick={() => setSymbol(r.symbol)}
      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-2xs transition-colors hover:bg-bg-sunken"
    >
      <span className="flex items-center gap-1.5 min-w-0">
        <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-bg-sunken text-[8px] font-bold text-fg-subtle">{r.region}</span>
        <span className="truncate font-medium text-fg">{r.symbol}</span>
        <span className="tnum text-fg-subtle">{money(r.price, r.currency, r.price > 1000 ? 0 : 2)}</span>
      </span>
      {right}
    </Link>
  );
}

function Board({ title, rows, render, sub }: { title: string; rows: ScanRow[]; render: (r: ScanRow) => React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-2.5">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-2xs font-semibold text-fg">{title}</span>
        {sub ? <span className="text-3xs text-fg-subtle">{sub}</span> : null}
      </div>
      <div className="space-y-0.5">
        {rows.map((r) => (
          <Row key={r.symbol} r={r} right={render(r)} />
        ))}
      </div>
    </div>
  );
}

function MiniTable({ title, hint, rows, render }: { title: string; hint: string; rows: ScanRow[]; render: (r: ScanRow) => React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-panel-2 p-2.5">
      <div className="text-2xs font-semibold text-fg">{title}</div>
      <p className="mb-1.5 text-3xs text-fg-subtle">{hint}</p>
      <div className="space-y-0.5">
        {rows.map((r) => (
          <Row key={r.symbol} r={r} right={render(r)} />
        ))}
      </div>
    </div>
  );
}
