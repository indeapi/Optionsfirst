"use client";

import Link from "next/link";
import { useMarket } from "@/components/providers/market";
import { PageHeader } from "@/components/shell/PageHeader";
import { ExpiryPicker } from "@/components/shell/ExpiryPicker";
import { Panel } from "@/components/ui/primitives";
import { LoadingGrid } from "@/components/ui/Loading";
import { SourceTag } from "@/components/ui/SourceTag";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { MarketHeader } from "@/components/panels/MarketHeader";
import { OptionChainTable } from "@/components/option-chain/OptionChainTable";
import { OIChart } from "@/components/charts/OIChart";
import { DataSourcePanel } from "@/components/panels/DataFreshness";
import { useAppStore } from "@/lib/store/app";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { OrderDrawer } from "@/components/panels/OrderDrawer";

export default function OptionChainPage() {
  const { snapshot, loading } = useMarket();
  const builderLegs = useAppStore((s) => s.builderLegs);
  const clearBuilderLegs = useAppStore((s) => s.clearBuilderLegs);

  if (loading || !snapshot) {
    return (
      <>
        <PageHeader title="Option chain" desc="Loading chain…" icon="table" />
        <LoadingGrid />
      </>
    );
  }
  const { chain, analytics } = snapshot;

  return (
    <>
      <PageHeader
        title="Option chain"
        desc={`${chain.instrument.symbol} · ${chain.expiry} — calls, strike, puts with live greeks and OI.`}
        icon="table"
        right={<ExpiryPicker />}
      />

      <div className="space-y-3 pb-24">
        <MarketHeader snapshot={snapshot} />

        <Panel
          eyebrow="Chain"
          title="Calls · Strike · Puts"
          right={
            <div className="flex flex-wrap items-center gap-1.5">
              {chain.freshness.ltp ? <SourceTag prov={chain.freshness.ltp} /> : null}
              {chain.freshness.oi ? <SourceTag prov={chain.freshness.oi} /> : null}
            </div>
          }
          bodyClassName="p-0 sm:p-2"
        >
          <OptionChainTable chain={chain} />
        </Panel>

        <div className="grid gap-3 lg:grid-cols-2">
          <Panel eyebrow="Positioning" title="Open Interest by strike" right={<AgentBadge id="argus" />}>
            <OIChart chain={chain} analytics={analytics} maxStrikes={20} />
          </Panel>
          <Panel eyebrow="Data integrity" title="Source &amp; delay — this chain" right={<AgentBadge id="iris" />}>
            <DataSourcePanel chain={chain} />
          </Panel>
        </div>
      </div>

      {/* Floating builder basket bar */}
      {builderLegs.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 md:left-64 md:right-4 z-40 animate-slide-up">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-brand/30 bg-panel/95 px-4 py-3 shadow-pop backdrop-blur animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-3xs font-bold text-white">
                {builderLegs.length}
              </span>
              <div>
                <div className="text-2xs font-semibold text-fg">Draft Strategy Basket</div>
                <div className="flex flex-wrap gap-1.5 mt-0.5">
                  {builderLegs.map((l, idx) => (
                    <span
                      key={idx}
                      className={cn(
                        "chip capitalize",
                        l.right === "CE" ? "bg-call-soft text-call" : "bg-put-soft text-put"
                      )}
                    >
                      {l.right} {l.strike.toLocaleString()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              <button
                onClick={clearBuilderLegs}
                className="rounded-lg border border-border bg-panel px-3 py-1.5 text-2xs font-medium text-fg-muted hover:bg-bg-sunken"
              >
                Clear
              </button>
              <Link
                href="/strategy-builder"
                className="inline-flex items-center gap-1 rounded-lg bg-brand px-4 py-1.5 text-2xs font-semibold text-white shadow-md hover:bg-brand/90"
              >
                Analyze Strategy <Icon name="chevron-right" size={12} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Slide drawer for click-to-buy execution */}
      <OrderDrawer />
    </>
  );
}
