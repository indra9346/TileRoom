import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { PageContainer } from "@/components/layout/PageContainer";
import { TileGrid } from "@/components/tiles/TileGrid";
import { TileFilters } from "@/components/tiles/TileFilters";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { PageBanner } from "@/components/ui/PageBanner";
import { ErrorState } from "@/components/ui/ErrorState";
import { friendlyErrorMessage } from "@/api/client";
import { searchTiles, type TileSearchFilters } from "@/api/tiles";
import { useWorkflow } from "@/context/WorkflowContext";
import { useAuth } from "@/context/AuthContext";
import type { Tile } from "@/api/types";
import { Reveal, springModal } from "@/components/ui/motion";

/** Catalog-only browsing (no room context yet) — used by the top nav and the landing page's "Explore Tiles" CTA. */
export function TileCatalogPage() {
  const { selectedTile, selectTile } = useWorkflow();
  const { user, loading: authLoading } = useAuth();
  // Signed-out visitors browse the public catalog. A signed-in showroom sees its own catalog; an
  // account with no tiles of its own (a customer) falls back to the public catalog.
  const [scope, setScope] = useState<"mine" | "public">("public");
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState<TileSearchFilters>({ page: 1, pageSize: 20 });

  const pageSize = filters.pageSize ?? 20;
  const page = filters.page ?? 1;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  function goToPage(next: number) {
    setFilters((prev) => ({ ...prev, page: Math.min(Math.max(1, next), pageCount) }));
    // Bring the top of the grid back into view so the new page starts at its first row.
    document.getElementById("catalog-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const loadTiles = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    setError(null);
    try {
      let res = await searchTiles({ ...filters, scope: user ? "mine" : "public" });
      let shown: "mine" | "public" = user ? "mine" : "public";
      const filtered = Boolean(filters.q || filters.category || filters.colorFamily || filters.material || filters.finish);
      if (user && res.total === 0 && !filtered && (filters.page ?? 1) === 1) {
        res = await searchTiles({ ...filters, scope: "public" });
        shown = "public";
      }
      setScope(shown);
      setTiles(res.tiles);
      setTotal(res.total);
    } catch (err) {
      setError(friendlyErrorMessage(err, "We couldn't load the tile catalog."));
    } finally {
      setLoading(false);
    }
  }, [filters, user, authLoading]);

  useEffect(() => {
    void loadTiles();
  }, [loadTiles, reloadKey]);

  return (
    <PageContainer>
      <PageBanner
        scene="subway"
        tone="champagne"
        badge="Showroom Catalog • Verified Products"
        title="Showroom Tile Collection"
        subtitle="Explore genuine Italian marbles, porcelain slabs, handcrafted terracotta, and mosaics. Select any tile to launch an instant in-situ trial in your actual room."
        actions={
          <>
            <Link to="/upload">
              <Button size="lg" className="bg-champagne-500 hover:bg-champagne-400 text-ink font-semibold shadow-md">
                Try Tiles in Your Space →
              </Button>
            </Link>
            <Link to="/demos">
              <Button size="lg" variant="outline" className="border-hairline bg-surface-card text-ink hover:bg-white">
                Watch Live Video Demo
              </Button>
            </Link>
          </>
        }
      />

      <Reveal immediate delay={0.2} className="mt-8">
        {/* Any change to the search/filters starts again from page 1. */}
        <TileFilters filters={filters} onChange={(next) => setFilters({ ...next, page: 1 })} />
      </Reveal>

      {error ? (
        <div className="mt-6">
          <ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} />
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm text-stone-500" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={loading ? "loading" : `total-${total}`}
                className="inline-block"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                {loading ? "Loading…" : `${total} tile${total === 1 ? "" : "s"} found${scope === "public" ? " in the public catalog" : " in your showroom"}`}
              </motion.span>
            </AnimatePresence>
          </p>

          <div id="catalog-results" className="mt-4 scroll-mt-24">
            <TileGrid tiles={tiles} selectedTileId={selectedTile?.id} onSelect={selectTile} loading={loading} />
          </div>

          {!loading && pageCount > 1 && (
            <nav className="mt-8 flex animate-fade-up flex-wrap items-center justify-center gap-3" aria-label="Catalog pages">
              <Button variant="outline" size="sm" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
                ← Previous
              </Button>
              <span className="min-w-[7rem] text-center text-sm tabular-nums text-stone-600" aria-live="polite">
                Page {page} of {pageCount}
              </span>
              <Button variant="outline" size="sm" onClick={() => goToPage(page + 1)} disabled={page >= pageCount}>
                Next →
              </Button>
            </nav>
          )}
        </>
      )}

      <AnimatePresence>
        {selectedTile && (
          <motion.div
            key="selected-tile-bar"
            className="sticky bottom-4 z-20 mt-10"
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: springModal }}
            exit={{ opacity: 0, y: 30, transition: { duration: 0.2 } }}
          >
            <Card className="border-stone-900 bg-surface-card/95 shadow-xl backdrop-blur-md">
              <CardBody className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-stone-500">Selected for Trial</p>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.p
                        key={selectedTile.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="truncate font-display text-lg font-semibold text-stone-900"
                      >
                        {selectedTile.name}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>
                <Link to="/upload" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full shadow-md sm:w-auto">
                    TRY IN MY SPACE →
                  </Button>
                </Link>
              </CardBody>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </PageContainer>
  );
}
