export interface NavItem {
  href: string;
  label: string;
  icon: string;
  hint?: string;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", hint: "Desk overview" },
  { href: "/option-chain", label: "Option Chain", icon: "table", hint: "Chain + OI" },
  { href: "/strategy-builder", label: "Strategy Builder", icon: "sliders", hint: "Build & price" },
  { href: "/strategies", label: "Playbook", icon: "layers", hint: "Ranked playbook" },
  { href: "/backtesting", label: "Backtesting", icon: "bar-chart-3", hint: "Historical edge" },
  { href: "/broker-login", label: "Broker Login", icon: "wallet", hint: "Broker accounts" },
  { href: "/agents", label: "Agents", icon: "workflow", hint: "Hermes workflow" },
  { href: "/cross-border", label: "Cross-Border", icon: "globe", hint: "FX & arbitrage" },
  { href: "/data", label: "Data & Delays", icon: "signal", hint: "Source dictionary" },
  { href: "/settings", label: "Settings", icon: "settings", hint: "Feeds & theme" },
];
