import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { EASE_OUT } from "@/components/ui/motion";

export function PageContainer({
  children,
  className,
  compact,
}: {
  children: ReactNode;
  className?: string;
  /** Tighter vertical padding for content-dense pages (e.g. the result page) instead of the default generous hero-style spacing. */
  compact?: boolean;
}) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
      className={cn("container-page min-w-0", compact ? "py-5 sm:py-8" : "py-10 sm:py-14", className)}
    >
      {children}
    </motion.main>
  );
}
