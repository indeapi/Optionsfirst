"use client";

import { useState } from "react";
import { useMarket } from "@/components/providers/market";
import { PageHeader } from "@/components/shell/PageHeader";
import { ExpiryPicker } from "@/components/shell/ExpiryPicker";
import { Panel, Chip, type Tone } from "@/components/ui/primitives";
import { LoadingGrid } from "@/components/ui/Loading";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { StrategyRankList, StrategyDetail } from "@/components/panels/StrategyRank";

const DIR_TONE: Record<string, Tone> = {
  bullish: "call",
  bearish: "put",
  neutral: "info",
  volatile: "warn",
};

export default function StrategiesPage() {
  const { snapshot, loading } = useMarket();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (loading || !snapshot) {
    return (
      <>
        <PageHeader title="Strategy playbook" desc="Ranking strategies…" icon="layers" />
        <LoadingGrid />
      </>
    );
  }

  const { ranked, chain, analytics, condition } = snapshot;
  const selected = ranked.find((s) => s.meta.id === selectedId) ?? ranked[0];

  return (
    <>
      <PageHeader
        title="Strategy playbook"
        desc="Athena ranks every structure against the live tape, then explains each pick."
        icon="layers"
        right={<ExpiryPicker />}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-panel px-3 py-2.5">
        <span className="label-eyebrow">Conditions read</span>
        <Chip tone={DIR_TONE[condition.direction]} className="capitalize">
          {condition.direction}
        </Chip>
        <Chip tone="info">IV {condition.ivRegime}</Chip>
        <Chip tone="neutral">{condition.dte}d to expiry</Chip>
        <Chip tone="neutral">±{analytics.expectedMovePct.toFixed(1)}% expected</Chip>
        <span className="ml-auto">
          <AgentBadge id="athena" showTitle />
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        <Panel className="lg:col-span-4" eyebrow="Ranked" title="Top 10 by fit + payoff">
          <StrategyRankList ranked={ranked} selectedId={selected.meta.id} onSelect={setSelectedId} />
        </Panel>
        <Panel className="lg:col-span-8" eyebrow="Detail" title={selected.meta.name}>
          <StrategyDetail item={selected} chain={chain} analytics={analytics} />
        </Panel>
      </div>
    </>
  );
}
