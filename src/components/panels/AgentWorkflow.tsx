"use client";

import type { WorkflowStep } from "@/lib/agents/registry";
import { AGENTS, AGENT_LIST, type AgentId } from "@/lib/agents/registry";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";

const STATUS: Record<WorkflowStep["status"], { tone: string; label: string }> = {
  ok: { tone: "text-call", label: "ok" },
  degraded: { tone: "text-warn", label: "degraded" },
  blocked: { tone: "text-put", label: "blocked" },
};

/** Vertical trace of what each agent did on this run — the visible workflow. */
export function AgentWorkflow({ steps }: { steps: WorkflowStep[] }) {
  return (
    <ol className="relative space-y-1">
      <span className="absolute bottom-3 left-[13px] top-3 w-px bg-border" aria-hidden />
      {steps.map((step, i) => {
        const a = AGENTS[step.agent];
        const st = STATUS[step.status];
        return (
          <li key={i} className="relative flex gap-3 rounded-lg px-1 py-2">
            <span
              className="z-10 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-4 ring-panel"
              style={{ background: `hsl(${a.accent} / 0.15)`, color: `hsl(${a.accent})` }}
            >
              <Icon name={a.icon} size={14} strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-fg">{a.name}</span>
                <span className="text-2xs text-fg-subtle">{a.title}</span>
                <span className={cn("ml-auto inline-flex items-center gap-1 text-2xs font-medium", st.tone)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", st.tone.replace("text-", "bg-"))} />
                  {st.label} · {step.ms}ms
                </span>
              </div>
              <div className="text-[13px] text-fg-muted">{step.action}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-2xs">
                {step.inputs.map((inp) => (
                  <span key={inp} className="rounded bg-bg-sunken px-1.5 py-0.5 text-fg-subtle">
                    {inp}
                  </span>
                ))}
                {step.outputs.length ? (
                  <>
                    <Icon name="chevron-right" size={12} className="text-fg-subtle" />
                    {step.outputs.map((out) => (
                      <span key={out} className="rounded bg-brand/10 px-1.5 py-0.5 font-medium text-brand">
                        {out}
                      </span>
                    ))}
                  </>
                ) : null}
              </div>
              {step.note ? <div className="mt-1 text-2xs text-fg-subtle">{step.note}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The full roster of agents — identity, domain, responsibilities. */
export function AgentRoster({ active }: { active?: Set<AgentId> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {AGENT_LIST.map((a) => {
        const isActive = !active || active.has(a.id);
        return (
          <div
            key={a.id}
            className={cn(
              "rounded-xl border border-border bg-panel p-3.5 transition-opacity",
              !isActive && "opacity-55",
            )}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="grid h-9 w-9 place-items-center rounded-xl"
                style={{ background: `hsl(${a.accent} / 0.15)`, color: `hsl(${a.accent})` }}
              >
                <Icon name={a.icon} size={18} strokeWidth={2.25} />
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-fg">{a.name}</span>
                  {a.id === "hermes" ? (
                    <span className="chip bg-brand-soft text-brand">lead</span>
                  ) : null}
                </div>
                <div className="text-2xs font-medium" style={{ color: `hsl(${a.accent})` }}>
                  {a.title}
                </div>
              </div>
            </div>
            <p className="mt-2.5 text-2xs leading-relaxed text-fg-muted">{a.description}</p>
            <div className="mt-2.5 flex flex-wrap gap-1">
              {a.owns.map((o) => (
                <span key={o} className="rounded bg-bg-sunken px-1.5 py-0.5 text-2xs text-fg-subtle">
                  {o}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
