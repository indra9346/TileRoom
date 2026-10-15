import type { ReactNode } from "react";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { TileScene, type SceneId } from "@/components/ui/TileScene";
import { EASE_OUT } from "./motion";

export type RoomTone = "sage" | "champagne" | "limestone";

interface PageBannerProps {
  /** Which tile layout is laid in the background. Give each page its own. */
  scene: SceneId;
  badge?: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  heightClass?: string;
  /** Gives this destination its own atmosphere within the shared palette —
   * the showroom reads warmer (champagne), the trial room reads more
   * verdant (sage), everything else stays on the neutral limestone default. */
  tone?: RoomTone;
}

const TONE_BG: Record<RoomTone, string> = {
  sage: "bg-surface-sage",
  champagne: "bg-surface-limestone",
  limestone: "bg-surface-limestone",
};

const TONE_BADGE: Record<RoomTone, string> = {
  sage: "border-hairline bg-surface-card text-sage-800",
  champagne: "border-champagne-300 bg-champagne-100 text-champagne-600",
  limestone: "border-hairline bg-surface-card text-sage-800",
};

const TONE_DOT: Record<RoomTone, string> = {
  sage: "bg-sage-600",
  champagne: "bg-champagne-500",
  limestone: "bg-champagne-500",
};

export function PageBanner({ scene, badge, title, subtitle, actions, heightClass = "min-h-[14rem] sm:min-h-[16rem] md:min-h-[18rem]", tone = "limestone" }: PageBannerProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Gentle parallax: the tile floor drifts slower than the page as the banner
  // scrolls away. Disabled automatically under reduced motion (MotionConfig).
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const sceneY = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);

  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 14, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE_OUT }}
      className={`relative isolate mb-8 flex items-end overflow-hidden rounded-3xl border border-hairline shadow-xl ${TONE_BG[tone]} ${heightClass}`}
    >
      <motion.div className="absolute inset-x-0 -top-[6%] h-[112%]" style={{ y: sceneY }} aria-hidden="true">
        <TileScene scene={scene} className="h-full w-full" />
      </motion.div>

      {/* Bright frosted panel keeps the text readable while the tiles stay colourful around it */}
      <motion.div
        className="relative m-3 min-w-0 max-w-2xl rounded-2xl bg-surface-card/90 p-5 shadow-lg ring-1 ring-white/60 backdrop-blur-md sm:m-5 sm:p-7"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }}
      >
        {badge && (
          <motion.span variants={item} className={`mb-2.5 inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${TONE_BADGE[tone]}`}>
            <span className={`relative flex h-1.5 w-1.5 shrink-0`}>
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${TONE_DOT[tone]}`} />
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} />
            </span>
            <span className="min-w-0">{badge}</span>
          </motion.span>
        )}
        <motion.h1 variants={item} className="font-display text-2xl font-bold text-ink sm:text-3xl md:text-4xl">
          {title}
        </motion.h1>
        <motion.p variants={item} className="mt-2 max-w-xl text-xs leading-relaxed text-ink-secondary sm:text-sm md:text-base">
          {subtitle}
        </motion.p>
        {actions && (
          <motion.div variants={item} className="mt-4 flex flex-wrap items-center gap-3">
            {actions}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
