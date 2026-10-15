import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { listPublicVisualizations } from "@/api/visualizations";
import { searchTiles } from "@/api/tiles";
import type { Tile, Visualization } from "@/api/types";
import { BeforeAfterSlider } from "@/components/visualization/BeforeAfterSlider";
import { Reveal, revealViewport, staggerContainer, staggerItem } from "@/components/ui/motion";
import { visualizationSubtitle, visualizationTitle } from "@/lib/history";
import { PATTERNS, SURFACES } from "@/lib/designPatterns";
import { getPublicTileImageUrl } from "@/lib/tileImage";
import { formatTileSize } from "@/lib/fitRecommend";

/**
 * A visitor-facing caption that names what was actually laid, per area:
 * "Honey Oak Wood Plank herringbone floor · Nero Marquina Gold wall".
 * Falls back to the generic title for results made before designs existed.
 */
export function showcaseTitle(v: Pick<Visualization, "design" | "designTiles" | "tile" | "appliedSurfaces">): string {
  const areas = v.design?.areas ?? [];
  const byId = new Map((v.designTiles ?? []).map((t) => [t.id, t.name]));
  if (areas.length === 0 || byId.size === 0) return visualizationTitle(v);
  return areas
    .map((a) => {
      const names = a.tileIds.map((id) => byId.get(id)).filter(Boolean).join(" & ");
      const pattern = a.pattern !== "single" ? `${(PATTERNS[a.pattern]?.label ?? a.pattern).replace(/\s*\(.*\)$/, "").toLowerCase()} ` : "";
      const surface = (SURFACES[a.surface]?.label ?? a.surface).toLowerCase();
      return `${names} ${pattern}${surface}`.trim();
    })
    .join(" · ");
}

/** Drag-to-compare thumbnail for the gallery grid (the full zoomable viewer is on the result page). */
function CompareThumb({ v }: { v: Visualization }) {
  const [pos, setPos] = useState(50);
  const before = v.roomImageUrl;
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-100">
      <img src={v.resultImageUrl ?? undefined} alt={`Finished room: ${showcaseTitle(v)}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      {before && (
        <>
          <img
            src={before}
            alt="Original room before tiling"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          />
          <span className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" style={{ left: `${pos}%` }} aria-hidden="true" />
          <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">Before</span>
          <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">After</span>
          <input
            type="range"
            min={0}
            max={100}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label="Drag to compare the room before and after"
            className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
          />
        </>
      )}
    </div>
  );
}

function TileChips({ tiles }: { tiles: Tile[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {tiles.slice(0, 4).map((t) => (
        <li key={t.id} className="flex min-w-0 items-center gap-1.5 rounded-full border border-hairline bg-white px-1.5 py-0.5 pr-2.5">
          <img src={getPublicTileImageUrl(t.storagePath)} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" loading="lazy" />
          <span className="truncate text-[11px] font-medium text-stone-700">{t.name}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Home-page showcase, visible without signing in:
 *  - real finished rooms their showroom owners made public (before/after), and
 *  - tiles from the public catalog.
 * Each block hides itself when it has nothing to show, so the home page never shows an empty shell.
 */
export function PublicShowcase() {
  const [gallery, setGallery] = useState<Visualization[] | null>(null);
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [featuredError, setFeaturedError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPublicVisualizations()
      .then((list) => !cancelled && setGallery(list.filter((v) => v.resultImageUrl)))
      .catch(() => !cancelled && setGallery([]));
    searchTiles({ scope: "public", page: 1, pageSize: 8 })
      .then((res) => !cancelled && setTiles(res.tiles))
      .catch(() => !cancelled && setTiles([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const featured = gallery?.find((v) => v.roomImageUrl) ?? gallery?.[0];
  const rest = (gallery ?? []).filter((v) => v.id !== featured?.id).slice(0, 6);

  return (
    <>
      {featured && (
        <section className="container-page py-16 sm:py-20" aria-labelledby="showcase-heading">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="rounded-full border border-clay-300 bg-clay-100 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-clay-800">
              Real rooms · real tiles
            </span>
            <h2 id="showcase-heading" className="mt-3 font-display text-3xl font-bold text-stone-900 sm:text-4xl">
              Finished in TileRoom, before a single tile was laid
            </h2>
            <p className="mt-3 text-stone-600">Actual customer rooms visualized with showroom tiles. Drag the divider to compare before and after.</p>
          </Reveal>

          <Reveal className="mt-10">
            <div className="overflow-hidden rounded-2xl border border-hairline bg-surface-card shadow-soft">
              {featured.roomImageUrl && !featuredError ? (
                <BeforeAfterSlider
                  beforeSrc={featured.roomImageUrl}
                  afterSrc={featured.resultImageUrl ?? ""}
                  beforeAlt="Original room before tiling"
                  afterAlt={`Finished room: ${showcaseTitle(featured)}`}
                  onBeforeError={() => setFeaturedError(true)}
                />
              ) : (
                <img src={featured.resultImageUrl ?? undefined} alt={`Finished room: ${showcaseTitle(featured)}`} className="w-full" />
              )}
              <div className="flex flex-wrap items-end justify-between gap-3 p-4 sm:p-5">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-stone-900">{showcaseTitle(featured)}</p>
                  <p className="text-sm text-stone-500">{visualizationSubtitle(featured)}</p>
                  {featured.designTiles && featured.designTiles.length > 0 && <TileChips tiles={featured.designTiles} />}
                </div>
                <Link to={`/result/${featured.id}`} className="link-underline shrink-0 text-sm font-semibold text-clay-700">
                  Open full view →
                </Link>
              </div>
            </div>
          </Reveal>

          {rest.length > 0 && (
            <motion.ul
              className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
              variants={staggerContainer(0.08)}
              initial="hidden"
              whileInView="show"
              viewport={revealViewport}
            >
              {rest.map((v) => (
                <motion.li key={v.id} variants={staggerItem} className="min-w-0 rounded-2xl border border-hairline bg-surface-card p-3 shadow-soft">
                  <CompareThumb v={v} />
                  <div className="px-1 pb-1 pt-3">
                    <Link to={`/result/${v.id}`} className="block truncate font-display font-semibold text-stone-900 hover:text-clay-700">
                      {showcaseTitle(v)}
                    </Link>
                    <p className="truncate text-xs text-stone-500">{visualizationSubtitle(v)}</p>
                    {v.designTiles && v.designTiles.length > 0 && <TileChips tiles={v.designTiles} />}
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </section>
      )}

      {tiles && tiles.length > 0 && (
        <section className="border-y border-hairline bg-surface-limestone/60 py-16" aria-labelledby="catalog-strip-heading">
          <div className="container-page">
            <Reveal className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-xl">
                <span className="rounded-full border border-hairline bg-surface-card px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-sage-800">
                  Showroom catalog
                </span>
                <h2 id="catalog-strip-heading" className="mt-3 font-display text-3xl font-bold text-stone-900">
                  Tiles you can try in your own room
                </h2>
                <p className="mt-2 text-stone-600">Marble, stone, wood-look and handmade glazes. Browse freely, no account needed.</p>
              </div>
              <Link to="/tiles" className="link-underline text-sm font-semibold text-clay-700">
                See the full catalog →
              </Link>
            </Reveal>
            <motion.ul
              className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
              variants={staggerContainer(0.06)}
              initial="hidden"
              whileInView="show"
              viewport={revealViewport}
            >
              {tiles.map((t) => (
                <motion.li key={t.id} variants={staggerItem} className="min-w-0">
                  <Link to="/tiles" className="group block overflow-hidden rounded-xl border border-hairline bg-surface-card shadow-soft transition-shadow hover:shadow-lift">
                    <div className="aspect-square overflow-hidden bg-stone-100">
                      <img
                        src={getPublicTileImageUrl(t.storagePath)}
                        alt={`${t.name} tile`}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 ease-out-quint group-hover:scale-[1.06]"
                      />
                    </div>
                    <div className="p-3">
                      <p className="truncate font-display text-sm font-semibold text-stone-900">{t.name}</p>
                      <p className="truncate text-xs text-stone-500">{[t.finish, formatTileSize(t.sizeMm)].filter(Boolean).join(" · ")}</p>
                    </div>
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
          </div>
        </section>
      )}
    </>
  );
}
