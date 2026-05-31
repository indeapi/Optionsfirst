"use client";

import { useMemo } from "react";
import { provider } from "@/lib/data/provider";
import { useAppStore } from "@/lib/store/app";
import { useTheme } from "@/lib/hooks/useTheme";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel, Segmented } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { BrandMark } from "@/components/shell/BrandMark";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const refreshMs = useAppStore((s) => s.refreshMs);
  const setRefreshMs = useAppStore((s) => s.setRefreshMs);
  const statuses = useMemo(() => provider.brokerStatuses(), []);

  return (
    <>
      <PageHeader title="Settings" desc="Feeds, refresh cadence and appearance." icon="settings" />

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel eyebrow="Appearance" title="Theme">
          <div className="flex items-center justify-between">
            <p className="text-2xs text-fg-muted">Dark for the desk, light for daylight. Your choice is remembered.</p>
            <Segmented
              value={theme}
              onChange={(v) => setTheme(v)}
              options={[
                { label: <span className="flex items-center gap-1"><Icon name="moon" size={12} /> Dark</span>, value: "dark" },
                { label: <span className="flex items-center gap-1"><Icon name="sun" size={12} /> Light</span>, value: "light" },
              ]}
            />
          </div>
        </Panel>

        <Panel eyebrow="Live data" title="Refresh cadence">
          <div className="flex items-center justify-between">
            <p className="text-2xs text-fg-muted">How often the market view re-pulls and re-runs the agents.</p>
            <Segmented
              value={String(refreshMs)}
              onChange={(v) => setRefreshMs(Number(v))}
              options={[
                { label: "2s", value: "2000" },
                { label: "4s", value: "4000" },
                { label: "8s", value: "8000" },
              ]}
            />
          </div>
        </Panel>

        <Panel className="lg:col-span-2" eyebrow="Brokers" title="Market data connections">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {statuses.map((s) => (
              <div key={s.source} className="rounded-lg border border-border bg-panel-2 p-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-2xs font-bold text-brand">
                    {s.region}
                  </span>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-fg">{s.source}</div>
                    <div className="text-2xs text-fg-subtle">
                      {s.region === "IN" ? "Zerodha Kite · NSE F&O" : "Interactive Brokers · OPRA"}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-2xs font-medium ${
                      s.connected ? "border-call/30 bg-call/10 text-call" : "border-sim/30 bg-sim/10 text-sim"
                    }`}
                  >
                    {s.connected ? <span className="h-1.5 w-1.5 rounded-full bg-call" /> : <Icon name="star" size={9} strokeWidth={2.5} />}
                    {s.connected ? "LIVE" : "SIM"}
                  </span>
                </div>
                <p className="mt-2 text-2xs text-fg-muted">{s.message}</p>
                <div className="mt-2 flex items-start gap-1.5 rounded-md bg-bg-sunken px-2 py-1.5">
                  <Icon name="info" size={12} className="mt-0.5 shrink-0 text-fg-subtle" />
                  <p className="text-2xs text-fg-subtle">{s.howToConnect}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="lg:col-span-2" eyebrow="About" title="Options First">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BrandMark />
            <p className="max-w-xl text-2xs leading-relaxed text-fg-muted">
              Industrial-grade options analytics across US (IBKR) and Indian (Zerodha Kite) markets. World-class OI,
              straddle and payoff visualisation, strategies ranked to the live tape, and the Hermes multi-agent desk —
              with the real data delay on every value and a ★ on anything simulated.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
