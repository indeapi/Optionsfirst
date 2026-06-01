export interface NavItem {
  href: string;
  label: string;
  icon: string;
  hint?: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ href: "/", label: "Dashboard", icon: "dashboard", hint: "Desk overview" }],
  },
  {
    title: "Analyze",
    items: [
      { href: "/option-chain", label: "Option Chain", icon: "table", hint: "Chain + OI" },
      { href: "/positioning", label: "Positioning", icon: "bar-chart-3", hint: "PCR · OI walls" },
      { href: "/scanners", label: "Scanners", icon: "search", hint: "Gainers / OI / spikes" },
      { href: "/volatility", label: "Volatility", icon: "gauge", hint: "IV rank & skew" },
      { href: "/premium-decay", label: "Premium Decay", icon: "activity", hint: "Theta & straddle" },
    ],
  },
  {
    title: "Strategy",
    items: [
      { href: "/strategy-builder", label: "Strategy Builder", icon: "sliders", hint: "Build & price" },
      { href: "/strategies", label: "Playbook", icon: "layers", hint: "Ranked playbook" },
      { href: "/backtesting", label: "Backtesting", icon: "bar-chart-3", hint: "Historical edge" },
    ],
  },
  {
    title: "Manage",
    items: [
      { href: "/portfolio", label: "Portfolio", icon: "scale", hint: "Strategy-wise P&L" },
      { href: "/broker-login", label: "Brokers", icon: "wallet", hint: "Accounts & login" },
      { href: "/cross-border", label: "Cross-Border", icon: "globe", hint: "FX & arbitrage" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/agents", label: "Agents", icon: "workflow", hint: "Hermes workflow" },
      { href: "/data", label: "Data & Delays", icon: "signal", hint: "Source dictionary" },
      { href: "/settings", label: "Settings", icon: "settings", hint: "Feeds & theme" },
    ],
  },
];

/** Flat list (mobile nav, lookups). */
export const NAV: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
