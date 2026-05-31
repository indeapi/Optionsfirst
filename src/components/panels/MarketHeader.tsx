"use client";

import type { MarketSnapshot } from "@/lib/data/provider";
import { compact, money, num } from "@/lib/utils";
import { Card, Chip, type Tone } from "@/components/ui/primitives";
import { SourceTag } from "@/components/ui/SourceTag";
import { AgentDotName } from "@/components/ui/AgentBadge";
import type { AgentId } from "@/lib/agents/registry";
import type { Provenance } from "@/lib/data/types";
import type { ReactNode } from "react";

const DIR_TONE: Record<MarketSnapshot["condition"]["direction"], Tone> = {
  bullish: "call",
  bearish: "put",
  neutral: "info",
  volatile: "warn",
};

export function MarketHeader({ snapshot }: { snapshot: MarketSnapshot }) {
  const { chain, analytics, condition } = snapshot;
  const ccy = chain.instrument.currency;
  const region = chain.instrument.region;
  const maxPainGap = analytics.maxPain - chain.spot;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <Kpi
        agent="hermes"
        label="Market bias"
        value={
          <Chip tone={DIR_TONE[condition.direction]} className="text-xs capitalize">
            {condition.direction}
          </Chip>
        }
        sub={`Trend strength ${(condition.trendStrength * 100).toFixed(0)}% · ${condition.dte}d to expiry`}
      />
      <Kpi
        agent="argus"
        label="Put-Call Ratio"
        value={analytics.pcr.toFixed(2)}
        sub={analytics.pcr > 1.1 ? "Put-heavy / supportive" : analytics.pcr < 0.9 ? "Call-heavy / capped" : "Balanced"}
        prov={chain.freshness.pcr}
      />
      <Kpi
        agent="argus"
        label="Max pain"
        value={analytics.maxPain.toLocaleString()}
        sub={`${maxPainGap >= 0 ? "+" : ""}${num(maxPainGap, 0)} vs spot`}
        prov={chain.freshness.maxPain}
      />
      <Kpi
        agent="helios"
        label="IV rank"
        value={`${(analytics.ivRank * 100).toFixed(0)}`}
        sub={`${condition.ivRegime} · ATM IV ${(analytics.atmIV * 100).toFixed(1)}%`}
        prov={chain.freshness.iv}
      />
      <Kpi
        agent="helios"
        label="Expected move"
        value={`±${analytics.expectedMovePct.toFixed(1)}%`}
        sub={`Straddle ${money(analytics.atmStraddle, ccy, 2)}`}
        prov={chain.freshness.ltp}
      />
      <Kpi
        agent="argus"
        label="Total OI"
        value={compact(analytics.totalCallOI + analytics.totalPutOI, region)}
        sub={`C ${compact(analytics.totalCallOI, region)} · P ${compact(analytics.totalPutOI, region)}`}
        prov={chain.freshness.oi}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  agent,
  prov,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  agent: AgentId;
  prov?: Provenance;
}) {
  return (
    <Card className="card-pad flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="label-eyebrow">{label}</span>
        <AgentDotName id={agent} />
      </div>
      <div className="tnum text-xl font-bold leading-none text-fg">{value}</div>
      {sub ? <div className="text-2xs text-fg-subtle">{sub}</div> : null}
      {prov ? <SourceTag prov={prov} className="self-start" /> : null}
    </Card>
  );
}
