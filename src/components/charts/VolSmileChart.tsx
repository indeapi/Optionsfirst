"use client";

import type { OptionChain } from "@/lib/data/types";

/**
 * Implied-volatility smile / skew. Plots call IV and put IV across strikes so
 * the shape of the surface — and the put-over-call skew that drives strategy
 * selection — is visible at a glance.
 */
export function VolSmileChart({
  chain,
  maxStrikes = 24,
  height = 220,
}: {
  chain: OptionChain;
  maxStrikes?: number;
  height?: number;
}) {
  const atmIdx = chain.rows.findIndex((r) => r.strike === chain.atmStrike);
  const half = Math.floor(maxStrikes / 2);
  const start = Math.max(0, Math.min(chain.rows.length - maxStrikes, atmIdx - half));
  const rows = chain.rows.slice(start, start + maxStrikes);
  if (rows.length === 0) return null;

  const W = 760;
  const H = height;
  const pad = { l: 40, r: 14, t: 16, b: 24 };
  const strikes = rows.map((r) => r.strike);
  const minS = strikes[0];
  const maxS = strikes[strikes.length - 1];
  const ivs = rows.flatMap((r) => [r.call.iv, r.put.iv]);
  let minIV = Math.min(...ivs);
  let maxIV = Math.max(...ivs);
  const padIV = (maxIV - minIV) * 0.15 || 0.01;
  minIV -= padIV;
  maxIV += padIV;

  const xS = (s: number) => pad.l + ((s - minS) / (maxS - minS || 1)) * (W - pad.l - pad.r);
  const yS = (iv: number) => pad.t + ((maxIV - iv) / (maxIV - minIV || 1)) * (H - pad.t - pad.b);

  const callLine = rows.map((r, i) => `${i ? "L" : "M"} ${xS(r.strike).toFixed(1)} ${yS(r.call.iv).toFixed(1)}`).join(" ");
  const putLine = rows.map((r, i) => `${i ? "L" : "M"} ${xS(r.strike).toFixed(1)} ${yS(r.put.iv).toFixed(1)}`).join(" ");

  const yTicks = [maxIV, (maxIV + minIV) / 2, minIV];

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-3 text-2xs text-fg-subtle">
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-3 rounded bg-call" /> Call IV
        </span>
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-3 rounded bg-put" /> Put IV
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="IV smile">
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={yS(v)} y2={yS(v)} stroke="hsl(var(--border))" strokeWidth={0.6} strokeDasharray="3 3" />
            <text x={pad.l - 5} y={yS(v) + 3} textAnchor="end" className="fill-fg-subtle tnum" fontSize={9}>
              {(v * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        {/* ATM marker */}
        <line x1={xS(chain.atmStrike)} x2={xS(chain.atmStrike)} y1={pad.t} y2={H - pad.b} stroke="hsl(var(--brand))" strokeWidth={1} strokeDasharray="2 2" />
        <text x={xS(chain.atmStrike)} y={pad.t - 4} textAnchor="middle" className="fill-brand tnum" fontSize={9} fontWeight={700}>
          ATM
        </text>
        <path d={putLine} fill="none" stroke="hsl(var(--put))" strokeWidth={1.6} strokeLinejoin="round" />
        <path d={callLine} fill="none" stroke="hsl(var(--call))" strokeWidth={1.6} strokeLinejoin="round" />
        {/* X labels: ends + atm */}
        {[rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]].map((r) => (
          <text key={r.strike} x={xS(r.strike)} y={H - pad.b + 12} textAnchor="middle" className="fill-fg-subtle tnum" fontSize={9}>
            {r.strike.toLocaleString()}
          </text>
        ))}
      </svg>
    </div>
  );
}
