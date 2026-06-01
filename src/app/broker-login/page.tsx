"use client";

import { useState } from "react";
import { useAppStore, type BrokerConnection } from "@/lib/store/app";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel, Chip, Segmented } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { cn, money } from "@/lib/utils";
import { alpaca } from "@/lib/data/live/alpaca";

interface LoginStep {
  text: string;
  done: boolean;
}

export default function BrokerLoginPage() {
  const brokerConnections = useAppStore((s) => s.brokerConnections);
  const connectBroker = useAppStore((s) => s.connectBroker);
  const disconnectBroker = useAppStore((s) => s.disconnectBroker);

  // Connection flow UI states
  const [selectedId, setSelectedId] = useState<string>("alpaca");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [mode, setMode] = useState<"live" | "sim">("sim");

  const [connecting, setConnecting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<LoginStep[]>([]);

  const selectedBroker = brokerConnections[selectedId];

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;

    setConnecting(true);
    setCurrentStep(0);

    const loginSteps = [
      { text: `Establishing secure socket to ${selectedBroker.name}...`, done: false },
      { text: "Resolving OAuth2 authorization callback handshakes...", done: false },
      { text: "Fetching margins, ledger books & buying power metrics...", done: false },
      { text: "Synchronizing open derivative contract contracts...", done: false },
    ];
    setSteps(loginSteps);

    // Simulate connection step-by-step
    const runStep = (idx: number) => {
      if (idx >= loginSteps.length) {
        if (selectedId === "alpaca") {
          alpaca.setCredentials(username, password, mode === "live" ? "live" : "paper");
          alpaca.testConnection().then((res) => {
            if (res.success) {
              alpaca.getAccount().then((acc) => {
                useAppStore.getState().setAlpacaCredentials({
                  key: username,
                  secret: password,
                  environment: mode === "live" ? "live" : "paper",
                });
                useAppStore.getState().setAlpacaConnection({
                  connected: true,
                  latencyMs: res.latencyMs,
                });
                useAppStore.setState((state) => {
                  const brokerVal = state.brokerConnections.alpaca;
                  return {
                    brokerConnections: {
                      ...state.brokerConnections,
                      alpaca: {
                        ...brokerVal,
                        connected: true,
                        username: "Alpaca Account",
                        accountNo: acc.accountNumber,
                        buyingPower: acc.buyingPower,
                        netLiq: acc.portfolioValue,
                        mode: mode === "live" ? "live" : "sim",
                      },
                    },
                  };
                });
              });
            }
          });
        } else {
          connectBroker(selectedId, username, mode);
        }
        setConnecting(false);
        setUsername("");
        setPassword("");
        setApiKey("");
        return;
      }
      setTimeout(() => {
        setSteps((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], done: true };
          return next;
        });
        setCurrentStep(idx + 1);
        runStep(idx + 1);
      }, 550);
    };

    runStep(0);
  };

  const handleDisconnect = (id: string) => {
    disconnectBroker(id);
  };

  // SVGs for broker initials or mock branding
  const renderBrokerLogo = (id: string) => {
    const bgColors: Record<string, string> = {
      alpaca: "bg-amber-500 text-black",
      ibkr: "bg-red-600 text-white",
      schwab: "bg-blue-500 text-white",
      robinhood: "bg-green-500 text-black",
      webull: "bg-blue-600 text-white",
      saxo: "bg-slate-800 text-amber-500 border border-amber-500/20",
      tradestation: "bg-sky-500 text-white",
      kite: "bg-orange-500 text-white",
    };
    const labels: Record<string, string> = {
      alpaca: "AL",
      ibkr: "IB",
      schwab: "CS",
      robinhood: "RH",
      webull: "WB",
      saxo: "SX",
      tradestation: "TS",
      kite: "KT",
    };
    return (
      <span className={cn("grid h-9 w-9 place-items-center rounded-lg font-bold text-xs uppercase shadow-sm", bgColors[id] || "bg-brand/10 text-brand")}>
        {labels[id] || "??"}
      </span>
    );
  };

  return (
    <>
      <PageHeader
        title="Broker Connections"
        desc="Authenticate multiple client sessions. Trade live from the Strategy Builder into active accounts."
        icon="wallet"
      />

      <div className="grid gap-3 lg:grid-cols-12">
        {/* Left Side: Broker Directory Catalog */}
        <div className="lg:col-span-5 space-y-2.5">
          <span className="label-eyebrow block px-1">Select Trading Broker</span>
          <div className="space-y-1.5">
            {Object.values(brokerConnections).map((b) => {
              const active = b.id === selectedId;
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    if (!connecting) {
                      setSelectedId(b.id);
                      setMode(b.region === "IN" ? "sim" : "sim"); // default
                    }
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                    active
                      ? "border-brand/40 bg-brand/[0.05] shadow-sm"
                      : "border-border bg-panel hover:bg-bg-sunken"
                  )}
                  disabled={connecting}
                >
                  {renderBrokerLogo(b.id)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-fg truncate">{b.name}</span>
                      <span
                        className={cn(
                          "chip",
                          b.connected
                            ? "bg-call/10 border border-call/20 text-call"
                            : "bg-bg-sunken border border-border text-fg-subtle"
                        )}
                      >
                        {b.connected ? "CONNECTED" : "OFFLINE"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-3xs text-fg-subtle flex items-center justify-between">
                      <span>{b.region === "US" ? "US Options · OPRA" : "India F&O · NSE"}</span>
                      {b.connected && <span className="tnum font-medium text-fg-muted">{b.accountNo}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Authentication Panel */}
        <div className="lg:col-span-7">
          <Panel
            eyebrow={selectedBroker.region === "US" ? "US Venue" : "Indian Venue"}
            title={selectedBroker.name}
            right={
              selectedBroker.connected ? (
                <Chip tone="call" dot>
                  Session Active
                </Chip>
              ) : (
                <Chip tone="neutral">Disconnected</Chip>
              )
            }
          >
            {connecting ? (
              // Connection progress loop
              <div className="py-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Icon name="refresh" size={20} className="animate-spin text-brand" />
                  <span className="text-[13px] font-bold text-fg">Authenticating secure broker credentials...</span>
                </div>
                <div className="rounded-lg border border-border bg-bg-sunken p-3 font-mono text-3xs leading-relaxed text-fg-muted space-y-1.5 shadow-inner">
                  {steps.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-2.5">
                        {idx === currentStep ? (
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand animate-pulse-soft" />
                        ) : s.done ? (
                          <Icon name="check" size={10} className="text-call" strokeWidth={3} />
                        ) : (
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-fg-subtle opacity-40" />
                        )}
                      </span>
                      <span className={cn(s.done ? "text-fg font-medium" : "text-fg-subtle")}>{s.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : selectedBroker.connected ? (
              // Connected Account Dashboard
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-panel-2 border border-border p-3">
                    <div className="label-eyebrow text-3xs">Net Liquidation</div>
                    <div className="text-lg font-bold text-fg mt-1 tnum">
                      {money(selectedBroker.netLiq, selectedBroker.region === "US" ? "USD" : "INR", 0)}
                    </div>
                    <div className="text-3xs text-fg-subtle mt-0.5">Asset Valuation</div>
                  </div>

                  <div className="rounded-lg bg-panel-2 border border-border p-3">
                    <div className="label-eyebrow text-3xs">Margin Buying Power</div>
                    <div className="text-lg font-bold text-fg mt-1 tnum">
                      {money(selectedBroker.buyingPower, selectedBroker.region === "US" ? "USD" : "INR", 0)}
                    </div>
                    <div className="text-3xs text-fg-subtle mt-0.5">Derivatives Limit</div>
                  </div>

                  <div className="rounded-lg bg-panel-2 border border-border p-3">
                    <div className="label-eyebrow text-3xs">Client Login ID</div>
                    <div className="text-lg font-bold text-brand mt-1 uppercase tnum">
                      {selectedBroker.username}
                    </div>
                    <div className="text-3xs text-fg-subtle mt-0.5">Connected on {selectedBroker.mode === "live" ? "Live Feed" : "Sandbox"}</div>
                  </div>
                </div>

                <div className="rounded-lg bg-bg-sunken border border-border p-3">
                  <div className="flex items-start gap-2.5">
                    <Icon name="shield" className="text-call mt-0.5" size={16} />
                    <div>
                      <div className="text-[11px] font-bold text-fg">Active Session Safe</div>
                      <p className="text-3xs text-fg-muted mt-1 leading-relaxed">
                        This session is encrypted on local cookies. All options trade signals routed from the Strategy Builder will compile automatically against the account ledger of account ID <b className="text-fg">{selectedBroker.accountNo}</b>.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => handleDisconnect(selectedBroker.id)}
                    className="rounded-lg border border-put/30 bg-put/5 hover:bg-put/10 px-4 py-1.5 text-2xs font-semibold text-put transition-colors"
                  >
                    Disconnect Session
                  </button>
                </div>
              </div>
            ) : (
              // Connection Login Form
              <form onSubmit={handleConnect} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label-eyebrow block mb-1">
                      {selectedId === "alpaca" ? "Alpaca API Key ID" : "Username / Client ID"}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={selectedId === "alpaca" ? "e.g. PKXXXXXXXXXXXXXXXXXX" : "e.g. trading_desk_99"}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-2xs font-medium text-fg focus-ring"
                    />
                  </div>

                  <div>
                    <label className="label-eyebrow block mb-1">
                      {selectedId === "alpaca" ? "Alpaca Secret API Key" : "Password / Security Pin"}
                    </label>
                    <input
                      type="password"
                      required
                      placeholder={selectedId === "alpaca" ? "e.g. XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" : "••••••••"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-2xs font-medium text-fg focus-ring"
                    />
                  </div>
                </div>

                {selectedId === "kite" && (
                  <div>
                    <label className="label-eyebrow block mb-1">Kite API Connect Token</label>
                    <input
                      type="text"
                      placeholder="Kite access token (optional)"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-2xs font-medium text-fg focus-ring"
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div>
                    <label className="label-eyebrow block mb-1">Connection Mode</label>
                    <Segmented
                      size="sm"
                      value={mode}
                      onChange={(v) => setMode(v as "live" | "sim")}
                      options={[
                        { label: <span className="font-semibold">Simulated Sandbox</span>, value: "sim" },
                        { label: <span className="font-bold text-brand">Live Feed</span>, value: "live" },
                      ]}
                    />
                  </div>

                  <button
                    type="submit"
                    className="self-end rounded-lg bg-brand px-5 py-2 text-2xs font-bold text-white shadow-md hover:bg-brand/90 focus-ring"
                  >
                    Establish Connection
                  </button>
                </div>
              </form>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
