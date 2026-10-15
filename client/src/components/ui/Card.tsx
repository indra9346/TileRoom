import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, interactive, ...props }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-hairline bg-surface-card shadow-soft",
        "transition-[box-shadow,border-color,transform] duration-300 ease-out-quint",
        interactive && "hover:-translate-y-1 hover:border-sage-400/70 hover:shadow-lift",
        className
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
