"use client";

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

export default function OptionChainPage() {
  const { snapshot, loading } = useMarket();

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

      <div className="space-y-3">
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
    </>
  );
}
