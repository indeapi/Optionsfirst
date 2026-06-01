"use client";

import { useState, useMemo } from "react";
import { useMarket } from "@/components/providers/market";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel, Chip, Segmented } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { cn, money, num, pct } from "@/lib/utils";
import { LoadingGrid } from "@/components/ui/Loading";

interface Trade {
  id: string;
  entryDate: string;
  exitDate: string;
  strategy: string;
  entrySpot: number;
  exitSpot: number;
  pnl: number;
  reason: "target" | "stop" | "expiry";
  daysHeld: number;
}

interface MonthlyReturn {
  year: number;
  month: string; // "Jan", "Feb", etc.
  pnl: number;
}

export default function BacktestingPage() {
  const { snapshot, loading } = useMarket();

  // Backtest configurations
  const [strategy, setStrategy] = useState("short-straddle");
  const [dteEntry, setDteEntry] = useState("7");
  const [stopLossPct, setStopLossPct] = useState("40"); // % of premium
  const [targetProfitPct, setTargetProfitPct] = useState("50"); // % of premium
  const [periodYears, setPeriodYears] = useState("1"); // 1 or 2 years

  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [results, setResults] = useState<{
    trades: Trade[];
    monthlyReturns: MonthlyReturn[];
    netProfit: number;
    winRate: number;
    totalTrades: number;
    profitFactor: number;
    maxDrawdown: number;
    avgWin: number;
    avgLoss: number;
  } | null>(null);

  if (loading || !snapshot) {
    return (
      <>
        <PageHeader title="Strategy Backtesting" desc="Opening Backtester..." icon="bar-chart-3" />
        <LoadingGrid />
      </>
    );
  }

  const { chain } = snapshot;
  const spot = chain.spot;
  const ccy = chain.instrument.currency;

  // Run the historical backtest simulation (seeded deterministic generator)
  const runBacktest = () => {
    setRunning(true);
    setCompleted(false);

    setTimeout(() => {
      const numDte = Number(dteEntry);
      const stopLimit = Number(stopLossPct) / 100;
      const targetLimit = Number(targetProfitPct) / 100;
      const years = Number(periodYears);
      const totalDays = years * 252;

      // Seedable pseudo-random number generator for deterministic curves
      let seed = 42 + numDte + stopLimit * 10 + targetLimit * 20 + years;
      const rand = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
      };

      const trades: Trade[] = [];
      let currentDate = new Date(Date.now() - years * 365 * 24 * 3600_000);
      let cumulativeDays = 0;
      
      const stepDays = numDte + 2; // entry frequency
      const lotSize = chain.instrument.lotSize;
      
      // Base premium per unit: ~2.5% of spot for 7 DTE, scaled by DTE
      const basePrem = spot * 0.025 * Math.sqrt(numDte / 7);

      while (cumulativeDays < totalDays) {
        // Open a new trade
        const entrySpot = spot * (0.95 + rand() * 0.1); // spot range
        const premiumReceived = basePrem * (0.85 + rand() * 0.3); // premium variability
        
        let pnl = 0;
        let daysHeld = 0;
        let reason: "target" | "stop" | "expiry" = "expiry";

        // Day by day path simulation
        for (let d = 1; d <= numDte; d++) {
          daysHeld = d;
          // Volatility walk
          const spotWalk = entrySpot * (1 + (rand() - 0.5) * 0.04 * Math.sqrt(d));
          const timeDecayFactor = (numDte - d) / numDte;

          // Strategy-specific price path behavior
          let currentOptionValue = premiumReceived * timeDecayFactor; // base decay
          const spotChangePct = Math.abs(spotWalk - entrySpot) / entrySpot;

          if (strategy === "short-straddle") {
            // Straddle loses money if spot moves far from entry
            currentOptionValue += premiumReceived * (spotChangePct * 12 * Math.sqrt(d / numDte));
          } else if (strategy === "iron-condor") {
            // Condor is safer, losses are capped
            const shift = spotChangePct * 8;
            currentOptionValue += premiumReceived * (shift > 1 ? 1 : shift * 0.5);
          } else if (strategy === "bull-call-spread") {
            // Spreads are directional
            const isUp = spotWalk > entrySpot;
            const payoff = isUp ? premiumReceived * 1.5 : -premiumReceived * 0.8;
            currentOptionValue = premiumReceived - (payoff * (d / numDte));
          } else {
            // Bear Put Spread
            const isDown = spotWalk < entrySpot;
            const payoff = isDown ? premiumReceived * 1.5 : -premiumReceived * 0.8;
            currentOptionValue = premiumReceived - (payoff * (d / numDte));
          }

          // Calculate current P&L
          // Selling strategy: P&L is (entry_premium - current_premium)
          // Buying strategy: P&L is (current_premium - entry_premium)
          const isSeller = strategy === "short-straddle" || strategy === "iron-condor";
          pnl = isSeller 
            ? (premiumReceived - currentOptionValue) * lotSize
            : (currentOptionValue - premiumReceived) * lotSize;

          const maxProfitPotential = isSeller ? premiumReceived * lotSize : premiumReceived * 1.5 * lotSize;
          const maxLossPotential = isSeller ? premiumReceived * 2 * lotSize : premiumReceived * lotSize;

          // Target Hit
          if (pnl >= maxProfitPotential * targetLimit) {
            pnl = maxProfitPotential * targetLimit;
            reason = "target";
            break;
          }
          // Stop Loss Hit
          if (pnl <= -maxLossPotential * stopLimit) {
            pnl = -maxLossPotential * stopLimit;
            reason = "stop";
            break;
          }
        }

        // Finalize trade entry
        const entryStr = currentDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        currentDate.setDate(currentDate.getDate() + daysHeld + 2); // advance calendar
        const exitStr = currentDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

        trades.push({
          id: `t-${trades.length + 1}`,
          entryDate: entryStr,
          exitDate: exitStr,
          strategy: strategy.replace(/-/g, " "),
          entrySpot,
          exitSpot: entrySpot * (0.98 + rand() * 0.04),
          pnl,
          reason,
          daysHeld,
        });

        cumulativeDays += stepDays;
        currentDate.setDate(currentDate.getDate() + 2); // next setup gap
      }

      // Compute monthly returns
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthlyReturns: MonthlyReturn[] = [];
      const currentYear = new Date().getFullYear();

      // Divide P&L across months
      let tradeIdx = 0;
      for (let y = currentYear - years; y <= currentYear; y++) {
        for (const m of months) {
          let monthPnl = 0;
          const count = Math.floor(1 + rand() * 3); // 1-3 trades per month
          for (let k = 0; k < count; k++) {
            if (tradeIdx < trades.length) {
              monthPnl += trades[tradeIdx].pnl;
              tradeIdx++;
            }
          }
          monthlyReturns.push({ year: y, month: m, pnl: monthPnl });
        }
      }

      // Compute aggregate stats
      const netProfit = trades.reduce((sum, t) => sum + t.pnl, 0);
      const wins = trades.filter((t) => t.pnl > 0);
      const losses = trades.filter((t) => t.pnl <= 0);
      const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
      
      const totalWinsSum = wins.reduce((sum, t) => sum + t.pnl, 0);
      const totalLossesSum = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
      const profitFactor = totalLossesSum > 0 ? totalWinsSum / totalLossesSum : totalWinsSum > 0 ? 9.9 : 0;

      // Drawdown calculation
      let maxDD = 0;
      let peak = 0;
      let currentBal = 50000 * (ccy === "INR" ? 80 : 1); // starting virtual balance
      for (const t of trades) {
        currentBal += t.pnl;
        if (currentBal > peak) peak = currentBal;
        const dd = peak > 0 ? ((peak - currentBal) / peak) * 100 : 0;
        if (dd > maxDD) maxDD = dd;
      }

      const avgWin = wins.length > 0 ? totalWinsSum / wins.length : 0;
      const avgLoss = losses.length > 0 ? totalLossesSum / losses.length : 0;

      setResults({
        trades,
        monthlyReturns,
        netProfit,
        winRate,
        totalTrades: trades.length,
        profitFactor,
        maxDrawdown: maxDD,
        avgWin,
        avgLoss,
      });

      setRunning(false);
      setCompleted(true);
    }, 1500);
  };

  // Render Equity & Drawdown custom SVGs
  const renderBacktestCharts = () => {
    if (!results) return null;
    const { trades } = results;

    const W = 760;
    const H = 220;
    const pad = { l: 58, r: 16, t: 12, b: 20 };

    // Equity points path
    let balance = 0;
    const pts = [{ x: 0, y: 0 }];
    const ddPts = [{ x: 0, y: 0 }];

    let peak = 0;
    trades.forEach((t, idx) => {
      balance += t.pnl;
      pts.push({ x: idx + 1, y: balance });

      if (balance > peak) peak = balance;
      const dd = peak > 0 ? ((balance - peak) / peak) * 100 : 0; // negative or 0
      ddPts.push({ x: idx + 1, y: dd });
    });

    const xS = (i: number) => pad.l + (i / trades.length) * (W - pad.l - pad.r);
    
    // Equity scaling
    const pnlValues = pts.map((p) => p.y);
    let minY = Math.min(0, ...pnlValues);
    let maxY = Math.max(1000, ...pnlValues);
    const padY = (maxY - minY) * 0.1 || 1;
    minY -= padY;
    maxY += padY;
    const yS = (pnl: number) => pad.t + ((maxY - pnl) / (maxY - minY)) * (H - pad.t - pad.b);

    // Drawdown scaling
    const ddValues = ddPts.map((p) => p.y);
    const minDDY = Math.min(-5, ...ddValues); // e.g. -15%
    const maxDDY = 0;
    const yDDS = (dd: number) => pad.t + ((maxDDY - dd) / (maxDDY - minDDY)) * (H - pad.t - pad.b);

    // Construct paths
    const eqLine = pts.map((p) => `${xS(p.x).toFixed(1)},${yS(p.y).toFixed(1)}`).join(" L ");
    const eqPath = `M ${eqLine}`;
    
    const zeroY = yS(0);
    const eqArea = `M ${xS(0).toFixed(1)},${zeroY.toFixed(1)} L ${eqLine} L ${xS(trades.length).toFixed(1)},${zeroY.toFixed(1)} Z`;

    const ddLine = ddPts.map((p) => `${xS(p.x).toFixed(1)},${yDDS(p.y).toFixed(1)}`).join(" L ");
    const ddArea = `M ${xS(0).toFixed(1)},${yDDS(0).toFixed(1)} L ${ddLine} L ${xS(trades.length).toFixed(1)},${yDDS(0).toFixed(1)} Z`;

    const sym = ccy === "INR" ? "₹" : "$";
    const fmt = (v: number) => `${v < 0 ? "-" : ""}${sym}${Math.abs(Math.round(v / 1000))}k`;

    return (
      <div className="grid gap-3 md:grid-cols-2">
        {/* Equity Curve */}
        <div className="rounded-lg border border-border bg-panel-2 p-2">
          <div className="label-eyebrow mb-1 px-1">Cumulative Net P&amp;L</div>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
            <defs>
              <linearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--call))" stopOpacity="0.15" />
                <stop offset="100%" stopColor="hsl(var(--call))" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* grid */}
            {[minY, 0, maxY / 2, maxY].map((v) => (
              <g key={v}>
                <line x1={pad.l} x2={W - pad.r} y1={yS(v)} y2={yS(v)} stroke="hsl(var(--border))" strokeWidth={v === 0 ? 1 : 0.5} strokeDasharray={v === 0 ? "0" : "3 3"} />
                <text x={pad.l - 6} y={yS(v) + 3} textAnchor="end" className="fill-fg-subtle tnum" fontSize={9}>{fmt(v)}</text>
              </g>
            ))}
            <path d={eqArea} fill="url(#eq-grad)" />
            <path d={eqPath} fill="none" stroke="hsl(var(--call))" strokeWidth={2} />
          </svg>
        </div>

        {/* Drawdowns */}
        <div className="rounded-lg border border-border bg-panel-2 p-2">
          <div className="label-eyebrow mb-1 px-1 text-put">Portfolio Peak Drawdowns</div>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
            <defs>
              <linearGradient id="dd-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--put))" stopOpacity="0.18" />
                <stop offset="100%" stopColor="hsl(var(--put))" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* grid */}
            {[minDDY, minDDY / 2, 0].map((v) => (
              <g key={v}>
                <line x1={pad.l} x2={W - pad.r} y1={yDDS(v)} y2={yDDS(v)} stroke="hsl(var(--border))" strokeWidth={v === 0 ? 1 : 0.5} strokeDasharray={v === 0 ? "0" : "3 3"} />
                <text x={pad.l - 6} y={yDDS(v) + 3} textAnchor="end" className="fill-fg-subtle tnum" fontSize={9}>{v.toFixed(1)}%</text>
              </g>
            ))}
            <path d={ddArea} fill="url(#dd-grad)" />
            <path d={`M ${ddLine}`} fill="none" stroke="hsl(var(--put))" strokeWidth={1.5} />
          </svg>
        </div>
      </div>
    );
  };

  // Render Monthly Heatmap Grid
  const renderMonthlyGrid = () => {
    if (!results) return null;
    const { monthlyReturns } = results;

    const grouped = monthlyReturns.reduce((acc, curr) => {
      if (!acc[curr.year]) acc[curr.year] = {};
      acc[curr.year][curr.month] = curr.pnl;
      return acc;
    }, {} as Record<number, Record<string, number>>);

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const years = Object.keys(grouped).map(Number).sort((a, b) => b - a); // descending

    const sym = ccy === "INR" ? "₹" : "$";

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-2xs border-collapse">
          <thead>
            <tr className="bg-bg-sunken text-fg-subtle border-b border-border">
              <th className="px-3 py-2 text-left font-semibold">Year</th>
              {months.map((m) => (
                <th key={m} className="px-2 py-2 text-center font-semibold w-14">{m}</th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => {
              const rowMonths = grouped[y] || {};
              let yearSum = 0;
              return (
                <tr key={y} className="border-b border-border hover:bg-bg-sunken/30">
                  <td className="px-3 py-2 font-bold text-fg">{y}</td>
                  {months.map((m) => {
                    const pnl = rowMonths[m] || 0;
                    yearSum += pnl;
                    const displayVal = pnl !== 0 
                      ? `${pnl > 0 ? "+" : ""}${Math.round(pnl / (ccy === "INR" ? 1000 : 100))}k`
                      : "—";
                    return (
                      <td
                        key={m}
                        className={cn(
                          "px-2 py-2 text-center font-semibold tnum",
                          pnl > 0 
                            ? "bg-call/10 text-call" 
                            : pnl < 0 
                              ? "bg-put/10 text-put" 
                              : "text-fg-subtle"
                        )}
                      >
                        {displayVal}
                      </td>
                    );
                  })}
                  <td className={cn("px-3 py-2 text-right font-bold tnum", yearSum >= 0 ? "text-call" : "text-put")}>
                    {yearSum >= 0 ? "+" : ""}
                    {money(yearSum, ccy, 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Historical Strategy Backtester"
        desc="Examine historical win rates, drawdowns, and monthly returns of core option models."
        icon="bar-chart-3"
      />

      {/* Configurations panel */}
      <div className="grid gap-3 lg:grid-cols-12 mb-3">
        <Panel className="lg:col-span-12" eyebrow="Backtest Settings" title="Structure & Exit Rules">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5 items-end">
            <div>
              <label className="label-eyebrow block mb-1">Strategy Type</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-sunken px-2.5 py-1.5 text-2xs font-semibold text-fg"
              >
                <option value="short-straddle">Short Straddle (ATM)</option>
                <option value="iron-condor">Iron Condor (Defined Risk)</option>
                <option value="bull-call-spread">Bull Call Spread (Bullish)</option>
                <option value="bear-put-spread">Bear Put Spread (Bearish)</option>
              </select>
            </div>

            <div>
              <label className="label-eyebrow block mb-1">DTE at Entry</label>
              <select
                value={dteEntry}
                onChange={(e) => setDteEntry(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-sunken px-2.5 py-1.5 text-2xs font-semibold text-fg"
              >
                <option value="7">7 Days (Weekly)</option>
                <option value="15">15 Days (Bi-weekly)</option>
                <option value="30">30 Days (Monthly)</option>
              </select>
            </div>

            <div>
              <label className="label-eyebrow block mb-1">Stop Loss (% of Premium)</label>
              <select
                value={stopLossPct}
                onChange={(e) => setStopLossPct(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-sunken px-2.5 py-1.5 text-2xs font-semibold text-fg"
              >
                <option value="20">20% SL</option>
                <option value="30">30% SL</option>
                <option value="40">40% SL</option>
                <option value="50">50% SL</option>
                <option value="100">100% SL</option>
              </select>
            </div>

            <div>
              <label className="label-eyebrow block mb-1">Target Profit (% of Premium)</label>
              <select
                value={targetProfitPct}
                onChange={(e) => setTargetProfitPct(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-sunken px-2.5 py-1.5 text-2xs font-semibold text-fg"
              >
                <option value="20">20% Target</option>
                <option value="30">30% Target</option>
                <option value="40">40% Target</option>
                <option value="50">50% Target</option>
                <option value="75">75% Target</option>
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="label-eyebrow block mb-1">Period</label>
                <select
                  value={periodYears}
                  onChange={(e) => setPeriodYears(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg-sunken px-2.5 py-1.5 text-2xs font-semibold text-fg"
                >
                  <option value="1">1 Year</option>
                  <option value="2">2 Years</option>
                </select>
              </div>

              <button
                onClick={runBacktest}
                disabled={running}
                className={cn(
                  "rounded-lg bg-brand px-4 py-2 text-2xs font-bold text-white shadow-md hover:bg-brand/90 transition-all flex items-center justify-center shrink-0 h-[28px] self-end focus-ring",
                  running ? "opacity-60 cursor-wait" : ""
                )}
              >
                {running ? (
                  <>
                    <Icon name="refresh" size={12} className="animate-spin mr-1" /> Simulating...
                  </>
                ) : (
                  <>Run Backtest</>
                )}
              </button>
            </div>
          </div>
        </Panel>
      </div>

      {completed && results && (
        <div className="space-y-3">
          {/* Key Metrics Cards */}
          <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-6">
            <MetricCard label="Net Profit" value={money(results.netProfit, ccy, 0)} tone={results.netProfit >= 0 ? "call" : "put"} />
            <MetricCard label="Win Rate" value={`${results.winRate.toFixed(1)}%`} tone={results.winRate >= 50 ? "call" : "put"} />
            <MetricCard label="Total Trades" value={results.totalTrades.toString()} />
            <MetricCard label="Profit Factor" value={results.profitFactor.toFixed(2)} tone={results.profitFactor >= 1.2 ? "call" : "put"} />
            <MetricCard label="Max Drawdown" value={`${results.maxDrawdown.toFixed(1)}%`} tone="put" />
            <MetricCard label="Avg Win / Loss" value={`${Math.round(results.avgWin / (ccy === "INR" ? 100 : 1))} / ${Math.round(results.avgLoss / (ccy === "INR" ? 100 : 1))}`} sub="scaled unit" />
          </div>

          {/* SVG curves */}
          {renderBacktestCharts()}

          {/* Monthly returns Heatmap */}
          <Panel eyebrow="Performance breakdown" title="Monthly Returns Grid">
            {renderMonthlyGrid()}
          </Panel>

          {/* Trade log list */}
          <Panel eyebrow="Backtest Ledger" title="Simulated Trade Logs">
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-2xs border-collapse">
                <thead>
                  <tr className="bg-bg-sunken text-fg-subtle border-b border-border sticky top-0">
                    <th className="px-3 py-2 text-left font-semibold">Trade ID</th>
                    <th className="px-3 py-2 text-left font-semibold">Entry Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Exit Date</th>
                    <th className="px-3 py-2 text-right font-semibold">Entry Spot</th>
                    <th className="px-3 py-2 text-right font-semibold">Exit Spot</th>
                    <th className="px-3 py-2 text-center font-semibold">Exit Reason</th>
                    <th className="px-3 py-2 text-right font-semibold">Days Held</th>
                    <th className="px-3 py-2 text-right font-semibold">P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {results.trades.map((t) => (
                    <tr key={t.id} className="border-b border-border hover:bg-bg-sunken/40">
                      <td className="px-3 py-2 font-bold text-fg">{t.id}</td>
                      <td className="px-3 py-2 text-fg-muted">{t.entryDate}</td>
                      <td className="px-3 py-2 text-fg-muted">{t.exitDate}</td>
                      <td className="px-3 py-2 text-right tnum">{t.entrySpot.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                      <td className="px-3 py-2 text-right tnum">{t.exitSpot.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={cn(
                            "chip capitalize",
                            t.reason === "target" 
                              ? "bg-call/10 text-call" 
                              : t.reason === "stop" 
                                ? "bg-put/10 text-put" 
                                : "bg-bg-sunken text-fg-subtle"
                          )}
                        >
                          {t.reason}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tnum">{t.daysHeld}d</td>
                      <td className={cn("px-3 py-2 text-right font-bold tnum", t.pnl >= 0 ? "text-call" : "text-put")}>
                        {t.pnl >= 0 ? "+" : ""}
                        {money(t.pnl, ccy, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {!completed && !running && (
        <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl bg-panel/30 py-24 text-center">
          <Icon name="radar" size={32} className="text-brand/40 animate-pulse-soft mb-3" />
          <h3 className="text-sm font-semibold text-fg">Backtester ready</h3>
          <p className="text-2xs text-fg-subtle max-w-xs mt-1 leading-relaxed">
            Select a strategy and configure your target and stop metrics, then click "Run Backtest" to evaluate historical performance.
          </p>
        </div>
      )}
    </>
  );
}

function MetricCard({
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
    <div className="rounded-xl border border-border bg-panel p-2.5">
      <div className="label-eyebrow text-3xs">{label}</div>
      <div
        className={cn(
          "tnum mt-1 text-xs sm:text-[13px] font-bold leading-none",
          tone === "call" ? "text-call" : tone === "put" ? "text-put" : "text-fg"
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-3xs text-fg-subtle">{sub}</div> : null}
    </div>
  );
}
