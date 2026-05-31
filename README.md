# Options First

**Industrial-grade options analytics for US (IBKR) and Indian (Zerodha Kite) markets.**

A clean, fast options-analytics terminal: world-class Open-Interest visualisation, straddle / payoff / IV-skew charts, strategies ranked to the live tape, and the **Hermes multi-agent desk** that produces — and explains — every number. Built so the trader always knows the *real* delay on each datapoint, with a **★ on anything simulated**.

> **US (IBKR) is connected with real captured data** — account, positions, spot, implied vol, IV-rank and aggregate option OI/PCR are genuine Interactive Brokers values. India (Kite) is simulated ★ until a Kite session is attached. Every value carries its real source/delay; anything modelled is marked ★. Nothing here is investment advice.

---

## Highlights

- **Two markets, one desk** — NSE F&O (NIFTY, BANKNIFTY, FINNIFTY, SENSEX, RELIANCE) and US options (SPX, SPY, QQQ, AAPL, NVDA, TSLA).
- **World-class OI bar chart** — diverging Call/Put OI by strike with a *fresh-OI* overlay, spot/ATM/max-pain markers and support/resistance walls.
- **Straddle, payoff & IV-skew charts** — ATM straddle through the session, full payoff-at-expiry diagrams with breakevens + expected-move band, and the implied-vol smile.
- **Strategy engine** — 16 structures scored against direction, IV regime, time-to-expiry and realised payoff (probability of profit, reward:risk), with transparent reasoning.
- **Hermes agent system** — one orchestrator + six specialists; every view names the agent behind it and the workflow it ran.
- **Honest data freshness** — a per-field source/delay model that makes the US-vs-India differences explicit (Indian OI is ~3 min delayed; US OI is end-of-day only).
- **Cross-border edge** — FX vs 30-day average, remittance-window alerts, currency-adjusted P&L (Plutus).
- **Live trade monitor** — open positions marked to market each refresh, with stop/target gauges (Nike).
- **Light & dark themes**, real-time refresh, keyboard-free clean UI — no chatbot aesthetic.

---

## The Hermes agent desk

| Agent | Role | Owns |
|------|------|------|
| **Hermes** | Orchestrator (lead) | Routing, coordination, the desk brief |
| **Iris** | Data integrity | Source, delay, the ★ simulated marks |
| **Argus** | Positioning | Open Interest, max-pain, PCR, OI walls |
| **Helios** | Volatility & greeks | IV regime, skew, expected move, straddle |
| **Athena** | Strategy | Ranking structures + the reasoning |
| **Plutus** | Cross-border & FX | Remittance windows, currency arbitrage |
| **Nike** | Live monitor | P&L vs stop/target, greek drift |

Open **/agents** to see the live workflow trace — exactly what each agent did, its inputs → outputs, status and timing.

---

## Data freshness: US vs India

Every field travels with provenance (`source`, `mode`, `delaySec`, `asOf`, `simulated`). The cadence differs by venue:

| Datapoint | India · Kite | US · IBKR |
|-----------|--------------|-----------|
| LTP / Bid-Ask / Volume | Live (sub-second) | Live (with OPRA subscription; else 15 min) |
| **Open Interest** | **Delayed ~3 min** (NSE cycle) | **End-of-day only** (OCC settlement, next morning) |
| IV / Greeks | Computed live | Computed live |
| PCR / Max Pain | Inherits OI's ~3 min lag | Inherits OI's end-of-day cadence |

See **/data** for the full dictionary and the live source/age of every field on the active chain.

---

## Run it

```bash
pnpm install      # or npm install
pnpm dev          # http://localhost:3000
pnpm build && pnpm start   # production
```

Requires Node 18+.

### Data tiers

The platform talks only to a broker-adapter interface (`src/lib/data/adapter.ts`). Every field is one of three tiers, shown in the UI by its source pill:

| Tier | Pill | Meaning |
|------|------|---------|
| **LIVE** | green | Streaming from a runtime broker connection (gateway / Kite key). |
| **REAL — captured** | blue ⏱ | Genuine broker values from a point-in-time snapshot (current US/IBKR state). |
| **SIMULATED ★** | purple ★ | Modelled by the deterministic engine (current India state, and per-strike US quotes). |

What's real **right now** (US, from the IBKR capture in `src/lib/data/live/ibkrCapture.ts`): account, positions, underlying spot, implied vol, 52-week IV percentile (→ IV rank), and **aggregate call/put OI → real PCR**. Modelled ★: the per-strike OI *distribution* (scaled to the real totals) and per-contract bid/ask/volume — per-contract option conids aren't exposed by the connector, and US per-strike OI is end-of-day anyway.

### MCP vs. runtime — important

**MCP servers are tools for the Claude Code agent during a session — the deployed web app cannot call them at runtime.** So "connect" has two layers:

- **Workspace ← brokers (MCP):** IBKR is provided by the session; Kite is added via `.mcp.json` (below) and needs an interactive Kite OAuth login. This is how the *agent* pulls live data (e.g. to refresh the capture).
- **Web app ← brokers (runtime):** the app's server needs broker credentials directly. Set these to stream:

```bash
# Interactive Brokers (US / OPRA) — Client Portal Web API / IB Gateway
IBKR_GATEWAY_BASE_URL=https://localhost:5000/v1/api   # streams intraday; OI stays EOD by design

# Zerodha Kite (India / NSE) — Kite Connect
KITE_API_KEY=...
KITE_ACCESS_TOKEN=...        # daily login; stream via kiteticker (LTP live, OI ~3 min)
```

Kite MCP (workspace) is configured in `.mcp.json`:

```json
{ "mcpServers": { "kite": { "command": "npx", "args": ["mcp-remote", "https://mcp.kite.trade/mcp"] } } }
```

When a runtime feed is attached the pills flip to **LIVE** and the ★/captured marks clear for streamed fields.

---

## Architecture

```
src/
  app/                     # Next.js App Router pages (dashboard, chain, strategies, agents, …)
  components/
    charts/                # OIChart, PayoffChart, StraddleChart, VolSmileChart (custom SVG)
    panels/                # MarketHeader, HermesBrief, AgentWorkflow, StrategyRank, …
    option-chain/          # OptionChainTable
    shell/ ui/ providers/  # frame, primitives, design system, market context
  lib/
    data/                  # types, instruments, adapters (IBKR/Kite), simulated engine, freshness
    quant/                 # Black-Scholes, greeks, payoff, strategies, ranker, OI analytics
    agents/                # Hermes orchestrator + sub-agents, FX, live-trade monitor
    hooks/ store/          # market-refresh hook, theme, app state
```

**Stack:** Next.js 14 · React 18 · TypeScript · Tailwind CSS · Zustand · lucide-react. Charts are bespoke SVG (no chart library) for a custom, dependency-light look.

---

*Options First is an analytics tool, not a brokerage, and does not provide investment advice. Simulated values are clearly marked with ★.*
