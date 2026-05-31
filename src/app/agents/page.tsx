"use client";

import { useMarket } from "@/components/providers/market";
import { PageHeader } from "@/components/shell/PageHeader";
import { ExpiryPicker } from "@/components/shell/ExpiryPicker";
import { Panel, Card } from "@/components/ui/primitives";
import { LoadingGrid } from "@/components/ui/Loading";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { Icon } from "@/components/ui/Icon";
import { HermesBrief } from "@/components/panels/HermesBrief";
import { AgentWorkflow, AgentRoster } from "@/components/panels/AgentWorkflow";
import { FindingsList } from "@/components/panels/FindingsList";

export default function AgentsPage() {
  const { snapshot, agents, loading } = useMarket();

  if (loading || !snapshot || !agents) {
    return (
      <>
        <PageHeader title="Hermes agent desk" desc="Running the desk…" icon="workflow" />
        <LoadingGrid />
      </>
    );
  }

  const engaged = new Set(agents.findings.map((f) => f.agent));

  return (
    <>
      <PageHeader
        title="Hermes agent desk"
        desc="One orchestrator, six specialists. Every number on the platform is produced — and explained — by an agent here."
        icon="workflow"
        right={<ExpiryPicker />}
      />

      <div className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <HermesBrief result={agents} />
          </div>
          <Card className="card-pad flex flex-col justify-center gap-2.5">
            <RunStat icon="workflow" label="Agents coordinated" value={`${agents.steps.length}`} />
            <RunStat icon="circle-dot" label="Findings this run" value={`${agents.findings.length}`} />
            <RunStat icon="clock" label="Pipeline time" value={`${agents.steps.reduce((a, s) => a + s.ms, 0)}ms`} />
          </Card>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Panel
            className="lg:col-span-2"
            eyebrow="Workflow"
            title="What each agent did on this run"
            right={
              <span className="inline-flex items-center gap-1 text-2xs text-fg-subtle">
                <Icon name="route" size={12} className="text-brand" /> top-to-bottom
              </span>
            }
          >
            <AgentWorkflow steps={agents.steps} />
          </Panel>
          <Panel eyebrow="Output" title="All findings" right={<AgentBadge id="hermes" />}>
            <FindingsList findings={agents.findings} />
          </Panel>
        </div>

        <Panel eyebrow="Roster" title="The Options First agent desk">
          <AgentRoster active={new Set(["hermes", ...engaged])} />
        </Panel>
      </div>
    </>
  );
}

function RunStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand/10 text-brand">
        <Icon name={icon} size={17} />
      </span>
      <div>
        <div className="tnum text-lg font-bold leading-none text-fg">{value}</div>
        <div className="text-2xs text-fg-subtle">{label}</div>
      </div>
    </div>
  );
}
