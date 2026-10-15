import type { TileCategory } from "@/api/types";
import type { TileSearchFilters } from "@/api/tiles";
import { Input } from "@/components/ui/Input";
import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

const categories: { value: TileCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "floor", label: "Floor" },
  { value: "wall", label: "Wall" },
  { value: "both", label: "Floor + Wall" },
];

export function TileFilters({
  filters,
  onChange,
}: {
  filters: TileSearchFilters;
  onChange: (next: TileSearchFilters) => void;
}) {
  // Unique per instance so two filter bars on screen never share one sliding pill.
  const pillId = `tile-filter-active-${useId()}`;
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {categories.map((c) => {
          const active = (filters.category ?? "all") === c.value;
          return (
            <motion.button
              key={c.value}
              type="button"
              onClick={() => onChange({ ...filters, category: c.value === "all" ? undefined : c.value, page: 1 })}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={cn(
                "relative isolate rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500",
                active ? "border-sage-800 text-white" : "border-hairline bg-surface-card/60 text-ink-secondary hover:bg-surface-sage/60 hover:text-ink",
              )}
              aria-pressed={active}
            >
              {active && (
                <motion.span
                  layoutId={pillId}
                  className="absolute -inset-px -z-10 rounded-full bg-sage-800 shadow-sm"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  aria-hidden="true"
                />
              )}
              {c.label}
            </motion.button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
        <Input
          placeholder="Material (e.g. porcelain)"
          className="sm:w-40"
          value={filters.material ?? ""}
          onChange={(e) => onChange({ ...filters, material: e.target.value || undefined, page: 1 })}
          aria-label="Filter by material"
        />
        <Input
          placeholder="Color"
          className="sm:w-32"
          value={filters.colorFamily ?? ""}
          onChange={(e) => onChange({ ...filters, colorFamily: e.target.value || undefined, page: 1 })}
          aria-label="Filter by color"
        />
        <Input
          placeholder="Search tiles"
          className="col-span-2 sm:col-span-1 sm:w-44"
          value={filters.q ?? ""}
          onChange={(e) => onChange({ ...filters, q: e.target.value || undefined, page: 1 })}
          aria-label="Search tiles by name, brand, or SKU"
        />
      </div>
    </div>
  );
}
