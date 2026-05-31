"use client";

import type { ChainAnalytics, OptionChain } from "@/lib/data/types";
import { currencySymbol, num } from "@/lib/utils";

/**
 * ATM straddle price through the session. The straddle is the market's own
 * estimate of the move; watching it intraday shows volatility being bid or
 * bled. The historical path is synthesised (★) and anchored to the live ATM
 * straddle at the right edge — replace with the broker's minute series when
 * the feed is attached.
 */
export function StraddleChart({
  chain,
  analytics,
  height = 220,
}: {
  chain: OptionChain;
  analytics: ChainAnalytics;
  height?: number;
}) {
  const series = buildSeries(chain, analytics.atmStraddle);
  const W = 760;
  const H = height;
  const pad = { l: 48, r: 14, t: 16, b: 22 };
  const vals = series.map((p) => p.v);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const padV = (hi - lo) * 0.18 || 1;
  lo -= padV;
  hi += padV;

  const xS = (i: number) => pad.l + (i / (series.length - 1)) * (W - pad.l - pad.r);
  const yS = (v: number) => pad.t + ((hi - v) / (hi - lo)) * (H - pad.t - pad.b);

  const line = series.map((p, i) => `${i ? "L" : "M"} ${xS(i).toFixed(1)} ${yS(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L ${xS(series.length - 1).toFixed(1)} ${(H - pad.b).toFixed(1)} L ${xS(0).toFixed(1)} ${(H - pad.b).toFixed(1)} Z`;

  const open = series[0].v;
  const last = series[series.length - 1].v;
  const up = last >= open;
  const stroke = up ? "var(--call)" : "var(--put)";
  const sym = currencySymbol(chain.instrument.currency);
  const labels = chain.instrument.region === "IN" ? ["09:15", "12:00", "15:30"] : ["09:30", "12:45", "16:00"];

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-2xs tnum">
        <span className="text-fg-subtle">
          O <span className="text-fg-muted">{sym}{num(open)}</span>
          <span className="mx-1.5">H <span className="text-fg-muted">{sym}{num(Math.max(...vals))}</span></span>
          L <span className="text-fg-muted">{sym}{num(Math.min(...vals))}</span>
        </span>
        <span className={up ? "text-call" : "text-put"}>
          {sym}{num(last)} ({up ? "+" : ""}{num(((last - open) / open) * 100)}%)
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="ATM straddle intraday">
        {[hi - padV, (hi + lo) / 2, lo + padV].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={yS(v)} y2={yS(v)} stroke="hsl(var(--border))" strokeWidth={0.6} strokeDasharray="3 3" />
            <text x={pad.l - 5} y={yS(v) + 3} textAnchor="end" className="fill-fg-subtle tnum" fontSize={9}>
              {sym}{num(v, 0)}
            </text>
          </g>
        ))}
        {/* open baseline */}
        <line x1={pad.l} x2={W - pad.r} y1={yS(open)} y2={yS(open)} stroke="hsl(var(--fg-subtle))" strokeWidth={0.7} strokeDasharray="2 4" />
        <path d={area} fill={`hsl(${stroke} / 0.12)`} />
        <path d={line} fill="none" stroke={`hsl(${stroke})`} strokeWidth={1.6} strokeLinejoin="round" />
        <circle cx={xS(series.length - 1)} cy={yS(last)} r={3} fill={`hsl(${stroke})`} />
        {labels.map((lb, i) => (
          <text key={lb} x={pad.l + (i / (labels.length - 1)) * (W - pad.l - pad.r)} y={H - pad.b + 12} textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"} className="fill-fg-subtle tnum" fontSize={9}>
            {lb}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** Deterministic intraday path anchored to the live straddle at the right edge. */
function buildSeries(chain: OptionChain, current: number): { v: number }[] {
  const n = 78;
  const seedStr = `${chain.instrument.symbol}:${chain.expiry}:${new Date(chain.builtAt).toISOString().slice(0, 10)}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rng = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
  const out: { v: number }[] = [];
  let v = current * (0.92 + rng() * 0.16);
  const mean = current * (0.95 + rng() * 0.1);
  for (let i = 0; i < n; i++) {
    const revert = (mean - v) * 0.05;
    const shock = (rng() - 0.5) * current * 0.03;
    v = Math.max(current * 0.4, v + revert + shock);
    out.push({ v });
  }
  out[out.length - 1] = { v: current }; // pin live value at the right edge
  return out;
}
