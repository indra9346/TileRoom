import type { ReactNode } from "react";
import { motion, type Transition, type Variants } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * Shared motion toolkit — one vocabulary of easing, springs and variants so
 * every page moves the same way. Everything here animates only `opacity` and
 * `transform`, and respects prefers-reduced-motion through the app-level
 * <MotionConfig reducedMotion="user"> (transforms are dropped, fades remain).
 *
 * Variant names are always `hidden` → `show` so containers and items from
 * different components compose (a <Stagger> parent drives any `staggerItem`).
 */

/** Long, soft deceleration — the house easing for entrances. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
/** Quick acceleration for exits, so leaving never feels sluggish. */
export const EASE_IN = [0.4, 0, 1, 1] as const;

export const springSoft: Transition = { type: "spring", stiffness: 300, damping: 26, mass: 0.8 };
export const springSnappy: Transition = { type: "spring", stiffness: 520, damping: 30 };
export const springModal: Transition = { type: "spring", stiffness: 380, damping: 32, mass: 0.9 };

/* ------------------------------------------------------------------ */
/* Variants                                                            */
/* ------------------------------------------------------------------ */

export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18, ease: EASE_IN } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4, ease: EASE_OUT } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: springSoft },
};

/** Child of a <Stagger> / `staggerContainer` — cards, grid cells, list rows. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: EASE_OUT } },
};

/** Lighter item variant for table rows / dense lists (no scale — keeps text crisp). */
export const rowItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
};

export function staggerContainer(stagger = 0.06, delayChildren = 0): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren } },
  };
}

/** Spread onto a motion element for the standard card hover-lift + press. */
export const hoverLift = {
  whileHover: { y: -4, transition: springSoft },
  whileTap: { scale: 0.985, transition: springSnappy },
} as const;

/** Spread onto a motion element for small controls (chips, icon buttons). */
export const tapPress = {
  whileHover: { scale: 1.03, transition: springSnappy },
  whileTap: { scale: 0.95, transition: springSnappy },
} as const;

/** Shared `viewport` for whileInView reveals: fire once, a little before fully visible. */
export const revealViewport = { once: true, margin: "0px 0px -60px 0px" } as const;

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

type Tag = "div" | "section" | "ul" | "ol" | "li" | "header" | "article" | "tbody" | "span" | "p" | "h1" | "h2" | "h3";

function tagOf(as: Tag) {
  // motion[tag] is a distinct component per tag; typed loosely as a div so a
  // single prop surface (className/children/variants) works for all of them.
  return motion[as] as unknown as typeof motion.div;
}

/**
 * Route-level wrapper used by App.tsx inside <AnimatePresence>. Uses target
 * objects rather than variant labels on purpose: labels would cascade
 * "hidden"/"show"/"exit" into every variant-driven descendant on the page.
 */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE_OUT } }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.18, ease: EASE_IN } }}
    >
      {children}
    </motion.div>
  );
}

/** Fades content up as it scrolls into view (once). Pass `immediate` to play on mount instead. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
  as = "div",
  immediate = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: Tag;
  immediate?: boolean;
}) {
  const Comp = tagOf(as);
  const variants: Variants = {
    hidden: { opacity: 0, y },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT, delay } },
  };
  return immediate ? (
    <Comp className={className} variants={variants} initial="hidden" animate="show">
      {children}
    </Comp>
  ) : (
    <Comp className={className} variants={variants} initial="hidden" whileInView="show" viewport={revealViewport}>
      {children}
    </Comp>
  );
}

/**
 * Staggers its direct `StaggerItem` (or any child using `staggerItem`
 * variants) children. By default plays on mount; `inView` defers to scroll.
 */
export function Stagger({
  children,
  className,
  stagger = 0.06,
  delay = 0,
  as = "div",
  inView = false,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  as?: Tag;
  inView?: boolean;
}) {
  const Comp = tagOf(as);
  const variants = staggerContainer(stagger, delay);
  return inView ? (
    <Comp className={className} variants={variants} initial="hidden" whileInView="show" viewport={revealViewport}>
      {children}
    </Comp>
  ) : (
    <Comp className={className} variants={variants} initial="hidden" animate="show">
      {children}
    </Comp>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
  lift = false,
}: {
  children: ReactNode;
  className?: string;
  as?: Tag;
  /** Adds the standard hover-lift + tap-press. */
  lift?: boolean;
}) {
  const Comp = tagOf(as);
  return (
    <Comp className={cn(className)} variants={staggerItem} {...(lift ? hoverLift : {})}>
      {children}
    </Comp>
  );
}
