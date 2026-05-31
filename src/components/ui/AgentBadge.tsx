"use client";

import { AGENTS, type AgentId } from "@/lib/agents/registry";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

/**
 * An agent's identity chip. Used to attribute a panel, finding or column to the
 * agent that produced it — the visible thread of "which agent is doing what".
 */
export function AgentBadge({
  id,
  variant = "subtle",
  showTitle = false,
  size = "md",
  className,
}: {
  id: AgentId;
  variant?: "subtle" | "solid" | "plain";
  showTitle?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const a = AGENTS[id];
  const box =
    size === "lg" ? "h-7 w-7 rounded-lg" : size === "sm" ? "h-4 w-4 rounded" : "h-5 w-5 rounded-md";
  const iconSize = size === "lg" ? 16 : size === "sm" ? 11 : 13;
  const textCls = size === "lg" ? "text-sm" : size === "sm" ? "text-2xs" : "text-xs";

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn("grid place-items-center", box)}
        style={
          variant === "solid"
            ? { background: `hsl(${a.accent})`, color: "white" }
            : { background: `hsl(${a.accent} / 0.15)`, color: `hsl(${a.accent})` }
        }
      >
        <Icon name={a.icon} size={iconSize} strokeWidth={2.25} />
      </span>
      <span className={cn("font-semibold leading-none text-fg", textCls)}>
        {a.name}
        {showTitle ? (
          <span className="ml-1 font-normal text-fg-subtle">{a.title}</span>
        ) : null}
      </span>
    </span>
  );
}

export function AgentDotName({ id }: { id: AgentId }) {
  const a = AGENTS[id];
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-fg-muted">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${a.accent})` }} />
      {a.name}
    </span>
  );
}
