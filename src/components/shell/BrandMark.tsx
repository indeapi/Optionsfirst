import { cn } from "@/lib/utils";

/**
 * Options First wordmark. The mark is a stacked pair of bars — a long over a
 * short — reading as both a candle and an "options ladder". No mascots, no
 * sparkles; it should sit comfortably next to a Bloomberg or a TWS.
 */
export function BrandMark({
  size = 28,
  withWordmark = true,
  className,
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
        <rect x="1" y="1" width="30" height="30" rx="8" fill="hsl(var(--brand))" />
        <rect x="9" y="7.5" width="4.5" height="17" rx="2.25" fill="white" opacity="0.95" />
        <rect x="18.5" y="13" width="4.5" height="11.5" rx="2.25" fill="white" opacity="0.7" />
      </svg>
      {withWordmark ? (
        <div className="leading-none">
          <div className="text-[15px] font-bold tracking-tight text-fg">
            Options<span className="text-brand">First</span>
          </div>
          <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            Options Analytics
          </div>
        </div>
      ) : null}
    </div>
  );
}
