"use client";

import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock,
  Gauge,
  Globe,
  Info,
  LayoutDashboard,
  Layers,
  Moon,
  Percent,
  Radar,
  RefreshCw,
  Route,
  Scale,
  Search,
  Settings,
  Shield,
  Signal,
  Sliders,
  Star,
  Sun,
  Table2,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";

const REGISTRY: Record<string, LucideIcon> = {
  activity: Activity,
  "arrow-left-right": ArrowLeftRight,
  "bar-chart-3": BarChart3,
  bell: Bell,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  "circle-dot": CircleDot,
  clock: Clock,
  gauge: Gauge,
  globe: Globe,
  info: Info,
  dashboard: LayoutDashboard,
  layers: Layers,
  moon: Moon,
  percent: Percent,
  radar: Radar,
  refresh: RefreshCw,
  route: Route,
  scale: Scale,
  search: Search,
  settings: Settings,
  shield: Shield,
  signal: Signal,
  sliders: Sliders,
  star: Star,
  sun: Sun,
  table: Table2,
  target: Target,
  "trending-down": TrendingDown,
  "trending-up": TrendingUp,
  "triangle-alert": TriangleAlert,
  wallet: Wallet,
  workflow: Workflow,
};

export function Icon({
  name,
  size = 16,
  className,
  strokeWidth = 2,
}: {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const Cmp = REGISTRY[name] ?? CircleDot;
  return <Cmp size={size} className={className} strokeWidth={strokeWidth} />;
}
