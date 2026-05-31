/**
 * The Hermes agent system.
 *
 * Hermes is the orchestrator; the sub-agents are specialists, each owning one
 * slice of the analysis. Every view that shows a number can name the agent that
 * produced it and trace what that agent did — that's the whole point of the
 * "which agent is applied and what they're doing" workflow panel.
 *
 * Naming is deliberately classical (no robots, no sparkles) so the product
 * reads like a trading desk, not a chatbot.
 */

export type AgentId =
  | "hermes"
  | "iris"
  | "argus"
  | "helios"
  | "athena"
  | "plutus"
  | "nike";

export type Severity = "info" | "positive" | "watch" | "alert";

export interface AgentDef {
  id: AgentId;
  name: string;
  title: string;
  /** One-line domain shown under the name. */
  domain: string;
  description: string;
  /** Decorative accent as an HSL triple (theme-independent). */
  accent: string;
  /** lucide-react icon name — intentionally functional, never an "AI" glyph. */
  icon: string;
  /** Fields/responsibilities the agent owns, for the workflow panel. */
  owns: string[];
}

export const AGENTS: Record<AgentId, AgentDef> = {
  hermes: {
    id: "hermes",
    name: "Hermes",
    title: "Orchestrator",
    domain: "Routes the query, coordinates the desk, composes the brief",
    description:
      "Hermes receives every request, dispatches the specialist agents in the right order, reconciles their findings and writes the single plain-English brief the trader reads first.",
    accent: "221 83% 56%",
    icon: "route",
    owns: ["Routing", "Coordination", "Final brief"],
  },
  iris: {
    id: "iris",
    name: "Iris",
    title: "Data Integrity",
    domain: "Source, delay & freshness — flags every ★ simulated value",
    description:
      "Iris audits provenance on every field: which broker produced it, how stale it is, and whether it's live, delayed, end-of-day or simulated. She is the reason the dashboard can always state the real delay.",
    accent: "199 89% 52%",
    icon: "activity",
    owns: ["Source", "Delay", "Simulated ★ marks"],
  },
  argus: {
    id: "argus",
    name: "Argus",
    title: "Positioning",
    domain: "Open Interest, max-pain, OI walls, support & resistance",
    description:
      "Argus watches where contracts are written — max-pain, PCR, the call/put OI walls that act as support and resistance, and where fresh OI is building or unwinding.",
    accent: "152 60% 42%",
    icon: "bar-chart-3",
    owns: ["Open Interest", "Max Pain", "PCR", "OI walls"],
  },
  helios: {
    id: "helios",
    name: "Helios",
    title: "Volatility & Greeks",
    domain: "IV regime, skew, expected move, ATM straddle",
    description:
      "Helios reads the volatility surface: IV rank, the put/call skew, the ATM straddle and the move the market is pricing in — the inputs that decide whether you buy or sell premium.",
    accent: "33 92% 52%",
    icon: "gauge",
    owns: ["Implied Vol", "Skew", "Greeks", "Expected move"],
  },
  athena: {
    id: "athena",
    name: "Athena",
    title: "Strategy",
    domain: "Ranks strategies to the market condition, explains why",
    description:
      "Athena scores every strategy template against the current direction, IV regime and time-to-expiry, then ranks the top structures with the reasoning behind each pick.",
    accent: "267 70% 62%",
    icon: "target",
    owns: ["Strategy ranking", "Reasoning", "Payoff fit"],
  },
  plutus: {
    id: "plutus",
    name: "Plutus",
    title: "Cross-Border & FX",
    domain: "Forex remittance windows, currency-adjusted arbitrage",
    description:
      "Plutus handles the cross-border edge: when the FX rate makes an INR→ or USD→ remittance favourable, and where a position is cheaper in one market once currency is accounted for.",
    accent: "318 70% 56%",
    icon: "arrow-left-right",
    owns: ["FX windows", "Remittance", "Cross-border arbitrage"],
  },
  nike: {
    id: "nike",
    name: "Nike",
    title: "Live Monitor",
    domain: "Continuous watch on open positions — exits & adjustments",
    description:
      "Nike runs while a trade is live: tracking P&L against targets and stops, theta burn, delta drift and breach of the OI walls — and raising the alert when it's time to act.",
    accent: "6 80% 60%",
    icon: "radar",
    owns: ["Live P&L", "Stops & targets", "Greek drift"],
  },
};

export const SUB_AGENTS: AgentId[] = ["iris", "argus", "helios", "athena", "plutus", "nike"];

export const AGENT_LIST: AgentDef[] = [AGENTS.hermes, ...SUB_AGENTS.map((id) => AGENTS[id])];

export interface Finding {
  agent: AgentId;
  severity: Severity;
  title: string;
  detail: string;
  /** Optional headline metric, e.g. "PCR 1.24". */
  metric?: string;
}

export interface WorkflowStep {
  agent: AgentId;
  action: string;
  inputs: string[];
  outputs: string[];
  status: "ok" | "degraded" | "blocked";
  note: string;
  ms: number;
}
