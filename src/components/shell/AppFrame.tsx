"use client";

import type { ReactNode } from "react";
import { MarketProvider } from "@/components/providers/market";
import { Sidebar, MobileNav } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <MarketProvider>
      <Sidebar />
      <div className="md:pl-60">
        <Topbar />
        <MobileNav />
        <main className="mx-auto max-w-[1540px] p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    </MarketProvider>
  );
}
