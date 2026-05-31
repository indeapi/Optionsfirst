"use client";

import type { Finding, Severity } from "@/lib/agents/registry";
import { cn } from "@/lib/utils";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { Chip, severityTone } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

const SEV_RANK: Record<Severity, number> = { alert: 0, watch: 1, positive: 2, info: 3 };
const SEV_ICON: Record<Severity, string> = {
  alert: "triangle-alert",
  watch: "triangle-alert",
  positive: "check",
  info: "info",
};
const SEV_BAR: Record<Severity, string> = {
  alert: "bg-put",
  watch: "bg-warn",
  positive: "bg-call",
  info: "bg-info",
};
const SEV_CHIP_BG: Record<Severity, string> = {
  alert: "bg-put-soft",
  watch: "bg-warn/15",
  positive: "bg-call-soft",
  info: "bg-info/15",
};
const SEV_ICON_COLOR: Record<Severity, string> = {
  alert: "text-put",
  watch: "text-warn",
  positive: "text-call",
  info: "text-info",
};

export function FindingsList({
  findings,
  limit,
  filterAgent,
}: {
  findings: Finding[];
  limit?: number;
  filterAgent?: string;
}) {
  let list = [...findings];
  if (filterAgent) list = list.filter((f) => f.agent === filterAgent);
  list.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);
  if (limit) list = list.slice(0, limit);

  if (list.length === 0) {
    return <div className="py-6 text-center text-2xs text-fg-subtle">No flags — all clear.</div>;
  }

  return (
    <ul className="space-y-2">
      {list.map((f, i) => {
        const tone = severityTone(f.severity);
        return (
          <li key={i} className="relative flex gap-3 rounded-lg border border-border bg-panel-2 p-2.5">
            <span className={cn("absolute inset-y-2 left-0 w-0.5 rounded-full", SEV_BAR[f.severity])} />
            <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md", SEV_CHIP_BG[f.severity])}>
              <Icon name={SEV_ICON[f.severity]} size={12} className={SEV_ICON_COLOR[f.severity]} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <AgentBadge id={f.agent} size="sm" />
                <span className="text-[13px] font-semibold leading-tight text-fg">{f.title}</span>
                {f.metric ? (
                  <Chip tone={tone} className="ml-auto tnum">
                    {f.metric}
                  </Chip>
                ) : null}
              </div>
              <p className="mt-1 text-2xs leading-relaxed text-fg-muted">{f.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
