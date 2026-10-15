import { cn } from "@/lib/cn";

/** Loading placeholder with a soft light band sweeping across it (static under reduced motion). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton-shimmer rounded-lg bg-stone-200/80", className)} aria-hidden="true" />;
}
