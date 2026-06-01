"use client";

import { useMarket } from "@/components/providers/market";
import { bsPrice } from "@/lib/quant/blackScholes";
import { PageHeader } from "@/components/shell/PageHeader";
import { ExpiryPicker } from "@/components/shell/ExpiryPicker";
import { Panel, Card } from "@/components/ui/primitives";
import { LoadingGrid } from "@/components/ui/Loading";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { StraddleChart } from "@/components/charts/StraddleChart";
import { cn, currencySymbol, money, num } from "@/lib/utils";

export default function PremiumDecayPage() {
  const { snapshot, loading } = useMarket();

  if (loading || !snapshot) {
    return (
      <>
        <PageHeader title="Premium decay" desc="Loading…" icon="activity" />
        <LoadingGrid />
      </>
    );
  }

  const { chain, analytics } = snapshot;
  const dte = snapshot.dte;
  const spot = chain.spot;
  const r = chain.instrument.region === "IN" ? 0.065 : 0.045;
  const atmRow = chain.rows.find((x) => x.strike === chain.atmStrike) ?? chain.rows[Math.floor(chain.rows.length / 2)];
  const sigma = (atmRow.call.iv + atmRow.put.iv) / 2;
  const ccy = chain.instrument.currency;
  const sym = currencySymbol(ccy);

  // Straddle value as a function of days-to-expiry (theta decay curve).
  const N = 48;
  const curve: { d: number; v: number }[] = [];
  for (let i = 0; i < N; i++) {
    const d = (dte * (N - 1 - i)) / (N - 1); // dte → 0
    const t = Math.max(0.25 / 365, d / 365);
    const v =
      bsPrice({ s: spot, k: chain.atmStrike, t, r, sigma, right: "CE" }) +
      bsPrice({ s: spot, k: chain.atmStrike, t, r, sigma, right: "PE" });
    curve.push({ d, v });
  }
  const straddleNow = curve[0].v;
  const thetaDay = atmRow.call.greeks.theta + atmRow.put.greeks.theta; // negative for long
  // Decay over the next week.
  const oneWeek = curve.find((p) => p.d <= Math.max(0, dte - 7)) ?? curve[curve.length - 1];
  const weekDecayPct = ((straddleNow - oneWeek.v) / straddleNow) * 100;

  return (
    <>
      <PageHeader
        title="Premium decay"
        desc={`${chain.instrument.symbol} — how the ATM straddle bleeds time value into expiry, and the accelerating decay near the end.`}
        icon="activity"
        right={<ExpiryPicker />}
      />

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="card-pad">
            <div className="label-eyebrow">ATM straddle</div>
            <div className="tnum mt-1 text-xl font-bold text-fg">{money(analytics.atmStraddle, ccy, 2)}</div>
            <div className="mt-0.5 text-3xs text-fg-subtle">±{analytics.expectedMovePct.toFixed(1)}% expected move</div>
          </Card>
          <Card className="card-pad">
            <div className="label-eyebrow">Theta / day</div>
            <div className="tnum mt-1 text-xl font-bold text-put">{sym}{num(Math.abs(thetaDay), 2)}</div>
            <div className="mt-0.5 text-3xs text-fg-subtle">time value lost daily</div>
          </Card>
          <Card className="card-pad">
            <div className="label-eyebrow">Decays this week</div>
            <div className="tnum mt-1 text-xl font-bold text-fg">{weekDecayPct.toFixed(0)}%</div>
            <div className="mt-0.5 text-3xs text-fg-subtle">of current premium</div>
          </Card>
          <Card className="card-pad">
            <div className="label-eyebrow">Days to expiry</div>
            <div className="tnum mt-1 text-xl font-bold text-fg">{dte}</div>
            <div className="mt-0.5 text-3xs text-fg-subtle">decay accelerates near 0</div>
          </Card>
        </div>

        <Panel eyebrow="Theta" title="ATM straddle value into expiry" right={<AgentBadge id="helios" />}>
          <DecayChart curve={curve} dte={dte} ccy={ccy} />
          <p className="mt-2 text-2xs leading-relaxed text-fg-muted">
            The curve isn&apos;t a straight line — time value erodes slowly far from expiry and then accelerates into the
            last week. That convexity is why option <span className="font-semibold text-fg">sellers</span> favour the final
            stretch and <span className="font-semibold text-fg">buyers</span> avoid holding through it.
          </p>
        </Panel>

        <Panel eyebrow="Straddle" title="ATM straddle — intraday" right={<AgentBadge id="helios" />}>
          <StraddleChart chain={chain} analytics={analytics} />
        </Panel>
      </div>
    </>
  );
}

function DecayChart({ curve, dte, ccy }: { curve: { d: number; v: number }[]; dte: number; ccy: "INR" | "USD" }) {
  const W = 760;
  const H = 240;
  const pad = { l: 46, r: 14, t: 14, b: 24 };
  const maxV = Math.max(...curve.map((p) => p.v));
  const xS = (d: number) => pad.l + ((dte - d) / (dte || 1)) * (W - pad.l - pad.r); // dte at left → 0 at right
  const yS = (v: number) => pad.t + (1 - v / (maxV || 1)) * (H - pad.t - pad.b);
  const line = curve.map((p, i) => `${i ? "L" : "M"} ${xS(p.d).toFixed(1)} ${yS(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L ${xS(0).toFixed(1)} ${(H - pad.b).toFixed(1)} L ${xS(dte).toFixed(1)} ${(H - pad.b).toFixed(1)} Z`;
  const sym = currencySymbol(ccy);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Premium decay curve">
      {[maxV, maxV / 2, 0].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={yS(v)} y2={yS(v)} stroke="hsl(var(--border))" strokeWidth={0.6} strokeDasharray="3 3" />
          <text x={pad.l - 5} y={yS(v) + 3} textAnchor="end" className="fill-fg-subtle tnum" fontSize={9}>{sym}{num(v, 0)}</text>
        </g>
      ))}
      <path d={area} fill="hsl(var(--put) / 0.12)" />
      <path d={line} fill="none" stroke="hsl(var(--put))" strokeWidth={1.8} strokeLinejoin="round" />
      {[dte, Math.round(dte / 2), 0].map((d, i) => (
        <text key={i} x={xS(d)} y={H - pad.b + 13} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"} className="fill-fg-subtle tnum" fontSize={9}>
          {d}d
        </text>
      ))}
    </svg>
  );
}
