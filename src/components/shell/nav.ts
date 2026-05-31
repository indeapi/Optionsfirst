export interface NavItem {
  href: string;
  label: string;
  icon: string;
  hint?: string;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", hint: "Desk overview" },
  { href: "/option-chain", label: "Option Chain", icon: "table", hint: "Chain + OI" },
  { href: "/strategies", label: "Strategies", icon: "layers", hint: "Ranked playbook" },
  { href: "/agents", label: "Agents", icon: "workflow", hint: "Hermes workflow" },
  { href: "/cross-border", label: "Cross-Border", icon: "globe", hint: "FX & arbitrage" },
  { href: "/data", label: "Data & Delays", icon: "signal", hint: "Source dictionary" },
  { href: "/settings", label: "Settings", icon: "settings", hint: "Feeds & theme" },
];
