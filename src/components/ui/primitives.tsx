"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type Tone = "neutral" | "brand" | "call" | "put" | "warn" | "info" | "sim";

const TONE_BG: Record<Tone, string> = {
  neutral: "bg-bg-sunken text-fg-muted",
  brand: "bg-brand-soft text-brand",
  call: "bg-call-soft text-call",
  put: "bg-put-soft text-put",
  warn: "bg-warn/15 text-warn",
  info: "bg-info/15 text-info",
  sim: "bg-sim/15 text-sim",
};

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-fg-subtle",
  brand: "bg-brand",
  call: "bg-call",
  put: "bg-put",
  warn: "bg-warn",
  info: "bg-info",
  sim: "bg-sim",
};

export function severityTone(s: "info" | "positive" | "watch" | "alert"): Tone {
  return s === "positive" ? "call" : s === "watch" ? "warn" : s === "alert" ? "put" : "info";
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("card", className)}>{children}</div>;
}

export function Panel({
  title,
  eyebrow,
  right,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card flex flex-col", className)}>
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 pb-3 pt-3.5">
        <div className="min-w-0">
          {eyebrow ? <div className="label-eyebrow mb-1">{eyebrow}</div> : null}
          <h3 className="panel-title truncate">{title}</h3>
        </div>
        {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
      </header>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Chip({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span className={cn("chip", TONE_BG[tone], className)}>
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[tone])} /> : null}
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral", pulse }: { tone?: Tone; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse ? (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-pulse-soft rounded-full opacity-70",
            TONE_DOT[tone],
          )}
        />
      ) : null}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", TONE_DOT[tone])} />
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "call" | "put" | "fg";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="label-eyebrow mb-1 truncate">{label}</div>
      <div
        className={cn(
          "tnum text-[15px] font-semibold leading-none",
          tone === "call" ? "text-call" : tone === "put" ? "text-put" : "text-fg",
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-2xs text-fg-subtle">{sub}</div> : null}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { label: ReactNode; value: T }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-bg-sunken p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md font-medium transition-colors focus-ring",
            size === "sm" ? "px-2 py-1 text-2xs" : "px-2.5 py-1 text-xs",
            o.value === value
              ? "bg-panel text-fg shadow-card"
              : "text-fg-subtle hover:text-fg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse-soft rounded-md bg-bg-sunken", className)} />;
}

export function Tooltip({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-bg-elev px-2 py-1 text-2xs text-fg-muted shadow-pop group-hover/tip:block">
        {label}
      </span>
    </span>
  );
}
