import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "clay" | "success" | "warning" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-stone-100 text-stone-700 ring-stone-200/70",
  clay: "bg-clay-100 text-clay-800 ring-clay-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
  warning: "bg-amber-50 text-amber-800 ring-amber-200/80",
  danger: "bg-red-50 text-red-800 ring-red-200/80",
};

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors duration-200",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
