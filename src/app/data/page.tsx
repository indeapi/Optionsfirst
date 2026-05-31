"use client";

import { useMarket } from "@/components/providers/market";
import { PageHeader } from "@/components/shell/PageHeader";
import { ExpiryPicker } from "@/components/shell/ExpiryPicker";
import { Panel, Card } from "@/components/ui/primitives";
import { LoadingGrid } from "@/components/ui/Loading";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { DataSourcePanel, DataDictionary } from "@/components/panels/DataFreshness";

const LEGEND = [
  { cls: "bg-call-soft text-call", label: "Live", note: "Streamed tick — sub-second." },
  { cls: "bg-warn/15 text-warn", label: "Delayed", note: "Real but lagged (e.g. NSE OI ~3 min)." },
  { cls: "bg-info/15 text-info", label: "End-of-day", note: "Settled once per session (US OI)." },
  { cls: "bg-bg-sunken text-fg-muted", label: "Computed", note: "Derived live from fresher inputs." },
  { cls: "bg-sim/15 text-sim", label: "Simulated ★", note: "Synthesised by Options First." },
];

export default function DataPage() {
  const { snapshot, loading } = useMarket();

  if (loading || !snapshot) {
    return (
      <>
        <PageHeader title="Data & delays" desc="Loading…" icon="signal" />
        <LoadingGrid />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Data & delays"
        desc="Every value carries its real source and delay. US and Indian feeds differ — here's exactly what's available, when."
        icon="signal"
        right={<ExpiryPicker />}
      />

      <div className="space-y-3">
        <Card className="card-pad">
          <div className="mb-2.5 flex items-center gap-2">
            <AgentBadge id="iris" showTitle />
          </div>
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {LEGEND.map((l) => (
              <div key={l.label} className="rounded-lg border border-border bg-panel-2 p-2.5">
                <span className={`chip ${l.cls}`}>{l.label}</span>
                <p className="mt-1.5 text-2xs leading-relaxed text-fg-subtle">{l.note}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-3 lg:grid-cols-2">
          <Panel eyebrow="This chain" title={`${snapshot.chain.instrument.symbol} — live source & age`} right={<AgentBadge id="iris" />}>
            <DataSourcePanel chain={snapshot.chain} />
          </Panel>
          <Panel eyebrow="Reference" title="US vs India — which data, when">
            <DataDictionary />
          </Panel>
        </div>
      </div>
    </>
  );
}
