"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";
import { BrandMark } from "./BrandMark";
import { NAV } from "./nav";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-bg-elev md:flex">
      <div className="flex h-14 items-center border-b border-border px-4">
        <BrandMark />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                active
                  ? "bg-brand/10 text-brand"
                  : "text-fg-muted hover:bg-bg-sunken hover:text-fg",
              )}
            >
              <Icon name={item.icon} size={17} strokeWidth={active ? 2.4 : 2} />
              <span className="flex-1">{item.label}</span>
              {item.hint ? (
                <span className="text-2xs text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100">
                  {item.hint}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <div className="rounded-lg bg-bg-sunken px-3 py-2.5">
          <div className="flex items-center gap-2 text-2xs font-semibold text-fg">
            <Icon name="route" size={13} className="text-brand" />
            Hermes desk
          </div>
          <p className="mt-1 text-2xs leading-relaxed text-fg-subtle">
            6 specialist agents coordinate every view. Open Agents to trace them.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-14 z-20 flex gap-1 overflow-x-auto border-b border-border bg-bg-elev/95 px-2 py-1.5 backdrop-blur md:hidden">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-2xs font-medium",
              active ? "bg-brand/10 text-brand" : "text-fg-muted",
            )}
          >
            <Icon name={item.icon} size={14} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
