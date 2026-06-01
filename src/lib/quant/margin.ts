import type { Leg } from "./payoff";

export interface MarginBreakdown {
  totalMargin: number;
  netDebit: number;
  netCredit: number;
  actualCapitalRequired: number;
  legsBreakdown: {
    type: string;
    description: string;
    margin: number;
  }[];
}

/**
 * Calculates the required margin and capital requirements for a set of options and stock legs.
 * Implements standard exchange margin guidelines:
 * - Long options: 100% premium debit.
 * - Naked short options: max of (Premium + 20% * Spot - OTM, Premium + 10% * Spot) * Qty * LotSize.
 * - Spreads: capped at the maximum strike width minus credit received (for credit spreads) or net debit (for debit spreads).
 * - Covered Calls: Buy Stock + Sell Call. Margin is the stock cost minus call premium.
 */
export function calculateRequiredMargin(
  legs: Leg[],
  spot: number,
  lotSize: number
): MarginBreakdown {
  if (legs.length === 0) {
    return {
      totalMargin: 0,
      netDebit: 0,
      netCredit: 0,
      actualCapitalRequired: 0,
      legsBreakdown: [],
    };
  }

  let totalMargin = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  const legsBreakdown: { type: string; description: string; margin: number }[] = [];

  // Deep copy legs to avoid modifying the input array
  const activeLegs = legs.map((l) => ({ ...l, remainingQty: l.qty }));

  // Separate stock legs from option legs
  const stockLegs = activeLegs.filter((l) => l.right === "EQ");
  const optionLegs = activeLegs.filter((l) => l.right !== "EQ");

  // 1. Identify Covered Calls / Covered Puts (Stock + Options)
  for (const sLeg of stockLegs) {
    if (sLeg.remainingQty <= 0) continue;

    if (sLeg.action === "buy") {
      // Look for Sell Calls to cover (Covered Call)
      const callLeg = optionLegs.find(
        (o) => o.right === "CE" && o.action === "sell" && o.remainingQty > 0
      );

      if (callLeg) {
        const coveredQty = Math.min(sLeg.remainingQty, callLeg.remainingQty);
        sLeg.remainingQty -= coveredQty;
        callLeg.remainingQty -= coveredQty;

        // Covered Call Margin/Capital: Buy Stock @ Spot/Premium, Sell Call @ Premium
        const stockCost = sLeg.premium * coveredQty * lotSize;
        const callCredit = callLeg.premium * coveredQty * lotSize;
        const margin = Math.max(0, stockCost - callCredit);

        totalMargin += margin;
        legsBreakdown.push({
          type: "Covered Call",
          description: `${coveredQty}x Long Stock @ ${sLeg.premium} + Short ${callLeg.strike} Call @ ${callLeg.premium}`,
          margin,
        });
      }
    } else {
      // Short Stock (Sell Stock)
      // Look for Sell Puts (Covered Put / Secured Put)
      const putLeg = optionLegs.find(
        (o) => o.right === "PE" && o.action === "sell" && o.remainingQty > 0
      );

      if (putLeg) {
        const coveredQty = Math.min(sLeg.remainingQty, putLeg.remainingQty);
        sLeg.remainingQty -= coveredQty;
        putLeg.remainingQty -= coveredQty;

        const stockCredit = sLeg.premium * coveredQty * lotSize;
        const putCredit = putLeg.premium * coveredQty * lotSize;
        // Short stock requires margin (typically 150% of stock value)
        const margin = sLeg.premium * 1.5 * coveredQty * lotSize - putCredit;

        totalMargin += margin;
        legsBreakdown.push({
          type: "Covered Put",
          description: `${coveredQty}x Short Stock @ ${sLeg.premium} + Short ${putLeg.strike} Put @ ${putLeg.premium}`,
          margin,
        });
      }
    }
  }

  // Handle remaining unpaired stock legs
  for (const sLeg of stockLegs) {
    if (sLeg.remainingQty <= 0) continue;
    const cost = sLeg.premium * sLeg.remainingQty * lotSize;
    if (sLeg.action === "buy") {
      totalMargin += cost;
      legsBreakdown.push({
        type: "Long Stock",
        description: `${sLeg.remainingQty}x Long Stock @ ${sLeg.premium}`,
        margin: cost,
      });
    } else {
      const margin = sLeg.premium * 1.5 * sLeg.remainingQty * lotSize;
      totalMargin += margin;
      legsBreakdown.push({
        type: "Short Stock (Naked)",
        description: `${sLeg.remainingQty}x Short Stock @ ${sLeg.premium}`,
        margin,
      });
    }
  }

  // 2. Pair Spreads (1 Long Option + 1 Short Option of same type CE/PE)
  const calls = optionLegs.filter((l) => l.right === "CE");
  const puts = optionLegs.filter((l) => l.right === "PE");

  const pairSpreads = (legsList: typeof optionLegs, type: "Call" | "Put") => {
    const buys = legsList.filter((l) => l.action === "buy");
    const sells = legsList.filter((l) => l.action === "sell");

    for (const sell of sells) {
      if (sell.remainingQty <= 0) continue;

      // Find matching buy leg (we can match starting with closest strikes to optimize margin)
      const sortedBuys = [...buys]
        .filter((b) => b.remainingQty > 0)
        .sort((a, b) => Math.abs(a.strike - sell.strike) - Math.abs(b.strike - sell.strike));

      for (const buy of sortedBuys) {
        if (sell.remainingQty <= 0) break;
        if (buy.remainingQty <= 0) continue;

        const qty = Math.min(sell.remainingQty, buy.remainingQty);
        sell.remainingQty -= qty;
        buy.remainingQty -= qty;

        const strikeWidth = Math.abs(buy.strike - sell.strike);

        // Check if Credit or Debit Spread
        const isCredit =
          type === "Call"
            ? sell.strike < buy.strike // Sell lower strike = credit
            : sell.strike > buy.strike; // Sell higher strike = credit

        if (isCredit) {
          const credit = (sell.premium - buy.premium) * qty * lotSize;
          const maxRisk = strikeWidth * qty * lotSize;
          const margin = Math.max(0, maxRisk - credit);

          totalMargin += margin;
          totalCredit += credit;
          legsBreakdown.push({
            type: `${type} Credit Spread`,
            description: `${qty}x Spread: Buy ${buy.strike} / Sell ${sell.strike}`,
            margin,
          });
        } else {
          const debit = (buy.premium - sell.premium) * qty * lotSize;
          totalMargin += debit;
          totalDebit += debit;
          legsBreakdown.push({
            type: `${type} Debit Spread`,
            description: `${qty}x Spread: Buy ${buy.strike} / Sell ${sell.strike}`,
            margin: debit,
          });
        }
      }
    }
  };

  pairSpreads(calls, "Call");
  pairSpreads(puts, "Put");

  // 3. Process leftover option legs (pure long or naked short)
  for (const leg of optionLegs) {
    if (leg.remainingQty <= 0) continue;

    const qty = leg.remainingQty;
    const premiumCost = leg.premium * qty * lotSize;

    if (leg.action === "buy") {
      // Long option: requires 100% of premium
      totalMargin += premiumCost;
      totalDebit += premiumCost;
      legsBreakdown.push({
        type: `Long ${leg.right === "CE" ? "Call" : "Put"}`,
        description: `${qty}x Buy ${leg.strike} ${leg.right} @ ${leg.premium}`,
        margin: premiumCost,
      });
    } else {
      // Naked short option margin calculation
      // Call: OTM = max(0, strike - spot)
      // Put: OTM = max(0, spot - strike)
      const otm =
        leg.right === "CE" ? Math.max(0, leg.strike - spot) : Math.max(0, spot - leg.strike);

      // standard naked option margin formula:
      // max(Premium + 20% * Spot - OTM, Premium + 10% * Spot) * Qty * LotSize
      const marginPerUnit = Math.max(
        leg.premium + 0.2 * spot - otm,
        leg.premium + 0.1 * spot
      );
      const nakedMargin = marginPerUnit * qty * lotSize;

      totalMargin += nakedMargin;
      totalCredit += premiumCost;
      legsBreakdown.push({
        type: `Short ${leg.right === "CE" ? "Call" : "Put"} (Naked)`,
        description: `${qty}x Sell ${leg.strike} ${leg.right} @ ${leg.premium} (OTM: ${otm.toFixed(1)})`,
        margin: nakedMargin,
      });
    }
  }

  // Calculate Net P&L premium cashflow
  const netPremiumVal = totalCredit - totalDebit;
  const netDebit = netPremiumVal < 0 ? Math.abs(netPremiumVal) : 0;
  const netCredit = netPremiumVal > 0 ? netPremiumVal : 0;

  // Actual capital required is the debit paid up front plus any option margin required for short positions
  // For naked shorts, it's the margin required minus credit received.
  // For spreads, totalMargin already reflects (strikeWidth - credit) or (debit).
  // Let's compute actual capital required to execute the trade
  const actualCapitalRequired = Math.max(0, totalMargin);

  return {
    totalMargin,
    netDebit,
    netCredit,
    actualCapitalRequired,
    legsBreakdown,
  };
}
