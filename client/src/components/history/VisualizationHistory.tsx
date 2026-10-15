import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { EASE_IN, EASE_OUT, rowItem, staggerContainer } from "@/components/ui/motion";
import { friendlyErrorMessage } from "@/api/client";
import { deleteVisualization, listMyVisualizations, setVisualizationVisibility } from "@/api/visualizations";
import { getPublicTileImageUrl } from "@/lib/tileImage";
import { cn } from "@/lib/cn";
import { PATTERNS, SURFACES } from "@/lib/designPatterns";
import { groupByDate, visualizationSubtitle, visualizationTitle } from "@/lib/history";
import type { Visualization } from "@/api/types";

const STATUS: Record<string, { tone: "success" | "warning" | "danger" | "neutral"; label: string; dot: string }> = {
  completed: { tone: "success", label: "Ready", dot: "bg-emerald-500" },
  pending: { tone: "warning", label: "Waiting", dot: "bg-amber-400 animate-pulse" },
  generating: { tone: "warning", label: "Generating", dot: "bg-amber-400 animate-pulse" },
  failed: { tone: "danger", label: "Failed", dot: "bg-red-500" },
};
const IN_PROGRESS = new Set(["pending", "generating"]);
const POLL_MS = 5000;
/** ~10 minutes of polling; after that the list only refreshes when the tab becomes visible again. */
const MAX_POLLS = 120;

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

/**
 * The signed-in "Designs" page, laid out like a chat history: every visualization listed by day on the left,
 * the selected one shown large on the right. It refreshes by itself while anything is still generating.
 */
export function VisualizationHistory() {
  const [items, setItems] = useState<Visualization[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetailOnPhone, setShowDetailOnPhone] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Visualization | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await listMyVisualizations();
      if (mounted.current) {
        setItems(next);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) setError(friendlyErrorMessage(err, "We couldn't load your designs."));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Real-time: while something is being generated, check again every few seconds — capped so a row stuck
  // in "generating" can't poll forever. The budget resets once nothing is running any more.
  const anyRunning = items?.some((v) => IN_PROGRESS.has(v.status)) ?? false;
  const pollCount = useRef(0);
  useEffect(() => {
    if (!anyRunning) {
      pollCount.current = 0;
      return;
    }
    if (pollCount.current >= MAX_POLLS) return;
    const id = window.setInterval(() => {
      if (!mounted.current || pollCount.current >= MAX_POLLS) {
        window.clearInterval(id);
        return;
      }
      pollCount.current += 1;
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [anyRunning, refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!items) return [];
    if (!q) return items;
    return items.filter((v) => {
      const haystack = [visualizationTitle(v), visualizationSubtitle(v), v.tile?.name, v.requirements, v.roomType].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);
  const selected = filtered.find((v) => v.id === selectedId) ?? null;

  // Desktop shows a detail pane straight away, so pick the newest. Phones start on the list.
  useEffect(() => {
    if (!selected && filtered.length > 0 && window.matchMedia("(min-width: 1024px)").matches) setSelectedId(filtered[0]?.id ?? null);
  }, [selected, filtered]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteVisualization(pendingDelete.id);
    } catch (err) {
      throw new Error(friendlyErrorMessage(err, "We couldn't delete that design. Please try again."));
    }
    setItems((prev) => prev?.filter((v) => v.id !== pendingDelete.id) ?? prev);
    if (selectedId === pendingDelete.id) {
      setSelectedId(null);
      setShowDetailOnPhone(false);
    }
  }

  async function toggleVisibility(v: Visualization) {
    const next = !v.isPublic;
    setTogglingId(v.id);
    try {
      await setVisualizationVisibility(v.id, next);
      if (!mounted.current) return;
      setItems((prev) => prev?.map((item) => (item.id === v.id ? { ...item, isPublic: next } : item)) ?? prev);
    } catch (err) {
      if (mounted.current) setError(friendlyErrorMessage(err, "We couldn't change that design's visibility."));
    } finally {
      if (mounted.current) setTogglingId(null);
    }
  }

  if (error && items === null) return <ErrorState message={error} />;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
      {/* History list */}
      {/* min-w-0: grid/flex items default to min-width:auto, which refuses to
          shrink below the content's natural width — on a phone that forces
          the whole grid track (and the page) wider than the viewport,
          producing a horizontal scroll that cuts off the sticky navbar too. */}
      <aside className={cn("flex min-h-0 min-w-0 flex-col rounded-2xl border border-stone-200 bg-white shadow-soft lg:h-[calc(100vh-11rem)]", showDetailOnPhone && "hidden lg:flex")} aria-label="Design history">
        <div className="min-w-0 space-y-3 border-b border-stone-200 p-4">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <h1 className="min-w-0 truncate font-display text-xl text-stone-900">Design history</h1>
            <Link to="/projects" className="shrink-0">
              <Button size="sm">+ New design</Button>
            </Link>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search designs"
            aria-label="Search designs"
            className="field-focus w-full rounded-lg border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm placeholder:text-stone-500 focus:bg-white"
          />
        </div>

        <div className="scroll-soft min-h-0 flex-1 overflow-y-auto p-2">
          {items === null ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-1 py-1">
                  <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="animate-fade-up p-4 text-sm text-stone-500">No designs yet. Upload a room and make your first one.</p>
          ) : groups.length === 0 ? (
            <p className="animate-fade-up p-4 text-sm text-stone-500">Nothing matches that search.</p>
          ) : (
            groups.map((group) => (
              <section key={group.label} className="mb-3">
                <h2 className="sticky top-0 z-10 bg-white/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500 backdrop-blur-sm">{group.label}</h2>
                <motion.ul variants={staggerContainer(0.04)} initial="hidden" animate="show">
                  <AnimatePresence initial={false}>
                  {group.items.map((v) => {
                    const status = STATUS[v.status] ?? STATUS.pending!;
                    const active = v.id === selectedId;
                    return (
                      <motion.li
                        key={v.id}
                        className="group relative"
                        variants={rowItem}
                        exit={{ opacity: 0, x: -16, transition: { duration: 0.2, ease: EASE_IN } }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(v.id);
                            setShowDetailOnPhone(true);
                          }}
                          aria-current={active ? "true" : undefined}
                          className={cn(
                            "relative isolate flex w-full items-center gap-3 rounded-xl py-2.5 pl-3 pr-11 text-left transition-[background-color,transform] duration-200 active:scale-[0.99]",
                            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-champagne-500",
                            !active && "hover:bg-stone-100",
                          )}
                        >
                          {active && (
                            <motion.span
                              layoutId="history-active-row"
                              className="absolute inset-0 -z-10 rounded-xl bg-clay-100 ring-1 ring-inset ring-clay-200"
                              transition={{ type: "spring", stiffness: 420, damping: 36 }}
                              aria-hidden="true"
                            />
                          )}
                          <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-stone-200">
                            {v.resultImageUrl ? <img src={v.resultImageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" /> : null}
                            <span className={cn("absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white", status.dot)} aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-stone-900">{visualizationTitle(v)}</span>
                            <span className="block truncate text-xs text-stone-500">
                              {visualizationSubtitle(v) || status.label} · {timeLabel(v.createdAt)}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(v)}
                          aria-label={`Delete ${visualizationTitle(v)}`}
                          title="Delete"
                          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-stone-500 transition-[opacity,background-color,color] duration-200 hover:bg-red-50 hover:text-red-700 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </motion.li>
                    );
                  })}
                  </AnimatePresence>
                </motion.ul>
              </section>
            ))
          )}
        </div>
      </aside>

      {/* Detail pane */}
      <section className={cn("min-w-0", !showDetailOnPhone && "hidden lg:block")} aria-live="polite">
        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              key="error"
              role="alert"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait" initial={false}>
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.15, ease: EASE_IN } }}
            >
              <Detail
                v={selected}
                toggling={togglingId === selected.id}
                onBack={() => setShowDetailOnPhone(false)}
                onDelete={() => setPendingDelete(selected)}
                onToggle={() => toggleVisibility(selected)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/60 p-8 text-center text-sm text-stone-500"
            >
              {items && items.length > 0 ? "Pick a design from the list to see it here." : "Your finished designs will appear here."}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete design?"
        message={pendingDelete ? `Delete "${visualizationTitle(pendingDelete)}" and its generated image?` : ""}
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}

function Detail({ v, toggling, onBack, onDelete, onToggle }: { v: Visualization; toggling: boolean; onBack: () => void; onDelete: () => void; onToggle: () => void }) {
  const status = STATUS[v.status] ?? STATUS.pending!;
  const areas = v.design?.areas ?? [];
  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft">
      <div className="flex items-center gap-3 border-b border-stone-200 px-4 py-3">
        <button type="button" onClick={onBack} className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-stone-700 transition-[background-color,transform] duration-200 hover:bg-stone-100 active:scale-95 lg:hidden">
          ← History
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl text-stone-900">{visualizationTitle(v)}</h2>
          <p className="text-xs text-stone-500">{new Date(v.createdAt).toLocaleString()}</p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <div className="bg-stone-100">
        {v.resultImageUrl ? (
          <motion.img
            src={v.resultImageUrl}
            alt={`Visualization: ${visualizationTitle(v)}`}
            className="mx-auto max-h-[60vh] w-full object-contain"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          />
        ) : (
          <div className="flex aspect-[16/9] items-center justify-center px-6 text-center text-sm text-stone-500">
            {IN_PROGRESS.has(v.status) ? (
              <span className="flex items-center gap-3">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" aria-hidden="true" />
                Your design is being generated. This page updates by itself.
              </span>
            ) : v.status === "failed" ? (
              (v.errorMessage ?? "This generation failed. Your credits were returned.")
            ) : (
              "No image yet."
            )}
          </div>
        )}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {areas.length > 0 ? (
          <motion.ul className="grid gap-2 sm:grid-cols-2" variants={staggerContainer(0.05, 0.1)} initial="hidden" animate="show">
            {areas.map((a, i) => (
              <motion.li
                key={`${a.surface}-${a.location}-${i}`}
                variants={rowItem}
                className="min-w-0 rounded-xl border border-stone-200 p-3 transition-colors duration-200 hover:border-sage-400/70 hover:bg-surface-card"
              >
                <p className="text-xs uppercase tracking-wide text-stone-500">
                  {SURFACES[a.surface]?.label ?? a.surface} · {PATTERNS[a.pattern]?.label ?? a.pattern}
                </p>
                <p className="truncate text-sm font-medium text-stone-900">{a.location}</p>
                {a.patternNote && <p className="truncate text-xs text-stone-500">{a.patternNote}</p>}
              </motion.li>
            ))}
          </motion.ul>
        ) : (
          v.tile && (
            <div className="flex items-center gap-3">
              <img src={getPublicTileImageUrl(v.tile.storagePath)} alt="" className="h-10 w-10 rounded-lg object-cover" />
              <p className="text-sm font-medium text-stone-900">{v.tile.name}</p>
            </div>
          )
        )}

        {v.requirements && (
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">Requirements</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">{v.requirements}</p>
          </div>
        )}

        <p className="text-xs text-stone-500">
          {typeof v.creditsCharged === "number" && v.creditsCharged > 0 ? `${v.creditsCharged} credits · ` : ""}
          {v.isPublic ? "Public: shown on the signed-out feed" : "Private: only you can see this"}
        </p>

        <div className="flex flex-wrap gap-2.5">
          {v.status === "completed" && (
            <Link to={`/result/${v.id}`}>
              <Button size="md">Open full result</Button>
            </Link>
          )}
          {v.roomUploadId && (
            <Link to={`/tiles/${v.roomUploadId}`}>
              <Button size="md" variant="outline">
                Edit design
              </Button>
            </Link>
          )}
          <Button size="md" variant="outline" onClick={onToggle} loading={toggling}>
            {v.isPublic ? "Make private" : "Make public"}
          </Button>
          <Button size="md" variant="ghost" className="text-red-700 hover:bg-red-50" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
    </article>
  );
}
