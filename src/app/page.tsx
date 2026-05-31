"use client";

import Link from "next/link";
import { useMarket } from "@/components/providers/market";
import { PageHeader } from "@/components/shell/PageHeader";
import { ExpiryPicker } from "@/components/shell/ExpiryPicker";
import { Panel } from "@/components/ui/primitives";
import { LoadingGrid } from "@/components/ui/Loading";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { Icon } from "@/components/ui/Icon";
import { MarketHeader } from "@/components/panels/MarketHeader";
import { HermesBrief } from "@/components/panels/HermesBrief";
import { FindingsList } from "@/components/panels/FindingsList";
import { OIChart } from "@/components/charts/OIChart";
import { StraddleChart } from "@/components/charts/StraddleChart";
import { VolSmileChart } from "@/components/charts/VolSmileChart";
import { StrategyRankList } from "@/components/panels/StrategyRank";
import { PositionsMonitor } from "@/components/panels/PositionsMonitor";
import { FxStrip, RemittanceAlerts } from "@/components/panels/ForexPanel";

export default function DashboardPage() {
  const { snapshot, agents, marks, remittance, loading } = useMarket();

  if (loading || !snapshot || !agents) {
    return (
      <>
        <PageHeader title="Desk overview" desc="Loading the live market view…" icon="dashboard" />
        <LoadingGrid />
      </>
    );
  }

  const { chain, analytics } = snapshot;

  return (
    <>
      <PageHeader
        title="Desk overview"
        desc={`${chain.instrument.name} · ${chain.instrument.region === "IN" ? "NSE F&O" : "US options"} — coordinated by the Hermes agent desk.`}
        icon="dashboard"
        right={<ExpiryPicker />}
      />

      <div className="space-y-3">
        <MarketHeader snapshot={snapshot} />

        <HermesBrief result={agents} />

        <div className="grid gap-3 lg:grid-cols-3">
          <Panel
            className="lg:col-span-2"
            eyebrow="Positioning"
            title="Open Interest by strike"
            right={<AgentBadge id="argus" showTitle />}
          >
            <OIChart chain={chain} analytics={analytics} />
          </Panel>

          <Panel
            eyebrow="Hermes desk"
            title="Live findings"
            right={
              <Link href="/agents" className="inline-flex items-center gap-1 text-2xs font-medium text-brand hover:underline">
                Workflow <Icon name="chevron-right" size={12} />
              </Link>
            }
          >
            <FindingsList findings={agents.findings} limit={6} />
          </Panel>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Panel eyebrow="Volatility" title="ATM straddle · intraday" right={<AgentBadge id="helios" />}>
            <StraddleChart chain={chain} analytics={analytics} />
          </Panel>
          <Panel eyebrow="Volatility" title="IV smile / skew" right={<AgentBadge id="helios" />}>
            <VolSmileChart chain={chain} />
          </Panel>
          <Panel eyebrow="Live monitor" title="Open positions" right={<AgentBadge id="nike" />}>
            <PositionsMonitor marks={marks} />
          </Panel>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Panel
            className="lg:col-span-2"
            eyebrow="Playbook"
            title="Top strategies for these conditions"
            right={
              <div className="flex items-center gap-2">
                <AgentBadge id="athena" />
                <Link href="/strategies" className="inline-flex items-center gap-1 text-2xs font-medium text-brand hover:underline">
                  All <Icon name="chevron-right" size={12} />
                </Link>
              </div>
            }
          >
            <StrategyRankList ranked={snapshot.ranked.slice(0, 6)} />
          </Panel>

          <Panel eyebrow="Cross-border" title="FX & remittance" right={<AgentBadge id="plutus" />}>
            <div className="space-y-3">
              <FxStrip />
              <RemittanceAlerts alerts={remittance.slice(0, 1)} />
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
