import { motion } from "framer-motion";
import { Button } from "./Button";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }}
      transition={{ opacity: { duration: 0.25 }, y: { duration: 0.3 }, x: { duration: 0.45, ease: "easeOut", delay: 0.1 } }}
      className="flex flex-col items-center gap-4 rounded-2xl border border-red-200 bg-red-50/80 px-6 py-10 text-center"
    >
      <motion.span
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.05 }}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-red-700 shadow-sm ring-1 ring-red-200"
        aria-hidden="true"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 8v5M12 16.5h.01" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </motion.span>
      <p className="max-w-md text-sm font-medium text-red-800">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </motion.div>
  );
}
