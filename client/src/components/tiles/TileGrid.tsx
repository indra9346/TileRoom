import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { Tile } from "@/api/types";
import { TileCard } from "./TileCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { staggerContainer } from "@/components/ui/motion";

/** Cards fade/lift in one after another — like tiles being laid across the grid. */
const gridVariants = staggerContainer(0.045);

export function TileGrid({
  tiles,
  reasons,
  selectedTileId,
  onSelect,
  loading,
  emptyTitle = "No tiles are available yet.",
  emptyDescription = "Your catalog doesn't have any tiles yet.",
  showAddTileCta = true,
}: {
  tiles: Tile[];
  reasons?: Record<string, string>;
  selectedTileId?: string | null;
  onSelect: (tile: Tile) => void;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Shows a link to My Tiles in the empty state — set false where a catalog-with-tiles empty state (e.g. a filter) is more accurate. */
  showAddTileCta?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft" aria-hidden="true">
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tiles.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={
          showAddTileCta ? (
            <Link to="/my-tiles" className="text-sm font-medium text-stone-900 underline decoration-champagne-500 underline-offset-4 transition-colors hover:text-sage-700">
              Add a tile in My Tiles
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <motion.div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      variants={gridVariants}
      initial="hidden"
      animate="show"
    >
      {tiles.map((tile) => (
        <TileCard
          key={tile.id}
          tile={tile}
          reason={reasons?.[tile.id]}
          selected={tile.id === selectedTileId}
          onSelect={onSelect}
        />
      ))}
    </motion.div>
  );
}
