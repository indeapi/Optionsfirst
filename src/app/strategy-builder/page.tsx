"use client";

import { useState, useEffect, useRef } from "react";
import { useMarket } from "@/components/providers/market";
import { PageHeader } from "@/components/shell/PageHeader";
import { ExpiryPicker } from "@/components/shell/ExpiryPicker";
import { Panel, Chip, Segmented } from "@/components/ui/primitives";
import { LoadingGrid } from "@/components/ui/Loading";
import { useAppStore } from "@/lib/store/app";
import { Icon } from "@/components/ui/Icon";
import { cn, money, num, pct } from "@/lib/utils";
import { bsPrice, bsGreeks } from "@/lib/quant/blackScholes";
import type { Leg } from "@/lib/quant/payoff";
import { buildPayoff } from "@/lib/quant/payoff";
import Link from "next/link";
import { calculateRequiredMargin } from "@/lib/quant/margin";
import { TechnicalChart } from "@/components/charts/TechnicalChart";

export default function StrategyBuilderPage() {
  const { snapshot, loading } = useMarket();
  
  // Zustand store
  const builderLegs = useAppStore((s) => s.builderLegs);
  const setBuilderLegs = useAppStore((s) => s.setBuilderLegs);
  const toggleBuilderLeg = useAppStore((s) => s.toggleBuilderLeg);
  const clearBuilderLegs = useAppStore((s) => s.clearBuilderLegs);
  const brokerConnections = useAppStore((s) => s.brokerConnections);
  const addVirtualPosition = useAppStore((s) => s.addVirtualPosition);

  // Local sliders state
  const [spotShiftPct, setSpotShiftPct] = useState(0); // -15% to +15%
  const [daysPassed, setDaysPassed] = useState(0); // 0 to dte
  
  // Broker order execution state
  const [selectedBrokerId, setSelectedBrokerId] = useState("ibkr");
  const [execQtyLots, setExecQtyLots] = useState(1);
  const [execTargetPct, setExecTargetPct] = useState(50); // Target profit as % of max profit/credit
  const [execStopPct, setExecStopPct] = useState(50); // Stop loss as % of max loss/debit
  const [isExecuting, setIsExecuting] = useState(false);
  const [execSuccess, setExecSuccess] = useState(false);

  // Sync daysPassed max value when expiry/DTE changes
  const dte = snapshot?.dte ?? 7;
  useEffect(() => {
    setDaysPassed(0);
    setSpotShiftPct(0);
  }, [dte]);

  // Seed a default ATM long straddle on first open so the payoff + technical
  // chart are visible immediately (no blank canvas to confuse a new user).
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !snapshot || builderLegs.length > 0) return;
    seededRef.current = true;
    const c = snapshot.chain;
    const row =
      c.rows.find((r) => r.strike === c.atmStrike) ?? c.rows[Math.floor(c.rows.length / 2)];
    if (!row) return;
    setBuilderLegs([
      { action: "buy", right: "CE", strike: row.strike, qty: 1, premium: row.call.ltp, iv: row.call.iv, expiry: c.expiry },
      { action: "buy", right: "PE", strike: row.strike, qty: 1, premium: row.put.ltp, iv: row.put.iv, expiry: c.expiry },
    ]);
  }, [snapshot, builderLegs.length, setBuilderLegs]);

  if (loading || !snapshot) {
    return (
      <>
        <PageHeader title="Strategy Builder" desc="Opening Builder..." icon="sliders" />
        <LoadingGrid />
      </>
    );
  }

  const { chain, analytics } = snapshot;
  const spot = chain.spot;
  const step = chain.rows.length > 1 ? chain.rows[1].strike - chain.rows[0].strike : 50;
  const lotSize = chain.instrument.lotSize;
  const ccy = chain.instrument.currency;
  const region = chain.instrument.region;

  // Quant Margin Engine Breakdown
  const marginBreakdown = (() => {
    return calculateRequiredMargin(builderLegs, spot, lotSize);
  })();

  // Helios & Athena Strike Assistant
  const optimalStrikes = (() => {
    if (!chain?.rows || chain.rows.length === 0) return null;

    const items = chain.rows.map((row) => {
      const callSpread = row.call.ltp > 0 ? (row.call.ask - row.call.bid) / row.call.ltp : 0.1;
      const putSpread = row.put.ltp > 0 ? (row.put.ask - row.put.bid) / row.put.ltp : 0.1;

      // Score: volume divided by spread pct
      const callScore = row.call.volume / (callSpread + 0.001);
      const putScore = row.put.volume / (putSpread + 0.001);

      return {
        strike: row.strike,
        call: {
          spread: callSpread * 100,
          volume: row.call.volume,
          oi: row.call.oi,
          score: callScore,
        },
        put: {
          spread: putSpread * 100,
          volume: row.put.volume,
          oi: row.put.oi,
          score: putScore,
        },
      };
    });

    if (items.length === 0) return null;

    const recommendedCall = [...items].sort((a, b) => b.call.score - a.call.score)[0];
    const recommendedPut = [...items].sort((a, b) => b.put.score - a.put.score)[0];

    if (!recommendedCall || !recommendedPut) return null;

    return {
      call: {
        strike: recommendedCall.strike,
        spread: recommendedCall.call.spread,
        volume: recommendedCall.call.volume,
        oi: recommendedCall.call.oi,
      },
      put: {
        strike: recommendedPut.strike,
        spread: recommendedPut.put.spread,
        volume: recommendedPut.put.volume,
        oi: recommendedPut.put.oi,
      },
    };
  })();

  const applyRecommendedStrike = (type: "CE" | "PE", strike: number) => {
    const updated = builderLegs.map((leg) => {
      if (leg.right === type) {
        const data = getPremiumAndIv(strike, type);
        return {
          ...leg,
          strike,
          premium: data.ltp,
          iv: data.iv,
        };
      }
      return leg;
    });
    setBuilderLegs(updated);
  };

  // Active broker connection list
  const activeBrokers = Object.values(brokerConnections).filter((b) => b.connected);

  // Determine standard strikes around ATM
  const strikes = chain.rows.map((r) => r.strike).sort((a, b) => a - b);
  const atmIndex = strikes.reduce(
    (bestIdx, s, idx) => (Math.abs(s - spot) < Math.abs(strikes[bestIdx] - spot) ? idx : bestIdx),
    0
  );
  const atmStrike = strikes[atmIndex];

  // Helper: Find OTM option premiums/IV from chain row
  const getPremiumAndIv = (strike: number, right: "CE" | "PE" | "EQ") => {
    if (right === "EQ") {
      return { ltp: spot, iv: 0 };
    }
    const row = chain.rows.find((r) => r.strike === strike);
    if (!row) return { ltp: step * 0.1, iv: 0.18 };
    const side = right === "CE" ? row.call : row.put;
    return { ltp: side.ltp, iv: side.iv || 0.18 };
  };

  // Quick templates templates generator
  const loadTemplate = (type: string) => {
    let newLegs: Leg[] = [];
    const buildLeg = (action: "buy" | "sell", right: "CE" | "PE", strike: number, qty = 1): Leg => {
      const data = getPremiumAndIv(strike, right);
      return { action, right, strike, qty, premium: data.ltp, iv: data.iv, expiry: chain.expiry };
    };

    switch (type) {
      case "bull-call-spread":
        newLegs = [
          buildLeg("buy", "CE", atmStrike),
          buildLeg("sell", "CE", strikes[Math.min(strikes.length - 1, atmIndex + 1)]),
        ];
        break;
      case "bull-put-spread":
        newLegs = [
          buildLeg("buy", "PE", strikes[Math.max(0, atmIndex - 1)]),
          buildLeg("sell", "PE", atmStrike),
        ];
        break;
      case "bear-put-spread":
        newLegs = [
          buildLeg("buy", "PE", atmStrike),
          buildLeg("sell", "PE", strikes[Math.max(0, atmIndex - 1)]),
        ];
        break;
      case "bear-call-spread":
        newLegs = [
          buildLeg("buy", "CE", strikes[Math.min(strikes.length - 1, atmIndex + 1)]),
          buildLeg("sell", "CE", atmStrike),
        ];
        break;
      case "short-straddle":
        newLegs = [
          buildLeg("sell", "CE", atmStrike),
          buildLeg("sell", "PE", atmStrike),
        ];
        break;
      case "short-strangle":
        newLegs = [
          buildLeg("sell", "PE", strikes[Math.max(0, atmIndex - 1)]),
          buildLeg("sell", "CE", strikes[Math.min(strikes.length - 1, atmIndex + 1)]),
        ];
        break;
      case "long-straddle":
        newLegs = [
          buildLeg("buy", "CE", atmStrike),
          buildLeg("buy", "PE", atmStrike),
        ];
        break;
      case "iron-condor":
        newLegs = [
          buildLeg("buy", "PE", strikes[Math.max(0, atmIndex - 2)]),
          buildLeg("sell", "PE", strikes[Math.max(0, atmIndex - 1)]),
          buildLeg("sell", "CE", strikes[Math.min(strikes.length - 1, atmIndex + 1)]),
          buildLeg("buy", "CE", strikes[Math.min(strikes.length - 1, atmIndex + 2)]),
        ];
        break;
      case "iron-butterfly":
        newLegs = [
          buildLeg("buy", "PE", strikes[Math.max(0, atmIndex - 1)]),
          buildLeg("sell", "PE", atmStrike),
          buildLeg("sell", "CE", atmStrike),
          buildLeg("buy", "CE", strikes[Math.min(strikes.length - 1, atmIndex + 1)]),
        ];
        break;
      default:
        newLegs = [];
    }
    setBuilderLegs(newLegs);
  };

  // Add a leg manually (supports up to 8 strikes)
  const handleAddLeg = () => {
    if (builderLegs.length >= 8) return;
    const data = getPremiumAndIv(atmStrike, "CE");
    const newLeg: Leg = {
      action: "buy",
      right: "CE",
      strike: atmStrike,
      qty: 1,
      premium: data.ltp,
      iv: data.iv,
      expiry: chain.expiry || undefined,
    };
    setBuilderLegs([...builderLegs, newLeg]);
  };

  // Modify leg property
  const handleUpdateLeg = (idx: number, updates: Partial<Leg>) => {
    const updated = [...builderLegs];
    const item = { ...updated[idx], ...updates };

    // If strike or option type changed, pull the new premium and IV
    if (updates.strike !== undefined || updates.right !== undefined) {
      const data = getPremiumAndIv(item.strike, item.right as "CE" | "PE");
      item.premium = data.ltp;
      item.iv = data.iv;
    }
    updated[idx] = item;
    setBuilderLegs(updated);
  };

  // Remove leg
  const handleRemoveLeg = (idx: number) => {
    const updated = builderLegs.filter((_, i) => i !== idx);
    setBuilderLegs(updated);
  };

  // Compute portfolio greeks
  const greeks = (() => {
    let totalDelta = 0;
    let totalGamma = 0;
    let totalTheta = 0;
    let totalVega = 0;

    const rfRate = region === "IN" ? 0.065 : 0.045;

    for (const leg of builderLegs) {
      if (leg.right === "EQ") {
        totalDelta += (leg.action === "buy" ? 1 : -1) * leg.qty * lotSize;
        continue;
      }
      const t = Math.max(0.0001, (dte - daysPassed) / 365);
      const bsG = bsGreeks({
        s: spot * (1 + spotShiftPct / 100),
        k: leg.strike,
        t,
        r: rfRate,
        sigma: leg.iv || 0.18,
        right: leg.right as "CE" | "PE",
      });

      const s = leg.action === "buy" ? 1 : -1;
      totalDelta += s * bsG.delta * leg.qty * lotSize;
      totalGamma += s * bsG.gamma * leg.qty * lotSize;
      totalTheta += s * bsG.theta * leg.qty * lotSize;
      totalVega += s * bsG.vega * leg.qty * lotSize;
    }

    return { delta: totalDelta, gamma: totalGamma, theta: totalTheta, vega: totalVega };
  })();

  // Compute Payoffs
  // 1. Expiry payoff
  const expiryPayoff = (() => {
    return buildPayoff(builderLegs, { spot, lotSize, span: 0.15 });
  })();

  // 2. Target date payoff (Black-Scholes revaluation at shifted spot & date)
  const targetPayoff = (() => {
    if (builderLegs.length === 0) return { points: [], currentPnl: 0 };
    const rfRate = region === "IN" ? 0.065 : 0.045;
    const span = 0.15;
    const steps = 120;
    const lo = spot * (1 - span);
    const hi = spot * (1 + span);
    const dx = (hi - lo) / (steps - 1);
    const points = [];

    const valuation = (S_x: number, dPassed: number) => {
      let value = 0;
      const t_rem = Math.max(0, (dte - dPassed) / 365);
      for (const leg of builderLegs) {
        const s_sign = leg.action === "buy" ? 1 : -1;
        if (leg.right === "EQ") {
          value += s_sign * (S_x - leg.premium) * leg.qty;
        } else if (t_rem <= 0) {
          const intrinsic = leg.right === "CE" ? Math.max(S_x - leg.strike, 0) : Math.max(leg.strike - S_x, 0);
          value += s_sign * (intrinsic - leg.premium) * leg.qty;
        } else {
          const estPrice = bsPrice({
            s: S_x,
            k: leg.strike,
            t: t_rem,
            r: rfRate,
            sigma: leg.iv || 0.18,
            right: leg.right as "CE" | "PE",
          });
          value += s_sign * (estPrice - leg.premium) * leg.qty;
        }
      }
      return value * lotSize;
    };

    for (let i = 0; i < steps; i++) {
      const price = lo + i * dx;
      const pnl = valuation(price, daysPassed);
      points.push({ price, pnl });
    }

    // P&L at the active shifted spot price
    const currentSpotVal = spot * (1 + spotShiftPct / 100);
    const currentPnl = valuation(currentSpotVal, daysPassed);

    return { points, currentPnl };
  })();

  // Expiry stats
  const { maxProfit, maxLoss, breakevens, pop, netPremium, rewardRisk } = expiryPayoff;

  // Execute strategy order simulation
  const handleExecute = async () => {
    if (builderLegs.length === 0) return;
    setIsExecuting(true);
    setExecSuccess(false);

    try {
      const broker = brokerConnections[selectedBrokerId];
      if (!broker) {
        setIsExecuting(false);
        return;
      }

      const totalDebit = netPremium < 0 ? Math.abs(netPremium) * execQtyLots : 0;
      const maxL = maxLoss === -Infinity ? 999999 : Math.abs(maxLoss) * execQtyLots;

      const pnlTarget = maxProfit === Infinity 
        ? 150 * execQtyLots * lotSize 
        : (netPremium >= 0 ? maxProfit : maxProfit * (execTargetPct / 100)) * execQtyLots;

      const pnlStop = maxLoss === -Infinity 
        ? -100 * execQtyLots * lotSize
        : (netPremium >= 0 ? -maxLoss * (execStopPct / 100) : -totalDebit * (execStopPct / 100)) * execQtyLots;

      const strategyName = builderLegs.length === 2 && builderLegs[0].action !== builderLegs[1].action
        ? "Option Spread"
        : builderLegs.length === 4 
          ? "Iron Condor" 
          : builderLegs.length === 2 && builderLegs[0].action === "sell" 
            ? "Short Straddle" 
            : "Custom Strategy";

      if (selectedBrokerId === "alpaca") {
        const { alpaca, formatAlpacaOptionSymbol } = await import("@/lib/data/live/alpaca");
        
        // Execute each leg on Alpaca
        const promises = builderLegs.map((leg) => {
          const optionSymbol = formatAlpacaOptionSymbol(
            chain.instrument.symbol,
            chain.expiry || leg.expiry || "",
            leg.right,
            leg.strike
          );
          return alpaca.placeOrder({
            symbol: optionSymbol,
            qty: leg.qty * execQtyLots,
            side: leg.action,
            type: "market",
            limitPrice: leg.premium,
          });
        });

        await Promise.all(promises);

        // Update Alpaca balance in store
        const acc = await alpaca.getAccount();
        useAppStore.setState((state) => {
          const alp = state.brokerConnections.alpaca;
          return {
            brokerConnections: {
              ...state.brokerConnections,
              alpaca: {
                ...alp,
                buyingPower: acc.buyingPower,
                netLiq: acc.portfolioValue,
              },
            },
          };
        });
      } else {
        // standard mock delay
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      addVirtualPosition({
        id: `virtual-pos-${Date.now()}`,
        symbol: chain.instrument.symbol,
        region: chain.instrument.region,
        strategyId: selectedBrokerId === "alpaca" ? "alpaca-options" : "custom",
        strategyName,
        legs: builderLegs.map((l) => ({ ...l })),
        qtyLots: execQtyLots,
        lotSize,
        currency: ccy,
        entryNet: netPremium * execQtyLots,
        target: pnlTarget,
        stop: -Math.abs(pnlStop),
        openedAt: Date.now(),
      });

      setIsExecuting(false);
      setExecSuccess(true);
      setTimeout(() => setExecSuccess(false), 3500);
    } catch (err: any) {
      setIsExecuting(false);
      alert(`Strategy Execution Error: ${err.message}`);
    }
  };

  // Render payoff charts helper
  const renderPayoffSVG = () => {
    const W = 760;
    const H = 280;
    const pad = { l: 58, r: 16, t: 16, b: 26 };
    const expPts = expiryPayoff.points;
    const tgtPts = targetPayoff.points;
    if (expPts.length === 0) return null;

    const minP = expPts[0].price;
    const maxP = expPts[expPts.length - 1].price;
    const allP = [...expPts.map((p) => p.pnl), ...tgtPts.map((p) => p.pnl)];
    let minY = Math.min(0, ...allP);
    let maxY = Math.max(0, ...allP);
    const padY = (maxY - minY) * 0.12 || 1;
    minY -= padY;
    maxY += padY;

    const xS = (price: number) => pad.l + ((price - minP) / (maxP - minP)) * (W - pad.l - pad.r);
    const yS = (pnl: number) => pad.t + ((maxY - pnl) / (maxY - minY)) * (H - pad.t - pad.b);

    const zeroY = yS(0);
    const expLine = expPts.map((p, i) => `${i === 0 ? "M" : "L"} ${xS(p.price).toFixed(1)} ${yS(p.pnl).toFixed(1)}`).join(" ");
    const tgtLine = tgtPts.map((p, i) => `${i === 0 ? "M" : "L"} ${xS(p.price).toFixed(1)} ${yS(p.pnl).toFixed(1)}`).join(" ");
    const expArea =
      `M ${xS(minP).toFixed(1)} ${zeroY.toFixed(1)} ` +
      expPts.map((p) => `L ${xS(p.price).toFixed(1)} ${yS(p.pnl).toFixed(1)}`).join(" ") +
      ` L ${xS(maxP).toFixed(1)} ${zeroY.toFixed(1)} Z`;

    const sym = ccy === "INR" ? "₹" : "$";
    const fmt = (v: number) => `${v < 0 ? "-" : ""}${sym}${compact(Math.abs(v))}`;
    const compact = (v: number) => {
      if (v >= 1e7) return (v / 1e7).toFixed(1) + "Cr";
      if (v >= 1e5) return (v / 1e5).toFixed(1) + "L";
      if (v >= 1e3) return (v / 1e3).toFixed(1) + "k";
      return Math.round(v).toString();
    };

    const yTicks = [maxY, (maxY + minY) / 2 > 0 ? maxY / 2 : 0, 0, minY / 2, minY].filter(
      (v, i, a) => a.indexOf(v) === i,
    );

    const sliderSpotPrice = spot * (1 + spotShiftPct / 100);

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Strategy payoff diagram">
        <defs>
          <clipPath id="clip-above-builder">
            <rect x={0} y={0} width={W} height={zeroY} />
          </clipPath>
          <clipPath id="clip-below-builder">
            <rect x={0} y={zeroY} width={W} height={H - zeroY} />
          </clipPath>
        </defs>

        {/* Expected-move band */}
        {analytics?.expectedMovePct ? (
          <g>
            <rect
              x={xS(spot * (1 - analytics.expectedMovePct / 100))}
              y={pad.t}
              width={Math.max(0, xS(spot * (1 + analytics.expectedMovePct / 100)) - xS(spot * (1 - analytics.expectedMovePct / 100)))}
              height={H - pad.t - pad.b}
              fill="hsl(var(--brand) / 0.05)"
            />
          </g>
        ) : null}

        {/* Y gridlines */}
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

        {/* Expiry Shaded P/L */}
        <path d={expArea} fill="hsl(var(--call) / 0.12)" clipPath="url(#clip-above-builder)" />
        <path d={expArea} fill="hsl(var(--put) / 0.12)" clipPath="url(#clip-below-builder)" />

        {/* Curves */}
        <path d={expLine} fill="none" stroke="hsl(var(--fg-subtle))" strokeWidth={1.5} opacity={0.65} />
        <path d={tgtLine} fill="none" stroke="hsl(var(--brand))" strokeWidth={2.2} strokeLinejoin="round" />

        {/* Breakevens */}
        {breakevens.map((be) => (
          <g key={be}>
            <line x1={xS(be)} x2={xS(be)} y1={pad.t} y2={H - pad.b} stroke="hsl(var(--warn))" strokeWidth={0.8} strokeDasharray="2 3" />
            <text x={xS(be)} y={H - pad.b + 10} textAnchor="middle" className="fill-warn tnum font-semibold" fontSize={8.5}>
              {be.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </text>
          </g>
        ))}

        {/* Spot Center marker */}
        <line x1={xS(spot)} x2={xS(spot)} y1={pad.t} y2={H - pad.b} stroke="hsl(var(--border-strong))" strokeWidth={0.8} strokeDasharray="4 4" />
        <text x={xS(spot)} y={pad.t - 4} textAnchor="middle" className="fill-fg-subtle tnum" fontSize={8.5}>
          spot {Math.round(spot).toLocaleString()}
        </text>

        {/* Slider Spot price marker */}
        <line x1={xS(sliderSpotPrice)} x2={xS(sliderSpotPrice)} y1={pad.t} y2={H - pad.b} stroke="hsl(var(--brand))" strokeWidth={1.2} />
        <circle cx={xS(sliderSpotPrice)} cy={yS(targetPayoff.currentPnl)} r={4} fill="hsl(var(--brand))" stroke="white" strokeWidth={1} />
        <text x={xS(sliderSpotPrice)} y={H - pad.b - 6} textAnchor="middle" className="fill-brand tnum font-bold bg-panel" fontSize={9.5}>
          {Math.round(sliderSpotPrice).toLocaleString()}
        </text>
      </svg>
    );
  };

  return (
    <>
      <PageHeader
        title="Strategy Builder"
        desc="Interactive multi-leg strategy analysis desk with real-time Black-Scholes pricing models."
        icon="sliders"
        right={<ExpiryPicker />}
      />

      {/* Quick Outlook / Template Selector */}
      <div className="mb-3 rounded-xl border border-border bg-panel p-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="label-eyebrow">Quick Templates</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-2xs font-semibold text-call mr-1">Bullish:</span>
            {["Bull Call Spread", "Bull Put Spread"].map((name) => (
              <button
                key={name}
                onClick={() => loadTemplate(name.toLowerCase().replace(/ /g, "-"))}
                className="chip bg-call/10 border border-call/20 hover:bg-call/15 text-call"
              >
                {name}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border hidden md:block" />

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-2xs font-semibold text-put mr-1">Bearish:</span>
            {["Bear Put Spread", "Bear Call Spread"].map((name) => (
              <button
                key={name}
                onClick={() => loadTemplate(name.toLowerCase().replace(/ /g, "-"))}
                className="chip bg-put/10 border border-put/20 hover:bg-put/15 text-put"
              >
                {name}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border hidden md:block" />

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-2xs font-semibold text-info mr-1">Neutral / Volatile:</span>
            {["Short Straddle", "Short Strangle", "Iron Condor", "Iron Butterfly"].map((name) => (
              <button
                key={name}
                onClick={() => loadTemplate(name.toLowerCase().replace(/ /g, "-"))}
                className="chip bg-bg-sunken border border-border hover:bg-border/30 text-fg-muted"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FULL-WIDTH Advanced Charting Panel */}
      <div className="mb-3">
        <Panel eyebrow="Advanced Charting" title="Interactive Strategy & Technical Analysis" bodyClassName="p-3">
          {builderLegs.length === 0 ? (
            <div className="py-12 text-center text-2xs text-fg-subtle">
              Add option contracts to view the technical indicator chart and payoff curves.
            </div>
          ) : (
            <div className="space-y-3">
              <TechnicalChart
                legs={builderLegs}
                spot={spot}
                lotSize={lotSize}
                currency={ccy}
                region={region}
              />
              
              {/* Sliders */}
              <div className="grid gap-4 sm:grid-cols-2 border-t border-border/60 pt-3">
                {/* Spot price shift slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-2xs font-semibold">
                    <span className="text-fg-subtle">Underlying Price Shift</span>
                    <span className={cn("tnum", spotShiftPct >= 0 ? "text-call" : "text-put")}>
                      {spotShiftPct >= 0 ? "+" : ""}
                      {spotShiftPct.toFixed(1)}% ({money(spot * (1 + spotShiftPct / 100), ccy, 0)})
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-15"
                    max="15"
                    step="0.1"
                    value={spotShiftPct}
                    onChange={(e) => setSpotShiftPct(Number(e.target.value))}
                    className="w-full accent-brand bg-bg-sunken h-1 rounded-lg"
                  />
                </div>

                {/* Target date slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-2xs font-semibold">
                    <span className="text-fg-subtle">Target Date (Time Decay)</span>
                    <span className="text-fg font-bold tnum">
                      T+{daysPassed} day{daysPassed !== 1 ? "s" : ""} ({dte - daysPassed}d left)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={dte}
                    step="1"
                    value={daysPassed}
                    onChange={(e) => setDaysPassed(Number(e.target.value))}
                    className="w-full accent-brand bg-bg-sunken h-1 rounded-lg"
                    disabled={dte === 0}
                  />
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        {/* Left Side: Legs Table & Customizer */}
        <div className="lg:col-span-7 space-y-3">
          <Panel
            eyebrow="Active Legs"
            title={`${chain.instrument.name} · Spot ${spot.toLocaleString(undefined, { maximumFractionDigits: 1 })}`}
            right={
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddLeg}
                  disabled={builderLegs.length >= 8}
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-2 py-1 text-2xs font-semibold shadow-sm transition-all",
                    builderLegs.length >= 8
                      ? "bg-bg-sunken border border-border text-fg-subtle cursor-not-allowed opacity-60"
                      : "bg-brand/12 border border-brand/20 text-brand hover:bg-brand/20"
                  )}
                >
                  <Icon name="check" size={10} /> Add Leg {builderLegs.length > 0 && `(${builderLegs.length}/8)`}
                </button>
                <button
                  onClick={clearBuilderLegs}
                  className="rounded border border-border px-2 py-1 text-2xs font-semibold text-fg-subtle hover:bg-bg-sunken"
                >
                  Clear All
                </button>
              </div>
            }
            bodyClassName="p-0"
          >
            {builderLegs.length === 0 ? (
              <div className="p-8 text-center text-2xs text-fg-subtle">
                No active legs. Select legs from the{" "}
                <Link href="/option-chain" className="text-brand font-medium hover:underline">
                  Option Chain
                </Link>{" "}
                or click one of the Quick Templates above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-2xs border-collapse">
                  <thead>
                    <tr className="bg-bg-sunken text-fg-subtle border-b border-border">
                      <th className="px-3 py-2 text-left font-semibold">B/S</th>
                      <th className="px-3 py-2 text-left font-semibold">Type</th>
                      <th className="px-3 py-2 text-right font-semibold">Strike</th>
                      <th className="px-3 py-2 text-right font-semibold">Qty</th>
                      <th className="px-3 py-2 text-right font-semibold">Premium</th>
                      <th className="px-3 py-2 text-right font-semibold">IV %</th>
                      <th className="px-3 py-2 text-right font-semibold">Delta</th>
                      <th className="px-3 py-2 text-center font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {builderLegs.map((leg, idx) => {
                      const rfRate = region === "IN" ? 0.065 : 0.045;
                      const t = Math.max(0.0001, (dte - daysPassed) / 365);
                      let delta = 0;
                      if (leg.right === "EQ") {
                        delta = leg.action === "buy" ? 1 : -1;
                      } else {
                        delta = bsGreeks({
                          s: spot * (1 + spotShiftPct / 100),
                          k: leg.strike,
                          t,
                          r: rfRate,
                          sigma: leg.iv || 0.18,
                          right: leg.right as "CE" | "PE",
                        }).delta * (leg.action === "buy" ? 1 : -1);
                      }

                      return (
                        <tr key={idx} className="border-b border-border hover:bg-bg-sunken/40">
                          {/* Buy/Sell */}
                          <td className="px-3 py-2">
                            <Segmented
                              size="sm"
                              value={leg.action}
                              onChange={(v) => handleUpdateLeg(idx, { action: v })}
                              options={[
                                { label: <span className="text-call font-bold">B</span>, value: "buy" },
                                { label: <span className="text-put font-bold">S</span>, value: "sell" },
                              ]}
                            />
                          </td>
                          {/* Right (CE/PE/EQ) */}
                          <td className="px-3 py-2">
                            <select
                              value={leg.right}
                              onChange={(e) => handleUpdateLeg(idx, { right: e.target.value as "CE" | "PE" | "EQ" })}
                              className="rounded border border-border bg-panel px-1.5 py-1 font-semibold text-fg"
                            >
                              <option value="CE">Call (CE)</option>
                              <option value="PE">Put (PE)</option>
                              <option value="EQ">Stock</option>
                            </select>
                          </td>
                          {/* Strike */}
                          <td className="px-3 py-2 text-right">
                            {leg.right === "EQ" ? (
                              <span className="text-fg-subtle">—</span>
                            ) : (
                              <select
                                value={leg.strike}
                                onChange={(e) => handleUpdateLeg(idx, { strike: Number(e.target.value) })}
                                className="rounded border border-border bg-panel px-1.5 py-1 font-semibold text-fg"
                              >
                                {strikes.map((s) => {
                                  const isOptCall = optimalStrikes?.call?.strike === s;
                                  const isOptPut = optimalStrikes?.put?.strike === s;
                                  const isOpt = (leg.right === "CE" && isOptCall) || (leg.right === "PE" && isOptPut);
                                  return (
                                    <option key={s} value={s}>
                                      {s.toLocaleString()} {isOpt ? "★ Optimal" : ""}
                                    </option>
                                  );
                                })}
                              </select>
                            )}
                          </td>
                          {/* Qty */}
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleUpdateLeg(idx, { qty: Math.max(1, leg.qty - 1) })}
                                className="h-5 w-5 rounded border border-border bg-bg-sunken flex items-center justify-center font-bold text-fg hover:bg-border/30"
                              >
                                -
                              </button>
                              <span className="font-semibold text-fg w-6 text-center">{leg.qty}</span>
                              <button
                                onClick={() => handleUpdateLeg(idx, { qty: leg.qty + 1 })}
                                className="h-5 w-5 rounded border border-border bg-bg-sunken flex items-center justify-center font-bold text-fg hover:bg-border/30"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          {/* Premium */}
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              value={leg.premium}
                              step="0.05"
                              onChange={(e) => handleUpdateLeg(idx, { premium: Number(e.target.value) })}
                              className="rounded border border-border bg-panel px-1.5 py-1 font-semibold text-fg text-right w-16 tnum"
                            />
                          </td>
                          {/* IV */}
                          <td className="px-3 py-2 text-right">
                            {leg.right === "EQ" ? (
                              <span className="text-fg-subtle">—</span>
                            ) : (
                              <input
                                type="number"
                                value={Math.round((leg.iv || 0.18) * 100)}
                                onChange={(e) => handleUpdateLeg(idx, { iv: Number(e.target.value) / 100 })}
                                className="rounded border border-border bg-panel px-1.5 py-1 font-semibold text-fg text-right w-12 tnum"
                              />
                            )}
                          </td>
                          {/* Delta */}
                          <td className="px-3 py-2 text-right text-fg font-semibold tnum">
                            {delta.toFixed(2)}
                          </td>
                          {/* Delete */}
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleRemoveLeg(idx)}
                              className="h-6 w-6 rounded border border-border hover:bg-put/10 hover:text-put flex items-center justify-center text-fg-subtle"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* Broker Order Placement Form */}
          {builderLegs.length > 0 && (
            <Panel eyebrow="Broker integration" title="Execute Strategy on Client Account">
              {activeBrokers.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-bg-sunken px-3 py-4 text-2xs text-fg-subtle">
                  <Icon name="info" size={14} className="text-info" />
                  <span>
                    No connected broker available. Please go to the{" "}
                    <Link href="/broker-login" className="text-brand font-semibold hover:underline">
                      Broker Login
                    </Link>{" "}
                    page to establish a client session.
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                    <div>
                      <label className="label-eyebrow block mb-1">Select Broker</label>
                      <select
                        value={selectedBrokerId}
                        onChange={(e) => setSelectedBrokerId(e.target.value)}
                        className="w-full rounded-lg border border-border bg-bg-sunken px-2 py-1.5 text-2xs font-semibold text-fg"
                      >
                        {activeBrokers.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.accountNo})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label-eyebrow block mb-1">Quantity (Lots)</label>
                      <input
                        type="number"
                        min="1"
                        value={execQtyLots}
                        onChange={(e) => setExecQtyLots(Math.max(1, Number(e.target.value)))}
                        className="w-full rounded-lg border border-border bg-bg-sunken px-2 py-1.5 text-2xs font-semibold text-fg text-right tnum"
                      />
                    </div>

                    <div>
                      <label className="label-eyebrow block mb-1">Target Profit %</label>
                      <input
                        type="number"
                        min="10"
                        max="200"
                        value={execTargetPct}
                        onChange={(e) => setExecTargetPct(Number(e.target.value))}
                        className="w-full rounded-lg border border-border bg-bg-sunken px-2 py-1.5 text-2xs font-semibold text-fg text-right tnum"
                      />
                    </div>

                    <div>
                      <label className="label-eyebrow block mb-1">Stop Loss %</label>
                      <input
                        type="number"
                        min="10"
                        max="200"
                        value={execStopPct}
                        onChange={(e) => setExecStopPct(Number(e.target.value))}
                        className="w-full rounded-lg border border-border bg-bg-sunken px-2 py-1.5 text-2xs font-semibold text-fg text-right tnum"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleExecute}
                      disabled={isExecuting}
                      className={cn(
                        "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-2xs font-bold text-white shadow-md transition-all",
                        isExecuting ? "bg-fg-subtle cursor-wait" : "bg-call hover:bg-call/90"
                      )}
                    >
                      {isExecuting ? (
                        <>
                          <Icon name="refresh" size={12} className="animate-spin" /> Executing Orders...
                        </>
                      ) : (
                        <>
                          <Icon name="wallet" size={12} /> Execute Order ({execQtyLots} Lot{execQtyLots > 1 ? "s" : ""})
                        </>
                      )}
                    </button>
                    {execSuccess && (
                      <span className="flex items-center gap-1 text-2xs font-semibold text-call animate-fade-in">
                        <Icon name="check" size={12} strokeWidth={3} /> Position placed! Syncing to Dashboard...
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Panel>
          )}
        </div>

        {/* Right Side: Agent Strike Assistant, Metrics, Greeks, Margin Breakdown */}
        <div className="lg:col-span-5 space-y-3">
          {/* Agent Strike Assistant */}
          {optimalStrikes && (
            <Panel
              eyebrow="Agent Assist"
              title="Helios & Athena Strike Assistant"
              right={
                <span className="flex items-center gap-1 text-[9px] font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded uppercase">
                  <Icon name="activity" size={10} className="animate-pulse" /> Active Scan
                </span>
              }
            >
              <div className="space-y-3 text-2xs">
                <div className="flex gap-2 bg-bg-sunken/60 p-2.5 rounded-lg border border-border/60">
                  <div className="text-brand shrink-0 pt-0.5 animate-bounce">
                    <Icon name="route" size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-fg block text-3xs uppercase">Strike Selection Logic</span>
                    <span className="text-fg-subtle text-3xs leading-relaxed block mt-0.5">
                      Helios and Athena recommend the following strikes which exhibit the highest liquidity (Volume & OI) and narrowest bid-ask spreads.
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center rounded-lg bg-call/5 border border-call/10 p-2.5">
                    <div>
                      <span className="font-bold text-call block text-3xs uppercase">Optimal Call Strike (CE)</span>
                      <span className="text-fg font-semibold mt-0.5">Strike {optimalStrikes.call.strike}</span>
                      <span className="text-fg-subtle block text-3xs">
                        Spread: {optimalStrikes.call.spread.toFixed(2)}% · Volume: {optimalStrikes.call.volume.toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={() => applyRecommendedStrike("CE", optimalStrikes.call.strike)}
                      className="rounded bg-call/10 hover:bg-call/20 px-2.5 py-1 text-3xs font-bold text-call shadow-sm transition-all"
                    >
                      Apply CE
                    </button>
                  </div>

                  <div className="flex justify-between items-center rounded-lg bg-put/5 border border-put/10 p-2.5">
                    <div>
                      <span className="font-bold text-put block text-3xs uppercase">Optimal Put Strike (PE)</span>
                      <span className="text-fg font-semibold mt-0.5">Strike {optimalStrikes.put.strike}</span>
                      <span className="text-fg-subtle block text-3xs">
                        Spread: {optimalStrikes.put.spread.toFixed(2)}% · Volume: {optimalStrikes.put.volume.toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={() => applyRecommendedStrike("PE", optimalStrikes.put.strike)}
                      className="rounded bg-put/10 hover:bg-put/20 px-2.5 py-1 text-3xs font-bold text-put shadow-sm transition-all"
                    >
                      Apply PE
                    </button>
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {/* Metrics summary cards */}
          {builderLegs.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <MetricBox
                label="Target P&L"
                value={money(targetPayoff.currentPnl, ccy, 0)}
                tone={targetPayoff.currentPnl >= 0 ? "call" : "put"}
                sub={`at T+${daysPassed} day`}
              />
              <MetricBox
                label="Max Profit"
                value={maxProfit === Infinity ? "Unlimited" : money(maxProfit, ccy, 0)}
                tone={maxProfit > 0 ? "call" : "fg"}
              />
              <MetricBox
                label="Max Loss"
                value={maxLoss === -Infinity ? "Unlimited" : money(maxLoss, ccy, 0)}
                tone={maxLoss < 0 ? "put" : "fg"}
              />
              <MetricBox
                label="Net Premium"
                value={`${netPremium >= 0 ? "Credit" : "Debit"} ${money(Math.abs(netPremium), ccy, 0)}`}
                sub={netPremium >= 0 ? "Earned on entry" : "Paid on entry"}
              />
              <MetricBox
                label="Win Probability"
                value={pop !== undefined ? `${(pop * 100).toFixed(0)}%` : "N/A"}
                sub="Model-estimated POP"
              />
              <MetricBox
                label="Risk : Reward"
                value={rewardRisk !== undefined ? `1 : ${rewardRisk.toFixed(2)}` : "N/A"}
              />
              <MetricBox
                label="Required Margin"
                value={money(marginBreakdown.totalMargin, ccy, 0)}
                tone="fg"
                sub="Initial margin needed"
              />
              <MetricBox
                label="Actual Capital Required"
                value={money(marginBreakdown.actualCapitalRequired, ccy, 0)}
                tone="call"
                sub="Total buying power impact"
              />
            </div>
          )}

          {/* Position Greeks */}
          {builderLegs.length > 0 && (
            <Panel eyebrow="Position Greeks" title="Aggregated Portfolio Sensitivities">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-2xs">
                <GreekMetric label="Delta" value={greeks.delta} desc="Price shift impact (Option value change per $1 stock move)" />
                <GreekMetric label="Gamma" value={greeks.gamma} desc="Price shift accelerator (Rate of change of Delta)" />
                <GreekMetric label="Theta" value={greeks.theta} desc="Time decay loss (Premium loss per day as expiration nears)" tone="put" />
                <GreekMetric label="Vega" value={greeks.vega} desc="Volatility impact (Premium change per 1% implied volatility move)" />
              </div>
            </Panel>
          )}

          {/* Margin Requirements Breakdown */}
          {builderLegs.length > 0 && (
            <Panel eyebrow="Margin Engine" title="Quant Portfolio Margin Breakdown">
              <div className="space-y-2 text-2xs">
                {marginBreakdown.legsBreakdown.map((item, idx) => (
                  <div key={idx} className="flex justify-between border-b border-border/40 pb-1.5 last:border-b-0 last:pb-0">
                    <div>
                      <span className="font-semibold text-fg block">{item.type}</span>
                      <span className="text-3xs text-fg-subtle">{item.description}</span>
                    </div>
                    <span className="font-bold text-fg tnum self-center">{money(item.margin, ccy, 0)}</span>
                  </div>
                ))}
                {marginBreakdown.legsBreakdown.length === 0 && (
                  <div className="text-fg-subtle text-3xs text-center py-2">No margin requirements calculated.</div>
                )}
                <div className="flex justify-between pt-2 border-t border-border-strong font-black text-fg text-[13px] tracking-tight">
                  <span>Total Margin Required</span>
                  <span className="tnum text-brand">{money(marginBreakdown.totalMargin, ccy, 0)}</span>
                </div>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function MetricBox({
  label,
  value,
  tone = "fg",
  sub,
}: {
  label: string;
  value: string;
  tone?: "call" | "put" | "fg";
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel p-3">
      <div className="label-eyebrow text-3xs">{label}</div>
      <div
        className={cn(
          "tnum mt-1 text-sm font-bold",
          tone === "call" ? "text-call" : tone === "put" ? "text-put" : "text-fg"
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-3xs text-fg-subtle">{sub}</div> : null}
    </div>
  );
}

function GreekMetric({
  label,
  value,
  desc,
  tone,
}: {
  label: string;
  value: number;
  desc: string;
  tone?: "call" | "put";
}) {
  const displayVal = value.toFixed(2);
  return (
    <div className="rounded-lg border border-border bg-panel-2 p-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-fg">{label}</span>
        <span
          className={cn(
            "tnum font-bold",
            tone ? (tone === "call" ? "text-call" : "text-put") : value >= 0 ? "text-call" : "text-put"
          )}
        >
          {value >= 0 ? "+" : ""}
          {displayVal}
        </span>
      </div>
      <div className="text-3xs text-fg-subtle mt-0.5">{desc}</div>
    </div>
  );
}
