import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { EASE_IN, EASE_OUT, rowItem, springModal, staggerContainer } from "@/components/ui/motion";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/cn";
import { groupByDate } from "@/lib/history";
import {
  DEFAULT_INPUT,
  LAYOUT_WASTE,
  TILE_PRESETS,
  calculate,
  type CalcArea,
  type CalcInput,
  type Layout,
} from "@/lib/tileCalc";
import { clearHistory, defaultName, loadHistory, removeEntry, saveEntry, summarize, type CalcEntry } from "@/lib/calcHistory";

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const field = "field-focus w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900";
/** Card-level entrance used by the calculator's panels. */
const panelIn = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, delay, ease: EASE_OUT } },
});
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500";

// Text boxes hold what the person is typing; empty means "not entered yet", never a silent zero.
const toNum = (text: string) => (text.trim() === "" ? NaN : Number(text));
const fmt = (n: number, digits = 2) => n.toLocaleString(undefined, { maximumFractionDigits: digits });
const bags = (n: number) => `${n} ${n === 1 ? "bag" : "bags"}`;
const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "INR", maximumFractionDigits: 0 });

interface AreaText {
  id: string;
  label: string;
  length: string;
  width: string;
  openings: string;
}

const emptyArea = (name: string): AreaText => ({ id: newId(), label: name, length: "", width: "", openings: "" });
const textToArea = (a: AreaText): CalcArea => ({ id: a.id, label: a.label, length: toNum(a.length), width: toNum(a.width), openings: a.openings.trim() === "" ? 0 : Number(a.openings) });
const areaToText = (a: CalcArea): AreaText => ({ id: a.id, label: a.label, length: Number.isFinite(a.length) && a.length > 0 ? String(a.length) : "", width: Number.isFinite(a.width) && a.width > 0 ? String(a.width) : "", openings: a.openings > 0 ? String(a.openings) : "" });

export function CalculatorPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [unit, setUnit] = useState<CalcInput["unit"]>(DEFAULT_INPUT.unit);
  const [areas, setAreas] = useState<AreaText[]>([emptyArea("Floor")]);
  const [tileW, setTileW] = useState("600");
  const [tileH, setTileH] = useState("600");
  const [thickness, setThickness] = useState("9");
  const [joint, setJoint] = useState("3");
  const [layout, setLayout] = useState<Layout>("straight");
  const [waste, setWaste] = useState(String(LAYOUT_WASTE.straight.pct));
  const [perBox, setPerBox] = useState("4");
  const [price, setPrice] = useState("");
  const [adhesiveRate, setAdhesiveRate] = useState("5");

  const [history, setHistory] = useState<CalcEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showHistoryOnPhone, setShowHistoryOnPhone] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<CalcEntry | null>(null);

  useEffect(() => {
    setHistory(loadHistory(userId));
    setActiveId(null);
  }, [userId]);

  const input: CalcInput = useMemo(
    () => ({
      unit,
      areas: areas.map(textToArea),
      tileWidthMm: toNum(tileW),
      tileHeightMm: toNum(tileH),
      tileThicknessMm: toNum(thickness),
      jointMm: toNum(joint),
      wastePct: toNum(waste),
      piecesPerBox: toNum(perBox),
      pricePerBox: price.trim() === "" ? null : Number(price),
      adhesiveKgPerM2: toNum(adhesiveRate),
      adhesiveBagKg: DEFAULT_INPUT.adhesiveBagKg,
      groutBagKg: DEFAULT_INPUT.groutBagKg,
    }),
    [unit, areas, tileW, tileH, thickness, joint, waste, perBox, price, adhesiveRate],
  );

  // Real-time: the answer is recalculated on every keystroke.
  const outcome = useMemo(() => calculate(input), [input]);

  function loadInput(i: CalcInput) {
    setUnit(i.unit);
    setAreas(i.areas.length > 0 ? i.areas.map(areaToText) : [emptyArea("Floor")]);
    setTileW(String(i.tileWidthMm));
    setTileH(String(i.tileHeightMm));
    setThickness(String(i.tileThicknessMm));
    setJoint(String(i.jointMm));
    setWaste(String(i.wastePct));
    setPerBox(String(i.piecesPerBox));
    setPrice(i.pricePerBox === null ? "" : String(i.pricePerBox));
    setAdhesiveRate(String(i.adhesiveKgPerM2));
  }

  function openEntry(entry: CalcEntry) {
    loadInput(entry.input);
    setActiveId(entry.id);
    setSaved(false);
    setShowHistoryOnPhone(false);
  }

  function startNew() {
    loadInput({ ...DEFAULT_INPUT, areas: [{ id: newId(), label: "Floor", length: 0, width: 0, openings: 0 }] });
    setActiveId(null);
    setSaved(false);
    setShowHistoryOnPhone(false);
  }

  function save() {
    if (!outcome.ok) return;
    const id = activeId ?? newId();
    const existing = history.find((e) => e.id === id);
    const entry: CalcEntry = {
      id,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      name: existing?.name ?? defaultName(input),
      input,
      summary: summarize(input),
    };
    setHistory(saveEntry(userId, history, entry));
    setActiveId(id);
    setSaved(true);
  }

  function pickLayout(next: Layout) {
    setLayout(next);
    setWaste(String(LAYOUT_WASTE[next].pct));
    setSaved(false);
  }

  function updateArea(id: string, patch: Partial<AreaText>) {
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setSaved(false);
  }

  const groups = groupByDate(history);
  const result = outcome.ok ? outcome.result : null;
  const unitLabel = unit === "ft" ? "ft" : "m";

  return (
    <PageContainer className="max-w-7xl pb-28 xl:pb-8" compact>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        {/* History */}
        {/* min-w-0: a grid/flex item's default min-width:auto refuses to
            shrink below its content, so on a phone this aside could force
            the whole grid (and the page) wider than the viewport. */}
        <aside className={cn("flex min-h-0 min-w-0 flex-col rounded-2xl border border-stone-200 bg-white shadow-soft lg:h-[calc(100vh-11rem)]", !showHistoryOnPhone && "hidden lg:flex")} aria-label="Calculation history">
          <div className="flex min-w-0 items-center justify-between gap-2 border-b border-stone-200 p-4">
            <h2 className="min-w-0 truncate font-display text-xl text-stone-900">History</h2>
            <Button size="sm" onClick={startNew} className="shrink-0">
              + New
            </Button>
          </div>
          <div className="scroll-soft min-h-0 flex-1 overflow-y-auto p-2">
            {history.length === 0 ? (
              <p className="animate-fade-up p-4 text-sm text-stone-500">Saved calculations appear here. Fill in a job and press Save.</p>
            ) : (
              groups.map((group) => (
                <section key={group.label} className="mb-3">
                  <h3 className="sticky top-0 z-10 bg-white/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500 backdrop-blur-sm">{group.label}</h3>
                  <motion.ul variants={staggerContainer(0.04)} initial="hidden" animate="show">
                    <AnimatePresence initial={false}>
                    {group.items.map((entry) => (
                      <motion.li
                        key={entry.id}
                        className="group relative"
                        variants={rowItem}
                        exit={{ opacity: 0, x: -16, transition: { duration: 0.2, ease: EASE_IN } }}
                      >
                        <button
                          type="button"
                          onClick={() => openEntry(entry)}
                          aria-current={entry.id === activeId ? "true" : undefined}
                          className={cn(
                            "relative isolate w-full rounded-xl px-3 py-2.5 pr-11 text-left transition-[background-color,transform] duration-200 active:scale-[0.99]",
                            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-champagne-500",
                            entry.id !== activeId && "hover:bg-stone-100",
                          )}
                        >
                          {entry.id === activeId && (
                            <motion.span
                              layoutId="calc-history-active"
                              className="absolute inset-0 -z-10 rounded-xl bg-clay-100 ring-1 ring-inset ring-clay-200"
                              transition={{ type: "spring", stiffness: 420, damping: 36 }}
                              aria-hidden="true"
                            />
                          )}
                          <span className="block truncate text-sm font-medium text-stone-900">{entry.name}</span>
                          <span className="block truncate text-xs text-stone-500">{entry.summary}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingRemove(entry)}
                          aria-label={`Delete ${entry.name}`}
                          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-stone-500 transition-[opacity,background-color,color] duration-200 hover:bg-red-50 hover:text-red-700 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </motion.li>
                    ))}
                    </AnimatePresence>
                  </motion.ul>
                </section>
              ))
            )}
          </div>
          {history.length > 0 && (
            <div className="border-t border-stone-200 p-3">
              <button type="button" onClick={() => setConfirmClear(true)} className="w-full rounded-lg px-3 py-2 text-sm text-stone-500 transition-[background-color,color,transform] duration-200 hover:bg-red-50 hover:text-red-700 active:scale-[0.98]">
                Clear all history
              </button>
            </div>
          )}
        </aside>

        {/* Calculator */}
        <section className={cn("min-w-0", showHistoryOnPhone && "hidden lg:block")}>
          <motion.div className="mb-4 flex flex-wrap items-center justify-between gap-3" {...panelIn(0)}>
            <div className="min-w-0">
              <h1 className="font-display text-3xl text-stone-900">Tile calculator</h1>
              <p className="mt-1 text-sm text-stone-600">How many tiles, boxes, grout and adhesive a job needs. The answer updates as you type.</p>
            </div>
            <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setShowHistoryOnPhone(true)}>
              History ({history.length})
            </Button>
          </motion.div>

          <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
            <div className="space-y-5">
              {/* Areas */}
              <motion.div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft sm:p-5" {...panelIn(0.08)}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-lg text-stone-900">Areas to tile</h2>
                  <div className="inline-flex rounded-lg border border-stone-300 p-0.5" role="group" aria-label="Measurement unit">
                    {(["ft", "m"] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => {
                          setUnit(u);
                          setSaved(false);
                        }}
                        aria-pressed={unit === u}
                        className={cn(
                          "relative isolate rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-200",
                          unit === u ? "text-white" : "text-stone-600 hover:bg-stone-100",
                        )}
                      >
                        {unit === u && (
                          <motion.span
                            layoutId="calc-unit-pill"
                            className="absolute inset-0 -z-10 rounded-md bg-stone-900 shadow-sm"
                            transition={{ type: "spring", stiffness: 480, damping: 34 }}
                            aria-hidden="true"
                          />
                        )}
                        {u === "ft" ? "Feet" : "Metres"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <AnimatePresence initial={false}>
                  {areas.map((a, i) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: EASE_OUT } }}
                      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18, ease: EASE_IN } }}
                      className="rounded-xl border border-stone-200 bg-stone-50 p-3.5 transition-colors duration-200 focus-within:border-champagne-400 focus-within:bg-white"
                    >
                      <div className="flex items-center gap-2">
                        <input aria-label={`Name of area ${i + 1}`} className={cn(field, "font-medium")} value={a.label} maxLength={40} onChange={(e) => updateArea(a.id, { label: e.target.value })} placeholder="e.g. Bathroom floor" />
                        {areas.length > 1 && (
                          <button type="button" onClick={() => setAreas((prev) => prev.filter((x) => x.id !== a.id))} aria-label={`Remove ${a.label || `area ${i + 1}`}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-stone-500 transition-[background-color,color,transform] duration-200 hover:bg-red-50 hover:text-red-700 active:scale-90">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className={label} htmlFor={`len-${a.id}`}>Length ({unitLabel})</label>
                          <input id={`len-${a.id}`} inputMode="decimal" className={field} value={a.length} onChange={(e) => updateArea(a.id, { length: e.target.value })} placeholder="0" />
                        </div>
                        <div>
                          <label className={label} htmlFor={`wid-${a.id}`}>Width / height ({unitLabel})</label>
                          <input id={`wid-${a.id}`} inputMode="decimal" className={field} value={a.width} onChange={(e) => updateArea(a.id, { width: e.target.value })} placeholder="0" />
                        </div>
                        <div>
                          <label className={label} htmlFor={`op-${a.id}`}>Doors / windows ({unitLabel}²)</label>
                          <input id={`op-${a.id}`} inputMode="decimal" className={field} value={a.openings} onChange={(e) => updateArea(a.id, { openings: e.target.value })} placeholder="0" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  </AnimatePresence>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAreas((prev) => [...prev, emptyArea(`Area ${prev.length + 1}`)]);
                    setSaved(false);
                  }}
                  disabled={areas.length >= 12}
                  className="mt-3 rounded-lg border border-dashed border-stone-300 px-3.5 py-2 text-sm font-medium text-clay-700 transition-[background-color,border-color,transform] duration-200 hover:border-clay-400 hover:bg-clay-50 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
                >
                  + Add another area
                </button>
              </motion.div>

              {/* Tile */}
              <motion.div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft sm:p-5" {...panelIn(0.16)}>
                <h2 className="font-display text-lg text-stone-900">Tile</h2>
                <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Common sizes">
                  {TILE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setTileW(String(p.w));
                        setTileH(String(p.h));
                        setPerBox(String(p.perBox));
                        setSaved(false);
                      }}
                      aria-pressed={tileW === String(p.w) && tileH === String(p.h)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition-[background-color,border-color,color,transform] duration-200 hover:-translate-y-px active:scale-95",
                        tileW === String(p.w) && tileH === String(p.h) ? "border-stone-900 bg-stone-900 text-white shadow-sm" : "border-stone-300 text-stone-600 hover:border-stone-400 hover:bg-stone-100",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <NumberField id="tw" text="Width (mm)" value={tileW} onChange={(v) => { setTileW(v); setSaved(false); }} />
                  <NumberField id="th" text="Height (mm)" value={tileH} onChange={(v) => { setTileH(v); setSaved(false); }} />
                  <NumberField id="tt" text="Thickness (mm)" value={thickness} onChange={(v) => { setThickness(v); setSaved(false); }} />
                  <NumberField id="tj" text="Grout joint (mm)" value={joint} onChange={(v) => { setJoint(v); setSaved(false); }} />
                  <NumberField id="pb" text="Pieces per box" value={perBox} onChange={(v) => { setPerBox(v); setSaved(false); }} />
                  <NumberField id="pr" text="Price per box (Rs.)" value={price} placeholder="optional" onChange={(v) => { setPrice(v); setSaved(false); }} />
                  <NumberField id="ar" text="Adhesive (kg per m²)" value={adhesiveRate} onChange={(v) => { setAdhesiveRate(v); setSaved(false); }} />
                </div>

                <div className="mt-5">
                  <label className={label} htmlFor="layout">Laying pattern (sets the wastage)</label>
                  <select id="layout" className={field} value={layout} onChange={(e) => pickLayout(e.target.value as Layout)}>
                    {(Object.keys(LAYOUT_WASTE) as Layout[]).map((k) => (
                      <option key={k} value={k}>
                        {LAYOUT_WASTE[k].label} · {LAYOUT_WASTE[k].pct}%
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-stone-500">{LAYOUT_WASTE[layout].hint}</p>
                  <div className="mt-3 max-w-[12rem]">
                    <NumberField id="wp" text="Wastage (%)" value={waste} onChange={(v) => { setWaste(v); setSaved(false); }} />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Result */}
            <motion.div id="calc-result" className="scroll-mt-24 xl:sticky xl:top-24 xl:self-start" {...panelIn(0.24)}>
              <div className="relative overflow-hidden rounded-2xl border border-teal-400/40 bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-700 p-5 text-white shadow-xl" aria-live="polite">
                <span aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 animate-float rounded-full bg-white/10 blur-2xl" />
                <h2 className="relative font-display text-lg text-white">You need</h2>
                <AnimatePresence mode="wait" initial={false}>
                {result ? (
                  <motion.div
                    key="result"
                    className="relative"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  >
                    <p className="mt-3 text-5xl font-semibold tabular-nums">
                      <AnimatedNumber value={result.boxes} />
                    </p>
                    <p className="text-sm text-teal-50">boxes of {input.piecesPerBox} tiles</p>

                    <dl className="mt-5 space-y-2.5 text-sm">
                      <Row k="Area to tile" v={`${fmt(result.netAreaSqFt)} sq ft (${fmt(result.netAreaM2)} m²)`} />
                      <Row k="Tiles needed (with wastage)" v={fmt(result.tilesNeeded, 0)} />
                      <Row k="Tiles you buy" v={`${fmt(result.tilesPurchased, 0)} (${fmt(result.spareTiles, 0)} spare)`} />
                      <Row k="Boxes cover" v={`${fmt(result.purchasedCoverageSqFt)} sq ft`} />
                      <Row k="Adhesive" v={`${fmt(result.adhesiveKg)} kg · ${bags(result.adhesiveBags)} of ${input.adhesiveBagKg} kg`} />
                      <Row k="Grout" v={`${fmt(result.groutKg)} kg · ${bags(result.groutBags)} of ${input.groutBagKg} kg`} />
                      {result.totalCost !== null && <Row k="Tile cost" v={money(result.totalCost)} strong />}
                    </dl>

                    {result.perArea.length > 1 && (
                      <ul className="mt-4 space-y-1 border-t border-white/25 pt-3 text-xs text-teal-50">
                        {result.perArea.map((a) => (
                          <li key={a.id} className="flex justify-between gap-3">
                            <span className="truncate">{a.label}</span>
                            <span className="tabular-nums">{fmt(a.netAreaSqFt)} sq ft</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                ) : (
                  <motion.ul
                    key="errors"
                    className="relative mt-3 space-y-1.5 text-sm text-amber-100"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  >
                    {outcome.ok ? null : outcome.errors.slice(0, 4).map((e) => <li key={e}>• {e}</li>)}
                  </motion.ul>
                )}
                </AnimatePresence>

                <Button className="relative mt-5 w-full bg-white text-stone-900 hover:bg-stone-200" onClick={save} disabled={!result}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={saved ? "saved" : activeId ? "update" : "save"}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                    >
                      {saved ? "Saved to history ✓" : activeId ? "Update saved calculation" : "Save to history"}
                    </motion.span>
                  </AnimatePresence>
                </Button>
              </div>
              <p className="mt-3 text-xs text-stone-500">
                Estimates follow standard shop practice. Round up, keep spare boxes from the same batch (colour can vary between batches), and confirm measurements on site. History is saved on this device for your account.
              </p>
            </motion.div>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {result && !showHistoryOnPhone && (
          <motion.button
            key="calc-summary-bar"
            type="button"
            onClick={() => document.getElementById("calc-result")?.scrollIntoView({ behavior: "smooth" })}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0, transition: springModal }}
            exit={{ opacity: 0, y: 40, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.98 }}
            className="fixed inset-x-4 bottom-4 z-30 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-700 px-5 py-3.5 text-left text-white shadow-2xl ring-1 ring-white/20 xl:hidden"
          >
            <span className="text-lg font-semibold tabular-nums">{result.boxes} boxes</span>
            <span className="ml-2 text-sm text-teal-50">· {fmt(result.tilesNeeded, 0)} tiles · tap for details</span>
          </motion.button>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={pendingRemove !== null}
        title="Delete calculation?"
        message={pendingRemove ? `Delete "${pendingRemove.name}" from your history?` : ""}
        onConfirm={async () => {
          if (!pendingRemove) return;
          setHistory(removeEntry(userId, history, pendingRemove.id));
          if (activeId === pendingRemove.id) setActiveId(null);
        }}
        onClose={() => setPendingRemove(null)}
      />
      <ConfirmDialog
        open={confirmClear}
        title="Clear all history?"
        message="This removes every saved calculation on this device."
        confirmLabel="Clear all"
        onConfirm={async () => {
          setHistory(clearHistory(userId));
          setActiveId(null);
        }}
        onClose={() => setConfirmClear(false)}
      />
    </PageContainer>
  );
}

function NumberField({ id, text, value, onChange, placeholder }: { id: string; text: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="min-w-0">
      <label className={label} htmlFor={id}>
        {text}
      </label>
      <input id={id} inputMode="decimal" className={field} value={value} placeholder={placeholder ?? "0"} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-teal-100">{k}</dt>
      <dd className={cn("text-right tabular-nums", strong ? "text-base font-semibold" : "font-medium")}>{v}</dd>
    </div>
  );
}
