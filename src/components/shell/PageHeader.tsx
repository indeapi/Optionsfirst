"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

export function PageHeader({
  title,
  desc,
  icon,
  right,
}: {
  title: string;
  desc?: string;
  icon?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {icon ? (
          <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand">
            <Icon name={icon} size={18} />
          </span>
        ) : null}
        <div>
          <h1 className="text-lg font-bold tracking-tight text-fg">{title}</h1>
          {desc ? <p className="mt-0.5 max-w-2xl text-2xs text-fg-muted sm:text-xs">{desc}</p> : null}
        </div>
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}
