/**
 * Hermes orchestration.
 *
 * runHermes() dispatches the specialist agents over a market snapshot, collects
 * their findings, records exactly what each one did (the workflow trace), and
 * has Hermes compose the single desk brief. The UI renders both the brief and
 * the trace so the trader can see which agent produced which insight.
 */

import type { MarketSnapshot } from "@/lib/data/provider";
import type { OptionChain } from "@/lib/data/types";
import type { RemittanceAlert } from "./fx";
import { monitorFindings, type PositionMark } from "./monitor";
import type { Finding, WorkflowStep } from "./registry";

export interface AgentRunResult {
  steps: WorkflowStep[];
  findings: Finding[];
  brief: string;
  ranAt: number;
}

function sym(chain: OptionChain): string {
  return chain.instrument.currency === "INR" ? "₹" : "$";
}
function money(chain: OptionChain, v: number, dp = 0): string {
  return `${sym(chain)}${v.toLocaleString(undefined, { maximumFractionDigits: dp })}`;
}
function lvl(chain: OptionChain, v: number): string {
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function runHermes(
  snapshot: MarketSnapshot,
  opts: { remittance?: RemittanceAlert[]; marks?: PositionMark[] } = {},
): AgentRunResult {
  const { chain, analytics, condition, ranked, dte } = snapshot;
  const steps: WorkflowStep[] = [];
  const findings: Finding[] = [];
  const ranAt = Date.now();

  // ---- Iris: data integrity & freshness ----
  const fresh = chain.freshness;
  const simCount = Object.values(fresh).filter((p) => p?.simulated).length;
  const oiProv = fresh.oi;
  const oiCadence =
    chain.instrument.region === "IN"
      ? "OI is delayed ~3 min (NSE cadence)"
      : "OI is end-of-day only (OCC settlement)";
  steps.push({
    agent: "iris",
    action: `Audited provenance on ${Object.keys(fresh).length} fields`,
    inputs: ["broker feed", "field timestamps"],
    outputs: ["delay map", `${simCount} ★ simulated`],
    status: simCount > 0 ? "degraded" : "ok",
    note: `${oiCadence}. ${simCount > 0 ? "Live feed not attached — values ★ simulated." : "All fields live."}`,
    ms: 8,
  });
  if (simCount > 0) {
    findings.push({
      agent: "iris",
      severity: "watch",
      title: "Running on simulated data ★",
      detail: `No live ${chain.instrument.feed} session — every value is ★ simulated. Connect the broker to switch to live. ${oiCadence} even when live.`,
      metric: `${simCount} fields ★`,
    });
  }
  if (oiProv) {
    findings.push({
      agent: "iris",
      severity: "info",
      title: "Open Interest freshness",
      detail: `${oiCadence}. ${oiProv.label}. Treat OI-derived signals (max-pain, PCR) as ${chain.instrument.region === "IN" ? "lagged a few minutes" : "yesterday's settled figure"}.`,
      metric: oiProv.mode === "eod" ? "EOD" : "~3m",
    });
  }

  // ---- Argus: positioning ----
  const maxPainVsSpot = analytics.maxPain - chain.spot;
  steps.push({
    agent: "argus",
    action: "Aggregated OI, solved max-pain, mapped walls",
    inputs: ["call/put OI", "OI change"],
    outputs: ["PCR", "max-pain", "support/resistance"],
    status: "ok",
    note: `PCR ${analytics.pcr.toFixed(2)}, max-pain ${lvl(chain, analytics.maxPain)}.`,
    ms: 14,
  });
  findings.push({
    agent: "argus",
    severity: analytics.pcr > 1.2 ? "positive" : analytics.pcr < 0.8 ? "watch" : "info",
    title: `Put-Call Ratio ${analytics.pcr.toFixed(2)}`,
    detail: `${
      analytics.pcr > 1.2
        ? "Put-heavy positioning — supportive / potential short-covering fuel."
        : analytics.pcr < 0.8
          ? "Call-heavy positioning — caps upside, watch for unwinds."
          : "Balanced positioning."
    } Max-pain sits at ${lvl(chain, analytics.maxPain)} (${maxPainVsSpot >= 0 ? "+" : ""}${lvl(chain, maxPainVsSpot)} vs spot).`,
    metric: `PCR ${analytics.pcr.toFixed(2)}`,
  });
  if (analytics.resistance.length || analytics.support.length) {
    findings.push({
      agent: "argus",
      severity: "info",
      title: "Key OI walls",
      detail: `Resistance (call OI): ${analytics.resistance.map((s) => lvl(chain, s)).join(", ") || "—"}. Support (put OI): ${analytics.support.map((s) => lvl(chain, s)).join(", ") || "—"}.`,
    });
  }

  // ---- Helios: volatility & greeks ----
  steps.push({
    agent: "helios",
    action: "Read IV surface, expected move, ATM straddle",
    inputs: ["IV by strike", "greeks"],
    outputs: ["IV rank", "expected move", "skew"],
    status: "ok",
    note: `IV ${condition.ivRegime} (rank ${(analytics.ivRank * 100).toFixed(0)}), ±${analytics.expectedMovePct.toFixed(1)}% priced.`,
    ms: 11,
  });
  findings.push({
    agent: "helios",
    severity: condition.ivRegime === "high" ? "watch" : condition.ivRegime === "low" ? "positive" : "info",
    title: `IV regime: ${condition.ivRegime} (rank ${(analytics.ivRank * 100).toFixed(0)})`,
    detail: `Market prices a ±${analytics.expectedMovePct.toFixed(1)}% move to expiry; ATM straddle ${money(chain, analytics.atmStraddle, 2)}. ${
      condition.ivRegime === "high"
        ? "Premiums are rich — favour selling/defined-credit structures."
        : condition.ivRegime === "low"
          ? "Premiums are cheap — favour buying optionality."
          : "Neutral vol — let direction and time decide."
    }`,
    metric: `±${analytics.expectedMovePct.toFixed(1)}%`,
  });

  // ---- Athena: strategy selection ----
  const top = ranked[0];
  steps.push({
    agent: "athena",
    action: `Scored ${ranked.length}+ templates vs the market condition`,
    inputs: ["direction", "IV regime", `${dte}d to expiry`],
    outputs: ["ranked strategies", "reasoning"],
    status: "ok",
    note: top ? `Top pick: ${top.meta.name} (${top.score}/100).` : "No strategy.",
    ms: 22,
  });
  if (top) {
    findings.push({
      agent: "athena",
      severity: "positive",
      title: `Top strategy: ${top.meta.name} — ${top.score}/100`,
      detail: `${top.meta.summary} ${top.reasons[0] ?? ""}`,
      metric: `${top.score}/100`,
    });
  }

  // ---- Plutus: cross-border & FX ----
  const rem = (opts.remittance ?? []).slice().sort((a, b) => b.benefitPct - a.benefitPct);
  const bestRem = rem[0];
  steps.push({
    agent: "plutus",
    action: "Checked FX vs 30-day average for remittance edge",
    inputs: ["USD/INR", "EUR/INR", "GBP/INR"],
    outputs: ["remittance windows"],
    status: "ok",
    note: bestRem ? bestRem.headline : "No FX edge.",
    ms: 6,
  });
  if (bestRem && bestRem.severity !== "info") {
    findings.push({
      agent: "plutus",
      severity: bestRem.severity,
      title: bestRem.headline,
      detail: bestRem.detail,
      metric: `${bestRem.benefitPct >= 0 ? "+" : ""}${bestRem.benefitPct.toFixed(2)}%`,
    });
  }

  // ---- Nike: live monitor ----
  const marks = opts.marks ?? [];
  if (marks.length) {
    for (const m of marks) findings.push(...monitorFindings(m));
    const flagged = marks.filter((m) => m.status !== "running").length;
    steps.push({
      agent: "nike",
      action: `Marked ${marks.length} live position${marks.length > 1 ? "s" : ""} to market`,
      inputs: ["open positions", "live premiums"],
      outputs: ["P&L", "stop/target status"],
      status: flagged > 0 ? "degraded" : "ok",
      note: flagged > 0 ? `${flagged} position(s) need attention.` : "All positions in range.",
      ms: 9,
    });
  } else {
    steps.push({
      agent: "nike",
      action: "Standing by — no open positions",
      inputs: ["positions book"],
      outputs: [],
      status: "ok",
      note: "Idle until a trade goes live.",
      ms: 2,
    });
  }

  // ---- Hermes: compose the brief ----
  const dir = condition.direction;
  const brief = top
    ? `${chain.instrument.symbol} reads ${dir} with ${condition.ivRegime} IV (rank ${(analytics.ivRank * 100).toFixed(0)}) and a ±${analytics.expectedMovePct.toFixed(1)}% expected move into ${dte}d. PCR ${analytics.pcr.toFixed(2)}, max-pain ${lvl(chain, analytics.maxPain)}. Athena's lead structure is the ${top.meta.name} (${top.score}/100). ${simCount > 0 ? "All figures are ★ simulated — attach the live feed before trading." : ""}`.trim()
    : `${chain.instrument.symbol}: insufficient chain to brief.`;
  steps.push({
    agent: "hermes",
    action: "Reconciled 6 specialist reports into the desk brief",
    inputs: ["Iris", "Argus", "Helios", "Athena", "Plutus", "Nike"],
    outputs: ["desk brief", `${findings.length} findings`],
    status: simCount > 0 ? "degraded" : "ok",
    note: "Brief composed.",
    ms: 5,
  });

  return { steps, findings, brief, ranAt };
}
