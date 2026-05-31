"use client";

import { useMarket } from "@/components/providers/market";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel, Card } from "@/components/ui/primitives";
import { LoadingGrid } from "@/components/ui/Loading";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { Icon } from "@/components/ui/Icon";
import { FxStrip, RemittanceAlerts } from "@/components/panels/ForexPanel";
import { IbkrAccountPanel, CrossBorderExposure } from "@/components/panels/AccountPanel";

const EDGES = [
  {
    icon: "arrow-left-right",
    title: "Remittance timing",
    body: "Fund an INR options account or repatriate gains when the pair trades above its 30-day average — Plutus flags the window and the rupee benefit.",
  },
  {
    icon: "scale",
    title: "Currency-adjusted P&L",
    body: "A US options win is only as good as the rate you convert it at. Plutus folds the live FX rate into cross-border P&L so the real take-home is clear.",
  },
  {
    icon: "globe",
    title: "Cross-market arbitrage",
    body: "When the same macro exposure (e.g. an index move) is cheaper to express in one market once currency is accounted for, Plutus surfaces the spread.",
  },
];

export default function CrossBorderPage() {
  const { remittance, snapshot, loading } = useMarket();

  if (loading || !snapshot) {
    return (
      <>
        <PageHeader title="Cross-border & FX" desc="Loading FX…" icon="globe" />
        <LoadingGrid />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Cross-border & FX"
        desc="Trading two currencies at once is part of the edge. Plutus watches the pairs and the remittance windows."
        icon="globe"
        right={<AgentBadge id="plutus" showTitle />}
      />

      <div className="space-y-3">
        <Panel eyebrow="Rates" title="FX — live vs 30-day average">
          <FxStrip />
        </Panel>

        <div className="grid gap-3 lg:grid-cols-3">
          <Panel className="lg:col-span-2" eyebrow="Interactive Brokers · real" title="Your account & holdings">
            <IbkrAccountPanel />
          </Panel>
          <Panel eyebrow="Exposure" title="USD ↔ EUR" right={<AgentBadge id="plutus" />}>
            <CrossBorderExposure />
          </Panel>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Panel className="lg:col-span-2" eyebrow="Windows" title="Remittance & currency-benefit alerts">
            <RemittanceAlerts alerts={remittance} />
          </Panel>

          <Card className="card-pad">
            <div className="mb-2 flex items-center gap-2">
              <AgentBadge id="plutus" />
              <span className="label-eyebrow">where the edge is</span>
            </div>
            <div className="space-y-3">
              {EDGES.map((e) => (
                <div key={e.title} className="flex gap-2.5">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-bg-sunken text-fg-muted">
                    <Icon name={e.icon} size={15} />
                  </span>
                  <div>
                    <div className="text-2xs font-semibold text-fg">{e.title}</div>
                    <p className="mt-0.5 text-2xs leading-relaxed text-fg-subtle">{e.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
