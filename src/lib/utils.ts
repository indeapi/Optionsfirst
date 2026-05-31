import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Compact OI/volume: India in lakh/crore, US in K/M — how each desk reads it. */
export function compact(n: number, region: "IN" | "US" = "US"): string {
  const abs = Math.abs(n);
  if (region === "IN") {
    if (abs >= 1e7) return `${(n / 1e7).toFixed(2)}Cr`;
    if (abs >= 1e5) return `${(n / 1e5).toFixed(2)}L`;
    if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return `${Math.round(n)}`;
  }
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

export function currencySymbol(ccy: "INR" | "USD"): string {
  return ccy === "INR" ? "₹" : "$";
}

export function money(v: number, ccy: "INR" | "USD", dp = 2): string {
  const s = v < 0 ? "-" : "";
  return `${s}${currencySymbol(ccy)}${Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}`;
}

export function signed(v: number, dp = 2): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(dp)}`;
}

export function pct(v: number, dp = 2): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(dp)}%`;
}

export function num(v: number, dp = 2): string {
  return v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
