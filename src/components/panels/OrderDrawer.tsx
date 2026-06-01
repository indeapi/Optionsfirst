"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store/app";
import { useMarket } from "@/components/providers/market";
import { calculateRequiredMargin } from "@/lib/quant/margin";
import { Icon } from "@/components/ui/Icon";
import { cn, money } from "@/lib/utils";
import type { Leg } from "@/lib/quant/payoff";
import { alpaca } from "@/lib/data/live/alpaca";

export function OrderDrawer() {
  const activeDraftOrder = useAppStore((s) => s.activeDraftOrder);
  const setActiveDraftOrder = useAppStore((s) => s.setActiveDraftOrder);
  const brokerConnections = useAppStore((s) => s.brokerConnections);
  const addVirtualPosition = useAppStore((s) => s.addVirtualPosition);
  const addClosedTrade = useAppStore((s) => s.addClosedTrade);

  const { snapshot } = useMarket();

  // Multi-leg order builder state
  const [legs, setLegs] = useState<Leg[]>([]);
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>("alpaca");
  const [isExecuting, setIsExecuting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync draft order into local list of legs when draft order changes
  useEffect(() => {
    if (activeDraftOrder) {
      setLegs([{ ...activeDraftOrder }]);
      setSuccessMsg(null);
      setIsExecuting(false);
      // Auto-select a connected broker if available
      const connected = Object.values(brokerConnections).find((b) => b.connected);
      if (connected) {
        setSelectedBrokerId(connected.id);
      } else {
        setSelectedBrokerId("alpaca");
      }
    }
  }, [activeDraftOrder, brokerConnections]);

  if (!activeDraftOrder || !snapshot) return null;

  const { chain } = snapshot;
  const spot = chain.spot;
  const lotSize = chain.instrument.lotSize;
  const ccy = chain.instrument.currency;
  const region = chain.instrument.region;

  // Selected Broker Details
  const broker = brokerConnections[selectedBrokerId] || brokerConnections.alpaca;
  const isBrokerConnected = broker.connected;

  // Striking prices for additional leg dropdowns
  const strikes = chain.rows.map((r) => r.strike).sort((a, b) => a - b);

  // Greek helper for the display
  const getPremium = (strike: number, right: "CE" | "PE") => {
    const row = chain.rows.find((r) => r.strike === strike);
    return row ? (right === "CE" ? row.call.ltp : row.put.ltp) : 5.0;
  };

  // Add leg to this specific draft inside drawer
  const handleAddLeg = () => {
    if (legs.length >= 8) return;
    const defaultStrike = strikes[Math.floor(strikes.length / 2)];
    const defaultPremium = getPremium(defaultStrike, "CE");
    const newLeg: Leg = {
      action: "buy",
      right: "CE",
      strike: defaultStrike,
      qty: 1,
      premium: defaultPremium,
      expiry: chain.expiry || undefined,
    };
    setLegs([...legs, newLeg]);
  };

  const handleUpdateLeg = (idx: number, updates: Partial<Leg>) => {
    const updated = [...legs];
    const item = { ...updated[idx], ...updates };

    if (updates.strike !== undefined || updates.right !== undefined) {
      if (item.right !== "EQ") {
        item.premium = getPremium(item.strike, item.right as "CE" | "PE");
      } else {
        item.premium = spot;
      }
    }
    updated[idx] = item;
    setLegs(updated);
  };

  const handleRemoveLeg = (idx: number) => {
    if (legs.length === 1) {
      // If we remove the last leg, close the drawer
      setActiveDraftOrder(null);
      return;
    }
    setLegs(legs.filter((_, i) => i !== idx));
  };

  // Run the dynamic margin calculations
  const marginResult = calculateRequiredMargin(legs, spot, lotSize);

  // Fund Validation
  // User buying power
  const currentBuyingPower = broker.buyingPower;
  const isSufficientFunds = currentBuyingPower >= marginResult.actualCapitalRequired;

  const handleTransmit = async () => {
    setIsExecuting(true);
    setSuccessMsg(null);
    try {
      // Compute strategy name
      let strategyName = "Custom Order";
      if (legs.length === 1) {
        strategyName = `${legs[0].action === "buy" ? "Long" : "Short"} ${legs[0].strike} ${legs[0].right}`;
      } else if (legs.length === 2) {
        if (legs[0].right === legs[1].right && legs[0].action !== legs[1].action) {
          strategyName = `${legs[0].right === "CE" ? "Call" : "Put"} Spread`;
        }
      }

      if (selectedBrokerId === "alpaca") {
        const { formatAlpacaOptionSymbol } = await import("@/lib/data/live/alpaca");
        
        // Execute each leg on Alpaca
        const promises = legs.map((leg) => {
          const optionSymbol = formatAlpacaOptionSymbol(
            chain.instrument.symbol,
            chain.expiry || leg.expiry || "",
            leg.right,
            leg.strike
          );
          return alpaca.placeOrder({
            symbol: optionSymbol,
            qty: leg.qty,
            side: leg.action,
            type: "market",
            limitPrice: leg.premium,
          });
        });

        const results = await Promise.all(promises);
        const orderIds = results.map((r) => r.id).join(", ");

        // Refresh Alpaca details
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

        // Add to simulated holdings
        const positionId = `order-${Date.now()}`;
        addVirtualPosition({
          id: positionId,
          symbol: chain.instrument.symbol,
          region: chain.instrument.region,
          strategyId: "alpaca-options",
          strategyName,
          legs: legs.map((l) => ({ ...l })),
          qtyLots: 1,
          lotSize,
          currency: ccy,
          entryNet: (marginResult.netCredit - marginResult.netDebit),
          target: 1000,
          stop: -1000,
          openedAt: Date.now(),
        });

        // Log to Closed Trades history for journaling
        addClosedTrade({
          id: positionId,
          symbol: chain.instrument.symbol,
          strategyName,
          legsCount: legs.length,
          requiredMargin: marginResult.totalMargin,
          netCredit: marginResult.netCredit,
          netDebit: marginResult.netDebit,
          capitalRequired: marginResult.actualCapitalRequired,
          brokerName: "Alpaca API",
          brokerAccount: acc.accountNumber,
          timestamp: Date.now(),
          status: "FILLED",
          details: `Filled orders: ${orderIds}`,
        });

        setSuccessMsg("Alpaca order filled successfully!");
      } else {
        // Fallback for standard simulated brokers
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const positionId = `order-${Date.now()}`;
        addVirtualPosition({
          id: positionId,
          symbol: chain.instrument.symbol,
          region: chain.instrument.region,
          strategyId: "custom-order",
          strategyName,
          legs: legs.map((l) => ({ ...l })),
          qtyLots: 1,
          lotSize,
          currency: ccy,
          entryNet: (marginResult.netCredit - marginResult.netDebit),
          target: 1000,
          stop: -1000,
          openedAt: Date.now(),
        });

        // Log to Closed Trades history for journaling
        addClosedTrade({
          id: positionId,
          symbol: chain.instrument.symbol,
          strategyName,
          legsCount: legs.length,
          requiredMargin: marginResult.totalMargin,
          netCredit: marginResult.netCredit,
          netDebit: marginResult.netDebit,
          capitalRequired: marginResult.actualCapitalRequired,
          brokerName: broker.name,
          brokerAccount: broker.accountNo || "SIM",
          timestamp: Date.now(),
          status: "OPEN",
        });

        setSuccessMsg("Order filled! Placed into portfolio ledger.");
      }

      setIsExecuting(false);
      setTimeout(() => {
        setActiveDraftOrder(null);
      }, 1800);
    } catch (err: any) {
      setIsExecuting(false);
      alert(`Order Execution Error: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-bg-elev/95 shadow-2xl backdrop-blur-md animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-panel-2/50">
        <div className="flex items-center gap-2">
          <div className="rounded bg-brand/10 p-1 text-brand">
            <Icon name="wallet" size={14} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-fg">Side Order Window</h3>
            <p className="text-[10px] text-fg-subtle">{chain.instrument.name} · {chain.expiry}</p>
          </div>
        </div>
        <button
          onClick={() => setActiveDraftOrder(null)}
          className="rounded-lg p-1 text-fg-subtle hover:bg-bg-sunken hover:text-fg"
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Legs configurer */}
        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="label-eyebrow">Order Legs ({legs.length}/8)</span>
            <button
              onClick={handleAddLeg}
              disabled={legs.length >= 8}
              className="text-[10px] font-bold text-brand hover:underline flex items-center gap-0.5"
            >
              + Add Leg
            </button>
          </div>

          <div className="space-y-2">
            {legs.map((leg, idx) => (
              <div
                key={idx}
                className={cn(
                  "relative rounded-lg border border-border p-2.5 space-y-2",
                  leg.action === "buy" ? "bg-call/5 border-call/20" : "bg-put/5 border-put/20"
                )}
              >
                {/* Delete button */}
                <button
                  onClick={() => handleRemoveLeg(idx)}
                  className="absolute right-2 top-2 text-fg-subtle hover:text-put text-xs font-semibold"
                >
                  ✕
                </button>

                <div className="grid grid-cols-12 gap-1.5 items-center">
                  {/* B/S */}
                  <div className="col-span-3">
                    <select
                      value={leg.action}
                      onChange={(e) => handleUpdateLeg(idx, { action: e.target.value as "buy" | "sell" })}
                      className="w-full rounded border border-border bg-panel px-1.5 py-0.5 text-3xs font-bold uppercase text-fg"
                    >
                      <option value="buy">Buy</option>
                      <option value="sell">Sell</option>
                    </select>
                  </div>

                  {/* Type */}
                  <div className="col-span-3">
                    <select
                      value={leg.right}
                      onChange={(e) => handleUpdateLeg(idx, { right: e.target.value as "CE" | "PE" | "EQ" })}
                      className="w-full rounded border border-border bg-panel px-1.5 py-0.5 text-3xs font-semibold text-fg"
                    >
                      <option value="CE">Call</option>
                      <option value="PE">Put</option>
                      <option value="EQ">Stock</option>
                    </select>
                  </div>

                  {/* Strike */}
                  <div className="col-span-3">
                    {leg.right === "EQ" ? (
                      <span className="text-3xs text-fg-subtle pl-1">—</span>
                    ) : (
                      <select
                        value={leg.strike}
                        onChange={(e) => handleUpdateLeg(idx, { strike: Number(e.target.value) })}
                        className="w-full rounded border border-border bg-panel px-1.5 py-0.5 text-3xs font-semibold text-fg"
                      >
                        {strikes.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Qty */}
                  <div className="col-span-3 pr-4">
                    <input
                      type="number"
                      min="1"
                      value={leg.qty}
                      onChange={(e) => handleUpdateLeg(idx, { qty: Math.max(1, Number(e.target.value)) })}
                      className="w-full rounded border border-border bg-panel px-1.5 py-0.5 text-3xs text-right text-fg font-semibold"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-3xs text-fg-subtle">
                  <span>Spot: {money(spot, ccy, 0)}</span>
                  <div className="flex items-center gap-1.5">
                    <span>Premium / Price:</span>
                    <input
                      type="number"
                      step="0.05"
                      value={leg.premium}
                      onChange={(e) => handleUpdateLeg(idx, { premium: Number(e.target.value) })}
                      className="w-14 rounded border border-border bg-panel px-1 text-3xs text-right text-fg font-bold tnum"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Broker Selection & Status */}
        <div className="rounded-xl border border-border bg-panel-2/60 p-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="label-eyebrow">Destination Account</span>
            <span
              className={cn(
                "chip text-[9px] px-1 py-0.5 font-bold",
                isBrokerConnected ? "bg-call/10 text-call" : "bg-warn/10 text-warn"
              )}
            >
              {isBrokerConnected ? "SYNCED" : "OFFLINE / SIM"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <select
                value={selectedBrokerId}
                onChange={(e) => setSelectedBrokerId(e.target.value)}
                className="w-full rounded-lg border border-border bg-panel px-2.5 py-1.5 text-3xs font-semibold text-fg"
              >
                {Object.values(brokerConnections).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-right">
              <div className="text-4xs text-fg-subtle uppercase font-semibold">Buying Power Available</div>
              <div className="text-xs font-bold text-fg tnum">
                {money(currentBuyingPower, ccy, 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Quant Margin Breakdown */}
        <div className="rounded-xl border border-border bg-panel-2/40 p-3 space-y-2.5">
          <span className="label-eyebrow">Margin & Risk Valuation</span>

          <div className="space-y-1 text-2xs">
            {marginResult.legsBreakdown.map((item, i) => (
              <div key={i} className="flex justify-between border-b border-border/40 pb-1">
                <span className="text-fg-subtle">{item.type}</span>
                <span className="font-semibold text-fg tnum">{money(item.margin, ccy, 0)}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-2.5">
            <div>
              <div className="text-4xs text-fg-subtle uppercase">Net Debit</div>
              <div className="text-xs font-bold text-fg tnum">
                {money(marginResult.netDebit, ccy, 0)}
              </div>
            </div>
            <div>
              <div className="text-4xs text-fg-subtle uppercase">Net Credit</div>
              <div className="text-xs font-bold text-fg tnum">
                {money(marginResult.netCredit, ccy, 0)}
              </div>
            </div>
            <div>
              <div className="text-4xs text-fg-subtle uppercase">Margin Required</div>
              <div className="text-xs font-bold text-fg tnum">
                {money(marginResult.totalMargin, ccy, 0)}
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-bg-sunken p-2.5 flex justify-between items-center">
            <div>
              <div className="text-[10px] font-bold text-fg">Actual Capital Required</div>
              <div className="text-4xs text-fg-subtle">Estimated cash impact on entry</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black text-brand tnum">
                {money(marginResult.actualCapitalRequired, ccy, 0)}
              </div>
            </div>
          </div>

          {/* Sizing & Margin warnings */}
          <div className="pt-1">
            {isSufficientFunds ? (
              <div className="flex items-center gap-1.5 text-3xs font-semibold text-call bg-call/5 border border-call/10 rounded px-2 py-1.5">
                <Icon name="check" size={10} className="text-call" />
                <span>Sufficient Buying Power available to execute this strategy.</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-3xs font-semibold text-put bg-put/5 border border-put/10 rounded px-2 py-1.5">
                <Icon name="alert-triangle" size={10} className="text-put" />
                <span>Insufficient Funds: Required capital exceeds available buying power.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3 bg-panel-2/50 flex flex-col gap-2">
        {successMsg ? (
          <div className="flex items-center justify-center gap-1 text-2xs font-bold text-call animate-fade-in py-2">
            <Icon name="check" size={12} strokeWidth={3} /> {successMsg}
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setActiveDraftOrder(null)}
              className="flex-1 rounded-lg border border-border bg-panel py-2 text-2xs font-bold text-fg hover:bg-bg-sunken"
            >
              Cancel
            </button>
            <button
              onClick={handleTransmit}
              disabled={isExecuting || !isSufficientFunds}
              className={cn(
                "flex-[2] rounded-lg px-4 py-2 text-2xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-1",
                isExecuting ? "bg-fg-subtle cursor-wait" : "bg-call hover:bg-call/90",
                (!isSufficientFunds) && "bg-fg-subtle hover:bg-fg-subtle opacity-50 cursor-not-allowed"
              )}
            >
              {isExecuting ? (
                <>
                  <Icon name="refresh" size={10} className="animate-spin" /> Placing Order...
                </>
              ) : (
                <>
                  <Icon name="wallet" size={10} /> Transmit Order
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
