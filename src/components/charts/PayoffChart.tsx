"use client";

import type { PayoffResult } from "@/lib/quant/payoff";
import { compact, currencySymbol } from "@/lib/utils";

/**
 * Strategy payoff-at-expiry diagram. Profit shaded green, loss shaded red,
 * with breakevens, the live spot, and the IV-implied expected-move band so the
 * trader can see whether the profit zone actually covers the likely range.
 */
export function PayoffChart({
  payoff,
  spot,
  currency,
  expectedMovePct,
  height = 280,
}: {
  payoff: PayoffResult;
  spot: number;
  currency: "INR" | "USD";
  expectedMovePct?: number;
  height?: number;
}) {
  const W = 760;
  const H = height;
  const pad = { l: 58, r: 16, t: 16, b: 26 };
  const pts = payoff.points;
  if (pts.length === 0) return null;

  const minP = pts[0].price;
  const maxP = pts[pts.length - 1].price;
  let minY = Math.min(0, ...pts.map((p) => p.pnl));
  let maxY = Math.max(0, ...pts.map((p) => p.pnl));
  const padY = (maxY - minY) * 0.12 || 1;
  minY -= padY;
  maxY += padY;

  const xS = (price: number) =>
    pad.l + ((price - minP) / (maxP - minP)) * (W - pad.l - pad.r);
  const yS = (pnl: number) =>
    pad.t + ((maxY - pnl) / (maxY - minY)) * (H - pad.t - pad.b);

  const zeroY = yS(0);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xS(p.price).toFixed(1)} ${yS(p.pnl).toFixed(1)}`).join(" ");
  const area =
    `M ${xS(minP).toFixed(1)} ${zeroY.toFixed(1)} ` +
    pts.map((p) => `L ${xS(p.price).toFixed(1)} ${yS(p.pnl).toFixed(1)}`).join(" ") +
    ` L ${xS(maxP).toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const sym = currencySymbol(currency);
  const fmt = (v: number) => `${v < 0 ? "-" : ""}${sym}${compact(Math.abs(v))}`;
  const emLo = expectedMovePct ? spot * (1 - expectedMovePct / 100) : null;
  const emHi = expectedMovePct ? spot * (1 + expectedMovePct / 100) : null;

  // Y gridlines.
  const yTicks = [maxY, (maxY + minY) / 2 > 0 ? maxY / 2 : 0, 0, minY / 2, minY].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Payoff diagram">
      <defs>
        <clipPath id="clip-above">
          <rect x={0} y={0} width={W} height={zeroY} />
        </clipPath>
        <clipPath id="clip-below">
          <rect x={0} y={zeroY} width={W} height={H - zeroY} />
        </clipPath>
      </defs>

      {/* Expected-move band */}
      {emLo && emHi ? (
        <g>
          <rect
            x={xS(emLo)}
            y={pad.t}
            width={Math.max(0, xS(emHi) - xS(emLo))}
            height={H - pad.t - pad.b}
            fill="hsl(var(--brand) / 0.06)"
          />
          <text x={(xS(emLo) + xS(emHi)) / 2} y={pad.t + 10} textAnchor="middle" className="fill-fg-subtle" fontSize={9}>
            ±{expectedMovePct!.toFixed(1)}% expected
          </text>
        </g>
      ) : null}

      {/* Y gridlines + labels */}
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={pad.l}
            x2={W - pad.r}
            y1={yS(v)}
            y2={yS(v)}
            stroke="hsl(var(--border))"
            strokeWidth={v === 0 ? 1.2 : 0.6}
            strokeDasharray={v === 0 ? "0" : "3 3"}
          />
          <text x={pad.l - 6} y={yS(v) + 3} textAnchor="end" className="fill-fg-subtle tnum" fontSize={9}>
            {fmt(v)}
          </text>
        </g>
      ))}

      {/* P/L areas */}
      <path d={area} fill="hsl(var(--call) / 0.16)" clipPath="url(#clip-above)" />
      <path d={area} fill="hsl(var(--put) / 0.16)" clipPath="url(#clip-below)" />
      <path d={line} fill="none" stroke="hsl(var(--fg))" strokeWidth={1.6} strokeLinejoin="round" />

      {/* Breakevens */}
      {payoff.breakevens.map((be) => (
        <g key={be}>
          <line x1={xS(be)} x2={xS(be)} y1={pad.t} y2={H - pad.b} stroke="hsl(var(--warn))" strokeWidth={0.8} strokeDasharray="2 3" />
          <text x={xS(be)} y={H - pad.b + 10} textAnchor="middle" className="fill-warn tnum" fontSize={9}>
            {be.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </text>
        </g>
      ))}

      {/* Spot */}
      <line x1={xS(spot)} x2={xS(spot)} y1={pad.t} y2={H - pad.b} stroke="hsl(var(--brand))" strokeWidth={1.1} />
      <circle cx={xS(spot)} cy={zeroY} r={3} fill="hsl(var(--brand))" />
      <text x={xS(spot)} y={pad.t - 4} textAnchor="middle" className="fill-brand tnum" fontSize={9} fontWeight={700}>
        {spot.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </text>
    </svg>
  );
}
