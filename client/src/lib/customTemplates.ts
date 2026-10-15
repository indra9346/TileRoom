import type { SurfaceType, Tile } from "../api/types";
import { PATTERNS, SURFACES, isValidLabel, type DesignPattern } from "./designPatterns";
import { emptySlots, newKey, chosenTiles, type DraftArea } from "./designDraft";
import { sizeToDimensions, type AreaSize } from "./fitRecommend";
import { LAYOUTS, wallInfo, type WallId } from "./roomLayouts";
import { TEMPLATES, isTemplateId, type TemplateId } from "./roomTemplates";

/**
 * Custom templates: a showroom owner saves the room template + areas they built (surfaces switched on,
 * patterns, notes, sizes and the tiles chosen) under a name, and re-applies it to any later room.
 *
 * Saved shape mirrors the server's designTemplateBodySchema (server/lib/validation.ts). Tiles are stored
 * by id only; on apply they are resolved against the owner's current catalog, so a tile that was deleted
 * or hidden since simply leaves its slot empty instead of breaking the design.
 */
export interface TemplateArea {
  surface: SurfaceType;
  location: string;
  wall?: WallId;
  dimensions?: { widthMm: number; heightMm: number };
  pattern: DesignPattern;
  patternNote?: string;
  tileIds: string[];
}

export interface CustomTemplate {
  id: string;
  name: string;
  description: string | null;
  baseTemplate: string;
  areas: TemplateArea[];
  createdAt: string;
  updatedAt: string;
  /** True when it lives only in this browser (the server store was unavailable when it was saved). */
  local?: boolean;
}

export interface CustomTemplateInput {
  name: string;
  description?: string;
  baseTemplate: string;
  areas: TemplateArea[];
}

const clean = (v: string) => v.replace(/\s+/g, " ").trim();

/** Problem with the name / design, or null when it can be saved. */
export function templateProblem(name: string, areas: DraftArea[]): string | null {
  if (!isValidLabel(name, 60)) return "Give the template a name (letters, numbers and simple punctuation, up to 60 characters).";
  if (areas.length === 0) return "Switch on at least one surface before saving a template.";
  const bad = areas.find((a) => !isValidLabel(a.location, 80) || (a.patternNote.trim() !== "" && !isValidLabel(a.patternNote, 160)));
  if (bad) return `Fix the name or pattern note of "${bad.location || SURFACES[bad.surface].label}" first.`;
  return null;
}

/** The current Design Studio state as a saveable template. Unchosen tile slots are simply not stored. */
export function draftToTemplate(name: string, description: string, baseTemplate: TemplateId, areas: DraftArea[]): CustomTemplateInput {
  return {
    name: clean(name),
    ...(clean(description) ? { description: clean(description).slice(0, 200) } : {}),
    baseTemplate,
    areas: areas.map((a) => {
      const dimensions = sizeToDimensions(a.size);
      return {
        surface: a.surface,
        location: clean(a.location),
        ...(a.wall ? { wall: a.wall } : {}),
        ...(dimensions ? { dimensions } : {}),
        pattern: a.pattern,
        ...(clean(a.patternNote) ? { patternNote: clean(a.patternNote) } : {}),
        tileIds: chosenTiles(a).map((t) => t.id),
      };
    }),
  };
}

/** mm back to the owner-editable size (shown in metres, the clearest unit for a room surface). */
function dimensionsToSize(d?: { widthMm: number; heightMm: number }): AreaSize | undefined {
  if (!d) return undefined;
  const m = (mm: number) => String(Math.round(mm) / 1000);
  return { width: m(d.widthMm), height: m(d.heightMm), unit: "m" } as AreaSize;
}

export interface AppliedTemplate {
  templateId: TemplateId;
  areas: DraftArea[];
  /** Tiles the template named that are no longer in the catalog (deleted, hidden or not loaded). */
  missingTiles: number;
}

/**
 * Turns a saved template into Design Studio areas. Anything that no longer fits (unknown base template,
 * a wall the layout does not have, a surface or pattern the app no longer offers) is dropped or downgraded
 * rather than producing a design the server would reject.
 */
export function applyCustomTemplate(t: Pick<CustomTemplate, "baseTemplate" | "areas">, catalog: Tile[]): AppliedTemplate {
  const templateId: TemplateId = isTemplateId(t.baseTemplate) ? t.baseTemplate : "free";
  const layout = TEMPLATES[templateId].layout;
  const byId = new Map(catalog.map((tile) => [tile.id, tile]));
  let missingTiles = 0;
  const usedWalls = new Set<WallId>();
  const areas: DraftArea[] = [];
  for (const a of t.areas) {
    if (!(a.surface in SURFACES) || !(a.pattern in PATTERNS)) continue;
    let wall: WallId | undefined;
    let location = a.location;
    if (a.surface === "wall" && layout !== "open") {
      if (!a.wall || !wallInfo(layout, a.wall) || usedWalls.has(a.wall)) continue;
      wall = a.wall;
      usedWalls.add(wall);
      location = wallInfo(layout, wall)!.label;
    }
    const slots: Array<Tile | null> = emptySlots(a.pattern);
    let filled = 0;
    for (const id of a.tileIds) {
      const tile = byId.get(id);
      if (!tile || !tile.isActive) {
        missingTiles += 1;
        continue;
      }
      if (filled < slots.length) slots[filled++] = tile;
    }
    const size = dimensionsToSize(a.dimensions);
    areas.push({
      key: newKey(),
      surface: a.surface,
      location,
      ...(wall ? { wall } : {}),
      ...(size ? { size } : {}),
      pattern: a.pattern,
      patternNote: a.patternNote ?? "",
      slots,
    });
  }
  return { templateId, areas, missingTiles };
}

/** One-line description of a saved template for its card. */
export function templateSummary(t: Pick<CustomTemplate, "baseTemplate" | "areas">): string {
  const base = isTemplateId(t.baseTemplate) ? TEMPLATES[t.baseTemplate].label : "Free naming";
  const surfaces = t.areas.map((a) => (a.wall ? a.wall : SURFACES[a.surface]?.label ?? a.surface));
  return `${base} · ${surfaces.join(", ")}`;
}

// ---- Browser fallback store (used only when the server store is unavailable) ----

const LOCAL_KEY = "tileroom:custom-templates:v1";

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const local = (): KeyValueStore | undefined => (globalThis as { localStorage?: KeyValueStore }).localStorage;

export function loadLocalTemplates(): CustomTemplate[] {
  try {
    const raw = local()?.getItem(LOCAL_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list)
      ? (list as CustomTemplate[]).filter((t) => t && typeof t.id === "string" && typeof t.name === "string" && Array.isArray(t.areas)).map((t) => ({ ...t, local: true }))
      : [];
  } catch {
    return [];
  }
}

export function saveLocalTemplates(list: CustomTemplate[]): void {
  try {
    local()?.setItem(LOCAL_KEY, JSON.stringify(list.filter((t) => t.local)));
  } catch {
    /* storage full or blocked: the template still exists for this visit */
  }
}

export function newLocalTemplate(input: CustomTemplateInput): CustomTemplate {
  const now = new Date().toISOString();
  return { id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, description: input.description ?? null, ...input, createdAt: now, updatedAt: now, local: true };
}

/** The layout label of a template id, for the save dialog. */
export function baseTemplateLabel(id: TemplateId): string {
  const t = TEMPLATES[id];
  // The wall layout only matters when the template has walls (a floor-only template is not a "C-shape").
  return t.layout === "open" || !t.faces.some((f) => f.wall) ? t.label : `${t.label} (${LAYOUTS[t.layout].short})`;
}
