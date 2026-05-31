"use client";

import type { AgentRunResult } from "@/lib/agents/orchestrator";
import { SUB_AGENTS, AGENTS } from "@/lib/agents/registry";
import { Card } from "@/components/ui/primitives";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { Icon } from "@/components/ui/Icon";

/** The single plain-English read Hermes composes from all specialist reports. */
export function HermesBrief({ result }: { result: AgentRunResult }) {
  const contributing = new Set(result.findings.map((f) => f.agent));
  return (
    <Card className="card-pad">
      <div className="mb-2.5 flex items-center gap-2">
        <AgentBadge id="hermes" variant="solid" size="lg" />
        <div>
          <div className="text-sm font-semibold text-fg">Hermes desk brief</div>
          <div className="text-2xs text-fg-subtle">{AGENTS.hermes.domain}</div>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 text-2xs text-fg-subtle">
          <Icon name="refresh" size={11} /> live synthesis
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-fg-muted">{result.brief}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-2.5">
        <span className="label-eyebrow">Agents engaged</span>
        {SUB_AGENTS.map((id) => (
          <span
            key={id}
            className={contributing.has(id) ? "opacity-100" : "opacity-40"}
            title={contributing.has(id) ? "Produced findings" : "Ran, no flags"}
          >
            <AgentBadge id={id} size="sm" />
          </span>
        ))}
      </div>
    </Card>
  );
}
