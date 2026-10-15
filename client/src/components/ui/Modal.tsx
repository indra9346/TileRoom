import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { EASE_IN, springModal } from "./motion";

/**
 * Accessible dialog: Escape and the backdrop close it, focus moves into it, page scroll is locked while open.
 * Rendered in a portal on <body> so it always stacks above the sticky navbar/sidebar (the page area is its
 * own z-10 stacking context), and springs in/out — a bottom sheet on phones, a centred card from sm up.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Callers often pass an inline onClose; keeping it in a ref stops the effect below re-running
  // (and stealing focus from the search box) every time the parent re-renders.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="modal" className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
          <motion.div
            className="absolute inset-0 bg-stone-950/55 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.25 } }}
            exit={{ opacity: 0, transition: { duration: 0.2, ease: EASE_IN } }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: springModal }}
            exit={{ opacity: 0, y: 24, scale: 0.98, transition: { duration: 0.18, ease: EASE_IN } }}
            className={cn(
              "relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-hairline bg-white shadow-2xl outline-none sm:max-w-4xl sm:rounded-3xl",
              className,
            )}
          >
            {/* Grab handle — signals the bottom-sheet shape on phones. */}
            <span className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-stone-300 sm:hidden" aria-hidden="true" />
            <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
              <h2 className="min-w-0 truncate font-display text-xl text-stone-900">{title}</h2>
              <motion.button
                type="button"
                onClick={onClose}
                aria-label="Close"
                whileHover={{ rotate: 90 }}
                whileTap={{ scale: 0.88 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </motion.button>
            </div>
            <div className="scroll-soft overflow-y-auto overscroll-contain p-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
