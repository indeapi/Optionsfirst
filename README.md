# Options First

**Industrial-grade options analytics for US (IBKR) and Indian (Zerodha Kite) markets.**

A clean, fast options-analytics terminal: world-class Open-Interest visualisation, straddle / payoff / IV-skew charts, strategies ranked to the live tape, and the **Hermes multi-agent desk** that produces — and explains — every number. Built so the trader always knows the *real* delay on each datapoint, with a **★ on anything simulated**.

> Data is simulated by a deterministic engine until live broker keys are attached. Every simulated value is marked with a ★ and carries the delay its real feed would have. Nothing here is investment advice.

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

### Connect live brokers

The platform talks only to a broker-adapter interface (`src/lib/data/adapter.ts`); the simulated engine backs both regions until you attach keys. Integration points are documented inline.

```bash
# Zerodha Kite (India / NSE)
KITE_API_KEY=...
KITE_ACCESS_TOKEN=...        # daily login flow; stream via kiteticker (OI ~3 min)

# Interactive Brokers (US / OPRA)
IBKR_GATEWAY_HOST=127.0.0.1  # run IB Gateway / TWS
IBKR_GATEWAY_PORT=4001       # quotes need an OPRA subscription; OI stays EOD by design
```

When a feed is connected, the source pills flip from **SIM** to **LIVE** and the ★ marks disappear for live fields.

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
