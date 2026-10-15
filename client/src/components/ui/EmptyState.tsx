import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { EASE_OUT } from "./motion";

/** Default illustration: three tiles settling into place. */
function TileStackIcon() {
  return (
    <div className="relative h-14 w-14" aria-hidden="true">
      {[
        { x: 0, y: 0, c: "bg-sage-200", d: 0.1 },
        { x: 22, y: 6, c: "bg-champagne-200", d: 0.18 },
        { x: 10, y: 24, c: "bg-sage-300", d: 0.26 },
      ].map((t, i) => (
        <motion.span
          key={i}
          className={`absolute h-7 w-7 rounded-md ${t.c} shadow-sm ring-1 ring-white/70`}
          style={{ left: t.x, top: t.y }}
          initial={{ opacity: 0, y: -14, rotate: -10 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 16, delay: t.d }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-surface-card/70 px-6 py-14 text-center sm:py-16"
    >
      <motion.div
        className="mb-5 text-stone-400"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
      >
        {icon ?? <TileStackIcon />}
      </motion.div>
      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1, ease: EASE_OUT }}
        className="font-display text-xl text-stone-900"
      >
        {title}
      </motion.h3>
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.16, ease: EASE_OUT }}
          className="mt-2 max-w-sm text-sm text-stone-500"
        >
          {description}
        </motion.p>
      )}
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.24, ease: EASE_OUT }}
          className="mt-6"
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}
