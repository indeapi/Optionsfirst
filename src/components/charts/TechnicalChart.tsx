"use client";

import { useState, useMemo } from "react";
import { cn, money } from "@/lib/utils";
import type { Leg } from "@/lib/quant/payoff";
import { buildPayoff } from "@/lib/quant/payoff";

interface Candlestick {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma?: number;
  ema?: number;
  bbUpper?: number;
  bbLower?: number;
  bbMiddle?: number;
  rsi?: number;
}

export function TechnicalChart({
  legs,
  spot,
  lotSize,
  currency,
  region,
}: {
  legs: Leg[];
  spot: number;
  lotSize: number;
  currency: string;
  region: string;
}) {
  const [chartMode, setChartMode] = useState<"technical" | "payoff">("technical");
  const [activeIndicator, setActiveIndicator] = useState<{
    sma: boolean;
    ema: boolean;
    bb: boolean;
    rsi: boolean;
  }>({
    sma: true,
    ema: true,
    bb: true,
    rsi: true,
  });

  // 1. Generate realistic historical candlestick dataset around the current spot price
  const historyData = useMemo<Candlestick[]>(() => {
    const data: Candlestick[] = [];
    const count = 40;
    let currentVal = spot * 0.95; // start slightly lower

    // Seeded random number generator
    let seed = 42;
    const random = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    // Build raw price points
    for (let i = 0; i < count; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (count - i));
      const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

      const trend = (i / count) * (spot - spot * 0.95) + (random() - 0.5) * (spot * 0.015);
      const close = spot * 0.95 + trend;
      const open = i === 0 ? spot * 0.94 : data[i - 1].close;

      const high = Math.max(open, close) + random() * (spot * 0.01);
      const low = Math.min(open, close) - random() * (spot * 0.01);
      const volume = Math.floor(100000 + random() * 800000);

      data.push({
        time: dateStr,
        open,
        high,
        low,
        close,
        volume,
      });
    }

    // Smooth last close to match the exact live spot price
    if (data.length > 0) {
      const last = data[data.length - 1];
      const diff = spot - last.close;
      last.close = spot;
      last.high = Math.max(last.high, spot);
      last.low = Math.min(last.low, spot);
    }

    // 2. Compute Indicators
    // SMA (10 period)
    const smaPeriod = 10;
    for (let i = smaPeriod - 1; i < count; i++) {
      const slice = data.slice(i - smaPeriod + 1, i + 1);
      const sum = slice.reduce((acc, d) => acc + d.close, 0);
      data[i].sma = sum / smaPeriod;
    }

    // EMA (12 period)
    const emaPeriod = 12;
    const k = 2 / (emaPeriod + 1);
    let prevEma = data[0].close;
    data[0].ema = prevEma;
    for (let i = 1; i < count; i++) {
      const ema = data[i].close * k + prevEma * (1 - k);
      data[i].ema = ema;
      prevEma = ema;
    }

    // Bollinger Bands (15 period, 2 Standard Deviations)
    const bbPeriod = 15;
    for (let i = bbPeriod - 1; i < count; i++) {
      const slice = data.slice(i - bbPeriod + 1, i + 1);
      const mean = slice.reduce((acc, d) => acc + d.close, 0) / bbPeriod;
      const variance = slice.reduce((acc, d) => acc + Math.pow(d.close - mean, 2), 0) / bbPeriod;
      const stdDev = Math.sqrt(variance);

      data[i].bbMiddle = mean;
      data[i].bbUpper = mean + 2 * stdDev;
      data[i].bbLower = mean - 2 * stdDev;
    }

    // RSI (14 period)
    const rsiPeriod = 14;
    let avgGain = 0;
    let avgLoss = 0;

    // Initialize average gain/loss
    for (let i = 1; i <= rsiPeriod; i++) {
      const diff = data[i].close - data[i - 1].close;
      if (diff > 0) avgGain += diff;
      else avgLoss += Math.abs(diff);
    }
    avgGain /= rsiPeriod;
    avgLoss /= rsiPeriod;

    if (data[rsiPeriod]) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      data[rsiPeriod].rsi = 100 - 100 / (1 + rs);
    }

    for (let i = rsiPeriod + 1; i < count; i++) {
      const diff = data[i].close - data[i - 1].close;
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;

      avgGain = (avgGain * 13 + gain) / 14;
      avgLoss = (avgLoss * 13 + loss) / 14;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      data[i].rsi = 100 - 100 / (1 + rs);
    }

    return data;
  }, [spot]);

  const [hoveredPoint, setHoveredPoint] = useState<{
    price: number;
    pnl: number;
    x: number;
    y: number;
  } | null>(null);

  // 3. Payoff math (up to 8 strikes combined)
  const payoff = useMemo(() => {
    return buildPayoff(legs, { spot, lotSize, span: 0.12 });
  }, [legs, spot, lotSize]);

  // 4. SVG Drawing Parameters
  const W = 800;
  const H_main = 280;
  const H_sub = 100;
  const pad = { l: 55, r: 50, t: 15, b: 20 };

  const renderTechnicalSVG = () => {
    // Filter active range to display properly in the viewport
    const visibleData = historyData.slice(5); // Show last 35 bars
    const N = visibleData.length;

    // Find price min/max bounds
    let minPrice = Math.min(...visibleData.map((d) => d.low));
    let maxPrice = Math.max(...visibleData.map((d) => d.high));
    if (activeIndicator.bb) {
      minPrice = Math.min(minPrice, ...visibleData.map((d) => d.bbLower ?? d.low));
      maxPrice = Math.max(maxPrice, ...visibleData.map((d) => d.bbUpper ?? d.high));
    }
    const priceRange = maxPrice - minPrice || 1;
    minPrice -= priceRange * 0.05;
    maxPrice += priceRange * 0.05;

    // RSI Bounds
    const minRsi = 0;
    const maxRsi = 100;

    // Coordinate helpers
    const getX = (idx: number) => pad.l + (idx / (N - 1)) * (W - pad.l - pad.r);
    const getYPrice = (val: number) =>
      pad.t + ((maxPrice - val) / (maxPrice - minPrice)) * (H_main - pad.t - pad.b);
    const getYRsi = (val: number) =>
      pad.t + ((maxRsi - val) / (maxRsi - minRsi)) * (H_sub - pad.t - pad.b);

    // Build Bollinger Bands Shaded Area Path
    let bbAreaPath = "";
    if (activeIndicator.bb) {
      const upperPoints = visibleData.map((d, i) => `${getX(i).toFixed(1)},${getYPrice(d.bbUpper ?? d.high).toFixed(1)}`);
      const lowerPoints = [...visibleData]
        .reverse()
        .map((d, i) => `${getX(N - 1 - i).toFixed(1)},${getYPrice(d.bbLower ?? d.low).toFixed(1)}`);
      bbAreaPath = `M ${upperPoints.join(" L ")} L ${lowerPoints.join(" L ")} Z`;
    }

    // Build SMA, EMA, and RSI lines
    let smaLine = "";
    let emaLine = "";
    let rsiLine = "";
    let bbMidLine = "";

    visibleData.forEach((d, i) => {
      const x = getX(i).toFixed(1);
      if (activeIndicator.sma && d.sma !== undefined) {
        smaLine += `${smaLine === "" ? "M" : "L"} ${x} ${getYPrice(d.sma).toFixed(1)}`;
      }
      if (activeIndicator.ema && d.ema !== undefined) {
        emaLine += `${emaLine === "" ? "M" : "L"} ${x} ${getYPrice(d.ema).toFixed(1)}`;
      }
      if (activeIndicator.bb && d.bbMiddle !== undefined) {
        bbMidLine += `${bbMidLine === "" ? "M" : "L"} ${x} ${getYPrice(d.bbMiddle).toFixed(1)}`;
      }
      if (activeIndicator.rsi && d.rsi !== undefined) {
        rsiLine += `${rsiLine === "" ? "M" : "L"} ${x} ${getYRsi(d.rsi).toFixed(1)}`;
      }
    });

    const priceTicks = [maxPrice, (maxPrice + minPrice) / 2, minPrice];

    return (
      <div className="space-y-4">
        {/* Main Price Chart */}
        <div className="relative rounded-lg border border-border bg-panel-2/30 shadow-inner p-1">
          <svg viewBox={`0 0 ${W} ${H_main}`} className="h-auto w-full">
            {/* Price Grid Lines */}
            {priceTicks.map((val, i) => (
              <g key={i}>
                <line
                  x1={pad.l}
                  x2={W - pad.r}
                  y1={getYPrice(val)}
                  y2={getYPrice(val)}
                  stroke="hsl(var(--border))"
                  strokeWidth={0.5}
                  strokeDasharray="2 3"
                />
                <text
                  x={W - pad.r + 5}
                  y={getYPrice(val) + 3}
                  className="fill-fg-subtle tnum"
                  fontSize={8}
                >
                  {val.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </text>
              </g>
            ))}

            {/* Bollinger Bands Area */}
            {activeIndicator.bb && bbAreaPath && (
              <path d={bbAreaPath} fill="rgba(59, 130, 246, 0.05)" />
            )}

            {/* Technical Lines */}
            {activeIndicator.bb && bbMidLine && (
              <path d={bbMidLine} fill="none" stroke="rgba(59, 130, 246, 0.6)" strokeWidth={1} strokeDasharray="3 3" />
            )}
            {activeIndicator.sma && smaLine && (
              <path d={smaLine} fill="none" stroke="hsl(var(--warn))" strokeWidth={1.5} />
            )}
            {activeIndicator.ema && emaLine && (
              <path d={emaLine} fill="none" stroke="rgb(168, 85, 247)" strokeWidth={1.5} />
            )}

            {/* Candlesticks & Volume overlay */}
            {visibleData.map((d, i) => {
              const x = getX(i);
              const up = d.close >= d.open;
              const openY = getYPrice(d.open);
              const closeY = getYPrice(d.close);
              const highY = getYPrice(d.high);
              const lowY = getYPrice(d.low);

              const color = up ? "hsl(var(--call))" : "hsl(var(--put))";
              const candleWidth = Math.max(4, (W - pad.l - pad.r) / N * 0.6);

              // Volume overlay (smaller bars at the bottom of the main chart)
              const maxVolInVisible = Math.max(...visibleData.map(v => v.volume));
              const volY = H_main - pad.b - (d.volume / maxVolInVisible) * 45;

              return (
                <g key={i}>
                  {/* Volume bar */}
                  <rect
                    x={x - candleWidth / 2}
                    y={volY}
                    width={candleWidth}
                    height={Math.max(1, H_main - pad.b - volY)}
                    fill={up ? "hsl(var(--call) / 0.15)" : "hsl(var(--put) / 0.15)"}
                  />

                  {/* Wick */}
                  <line x1={x} x2={x} y1={highY} y2={lowY} stroke={color} strokeWidth={1.2} />
                  {/* Body */}
                  <rect
                    x={x - candleWidth / 2}
                    y={Math.min(openY, closeY)}
                    width={candleWidth}
                    height={Math.max(1, Math.abs(openY - closeY))}
                    fill={up ? "transparent" : color}
                    stroke={color}
                    strokeWidth={1.2}
                  />
                </g>
              );
            })}

            {/* Current Spot Line */}
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={getYPrice(spot)}
              y2={getYPrice(spot)}
              stroke="hsl(var(--brand))"
              strokeWidth={1}
              strokeDasharray="4 2"
            />
            <rect
              x={W - pad.r - 2}
              y={getYPrice(spot) - 7}
              width={45}
              height={14}
              rx={3}
              fill="hsl(var(--brand))"
            />
            <text
              x={W - pad.r + 3}
              y={getYPrice(spot) + 3}
              className="fill-white font-bold tnum"
              fontSize={8.5}
            >
              {spot.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </text>

            {/* Strategy strikes overlay (dashed lines for legs) */}
            {legs.map((leg, li) => (
              <g key={li}>
                <line
                  x1={pad.l}
                  x2={W - pad.r}
                  y1={getYPrice(leg.strike)}
                  y2={getYPrice(leg.strike)}
                  stroke={leg.right === "CE" ? "hsl(var(--call) / 0.4)" : "hsl(var(--put) / 0.4)"}
                  strokeWidth={0.8}
                  strokeDasharray="3 3"
                />
                <text
                  x={pad.l + 5}
                  y={getYPrice(leg.strike) - 3}
                  className={cn("text-[7.5px] font-bold uppercase", leg.right === "CE" ? "fill-call" : "fill-put")}
                >
                  {leg.action} {leg.strike} {leg.right}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* RSI Sub panel */}
        {activeIndicator.rsi && (
          <div className="relative rounded-lg border border-border bg-panel-2/30 shadow-inner p-1">
            <div className="absolute left-2.5 top-2 text-[9px] font-bold text-fg-subtle uppercase">
              RSI (14)
            </div>
            <svg viewBox={`0 0 ${W} ${H_sub}`} className="h-auto w-full">
              {/* RSI Grid Lines at 30 and 70 */}
              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={getYRsi(30)}
                y2={getYRsi(30)}
                stroke="rgba(34, 197, 94, 0.3)"
                strokeWidth={0.8}
                strokeDasharray="2 2"
              />
              <text x={W - pad.r + 5} y={getYRsi(30) + 3} className="fill-green-400 tnum" fontSize={7.5}>
                30
              </text>

              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={getYRsi(70)}
                y2={getYRsi(70)}
                stroke="rgba(239, 68, 68, 0.3)"
                strokeWidth={0.8}
                strokeDasharray="2 2"
              />
              <text x={W - pad.r + 5} y={getYRsi(70) + 3} className="fill-red-400 tnum" fontSize={7.5}>
                70
              </text>

              {/* Shaded area between 30 and 70 */}
              <rect
                x={pad.l}
                y={getYRsi(70)}
                width={W - pad.l - pad.r}
                height={Math.max(0, getYRsi(30) - getYRsi(70))}
                fill="rgba(168, 85, 247, 0.025)"
              />

              {/* RSI Line */}
              {rsiLine && (
                <path d={rsiLine} fill="none" stroke="rgb(168, 85, 247)" strokeWidth={1.5} />
              )}

              {/* RSI Border axes */}
              <line x1={pad.l} x2={W - pad.r} y1={H_sub - pad.b} y2={H_sub - pad.b} stroke="hsl(var(--border))" strokeWidth={0.8} />

              {/* Time stamps */}
              {visibleData.map((d, i) => {
                if (i % 6 === 0) {
                  return (
                    <text
                      key={i}
                      x={getX(i)}
                      y={H_sub - 5}
                      textAnchor="middle"
                      className="fill-fg-subtle"
                      fontSize={8}
                    >
                      {d.time}
                    </text>
                  );
                }
                return null;
              })}
            </svg>
          </div>
        )}
      </div>
    );
  };

  const renderPayoffSVG = () => {
    const W_payoff = 800;
    const H_payoff = 320;
    const expPts = payoff.points;
    if (expPts.length === 0) return null;

    const minP = expPts[0].price;
    const maxP = expPts[expPts.length - 1].price;
    const allP = expPts.map((p) => p.pnl);
    let minY = Math.min(0, ...allP);
    let maxY = Math.max(0, ...allP);
    const padY = (maxY - minY) * 0.1 || 1;
    minY -= padY;
    maxY += padY;

    const xS = (price: number) => pad.l + ((price - minP) / (maxP - minP)) * (W_payoff - pad.l - pad.r);
    const yS = (pnl: number) => pad.t + ((maxY - pnl) / (maxY - minY)) * (H_payoff - pad.t - pad.b);

    const zeroY = yS(0);
    const expLine = expPts
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xS(p.price).toFixed(1)} ${yS(p.pnl).toFixed(1)}`)
      .join(" ");

    const expArea =
      `M ${xS(minP).toFixed(1)} ${zeroY.toFixed(1)} ` +
      expPts.map((p) => `L ${xS(p.price).toFixed(1)} ${yS(p.pnl).toFixed(1)}`).join(" ") +
      ` L ${xS(maxP).toFixed(1)} ${zeroY.toFixed(1)} Z`;

    const ccySymbol = currency === "INR" ? "₹" : "$";
    const yTicks = [maxY, 0, minY];

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const svgX = (x / rect.width) * W_payoff;
      const activeWidth = W_payoff - pad.l - pad.r;
      let pr = minP + ((svgX - pad.l) / activeWidth) * (maxP - minP);
      pr = Math.max(minP, Math.min(maxP, pr));

      const closest = expPts.reduce((prev, curr) =>
        Math.abs(curr.price - pr) < Math.abs(prev.price - pr) ? curr : prev
      , expPts[0]);

      if (closest) {
        setHoveredPoint({
          price: closest.price,
          pnl: closest.pnl,
          x: pad.l + ((closest.price - minP) / (maxP - minP)) * activeWidth,
          y: pad.t + ((maxY - closest.pnl) / (maxY - minY)) * (H_payoff - pad.t - pad.b),
        });
      }
    };

    return (
      <div className="relative rounded-lg border border-border bg-panel-2/30 shadow-inner p-1">
        <svg
          viewBox={`0 0 ${W_payoff} ${H_payoff}`}
          className="h-auto w-full cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <clipPath id="clip-above">
              <rect x={0} y={0} width={W_payoff} height={zeroY} />
            </clipPath>
            <clipPath id="clip-below">
              <rect x={0} y={zeroY} width={W_payoff} height={H_payoff - zeroY} />
            </clipPath>
          </defs>

          {/* Grid lines */}
          {yTicks.map((v, i) => (
            <g key={i}>
              <line
                x1={pad.l}
                x2={W_payoff - pad.r}
                y1={yS(v)}
                y2={yS(v)}
                stroke="hsl(var(--border))"
                strokeWidth={v === 0 ? 1.2 : 0.6}
                strokeDasharray={v === 0 ? "0" : "2 3"}
              />
              <text x={pad.l - 6} y={yS(v) + 3} textAnchor="end" className="fill-fg-subtle tnum" fontSize={9}>
                {ccySymbol}
                {Math.round(v).toLocaleString()}
              </text>
            </g>
          ))}

          {/* Shaded payoff regions */}
          <path d={expArea} fill="hsl(var(--call) / 0.12)" clipPath="url(#clip-above)" />
          <path d={expArea} fill="hsl(var(--put) / 0.12)" clipPath="url(#clip-below)" />

          {/* Curves */}
          <path d={expLine} fill="none" stroke="hsl(var(--brand))" strokeWidth={2.5} strokeLinejoin="round" />

          {/* Spot Line */}
          <line
            x1={xS(spot)}
            x2={xS(spot)}
            y1={pad.t}
            y2={H_payoff - pad.b}
            stroke="hsl(var(--fg-subtle))"
            strokeWidth={0.8}
            strokeDasharray="4 4"
          />
          <circle cx={xS(spot)} cy={zeroY} r={4} fill="hsl(var(--brand))" />

          {/* Breakeven lines */}
          {payoff.breakevens.map((be) => (
            <g key={be}>
              <line
                x1={xS(be)}
                x2={xS(be)}
                y1={pad.t}
                y2={H_payoff - pad.b}
                stroke="hsl(var(--warn))"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              <text x={xS(be)} y={H_payoff - 5} textAnchor="middle" className="fill-warn font-semibold" fontSize={8}>
                BE: {Math.round(be)}
              </text>
            </g>
          ))}

          {/* Strike Indicators */}
          {legs.map((leg, li) => (
            <text
              key={li}
              x={xS(leg.strike)}
              y={pad.t + 12 + li * 10}
              textAnchor="middle"
              className={cn("text-[8px] font-semibold", leg.right === "CE" ? "fill-call" : "fill-put")}
            >
              K:{leg.strike}
            </text>
          ))}

          {/* Interactive Hover Indicators */}
          {hoveredPoint && (
            <g>
              {/* Vertical dotted crosshair line */}
              <line
                x1={hoveredPoint.x}
                x2={hoveredPoint.x}
                y1={pad.t}
                y2={H_payoff - pad.b}
                stroke="hsl(var(--fg-subtle))"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {/* Hover point circle */}
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r={5}
                fill="hsl(var(--warn))"
                stroke="white"
                strokeWidth={1.5}
              />
              {/* Floating Tooltip Box */}
              <g
                transform={`translate(${
                  hoveredPoint.x > W_payoff - 120 ? hoveredPoint.x - 110 : hoveredPoint.x + 10
                }, ${hoveredPoint.y > H_payoff - 60 ? hoveredPoint.y - 50 : hoveredPoint.y + 10})`}
              >
                <rect
                  width={100}
                  height={40}
                  rx={4}
                  fill="hsl(var(--panel-2))"
                  stroke="hsl(var(--border-strong))"
                  strokeWidth={1}
                  opacity={0.95}
                />
                <text x={8} y={15} fontSize={8.5} className="fill-fg font-semibold">
                  Price: {Math.round(hoveredPoint.price).toLocaleString()}
                </text>
                <text
                  x={8}
                  y={30}
                  fontSize={9}
                  className={cn("font-bold", hoveredPoint.pnl >= 0 ? "fill-call" : "fill-put")}
                >
                  P&L: {hoveredPoint.pnl >= 0 ? "+" : ""}{Math.round(hoveredPoint.pnl).toLocaleString()}
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
        <div className="flex rounded-lg bg-bg-sunken p-0.5">
          <button
            onClick={() => setChartMode("technical")}
            className={cn(
              "rounded-md px-3 py-1 text-2xs font-semibold transition-all",
              chartMode === "technical" ? "bg-panel text-fg shadow-sm" : "text-fg-subtle hover:text-fg"
            )}
          >
            TradingView Chart
          </button>
          <button
            onClick={() => setChartMode("payoff")}
            className={cn(
              "rounded-md px-3 py-1 text-2xs font-semibold transition-all",
              chartMode === "payoff" ? "bg-panel text-fg shadow-sm" : "text-fg-subtle hover:text-fg"
            )}
          >
            Payoff Diagram
          </button>
        </div>

        {chartMode === "technical" && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveIndicator((p) => ({ ...p, sma: !p.sma }))}
              className={cn(
                "chip",
                activeIndicator.sma ? "bg-warn/15 text-warn font-bold" : "bg-bg-sunken text-fg-subtle"
              )}
            >
              SMA (10)
            </button>
            <button
              onClick={() => setActiveIndicator((p) => ({ ...p, ema: !p.ema }))}
              className={cn(
                "chip",
                activeIndicator.ema ? "bg-purple-500/15 text-purple-400 font-bold" : "bg-bg-sunken text-fg-subtle"
              )}
            >
              EMA (12)
            </button>
            <button
              onClick={() => setActiveIndicator((p) => ({ ...p, bb: !p.bb }))}
              className={cn(
                "chip",
                activeIndicator.bb ? "bg-blue-500/15 text-blue-400 font-bold" : "bg-bg-sunken text-fg-subtle"
              )}
            >
              Bollinger Bands
            </button>
            <button
              onClick={() => setActiveIndicator((p) => ({ ...p, rsi: !p.rsi }))}
              className={cn(
                "chip",
                activeIndicator.rsi ? "bg-pink-500/15 text-pink-400 font-bold" : "bg-bg-sunken text-fg-subtle"
              )}
            >
              RSI (14)
            </button>
          </div>
        )}
      </div>

      {/* Main Plot Area */}
      {chartMode === "technical" ? renderTechnicalSVG() : renderPayoffSVG()}
    </div>
  );
}
