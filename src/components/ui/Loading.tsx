import { Skeleton } from "./primitives";

/** Generic skeleton shown while the first market snapshot is building. */
export function LoadingGrid() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px]" />
        ))}
      </div>
      <Skeleton className="h-28" />
      <div className="grid gap-3 lg:grid-cols-3">
        <Skeleton className="h-[420px] lg:col-span-2" />
        <Skeleton className="h-[420px]" />
      </div>
    </div>
  );
}
