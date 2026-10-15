import type { RoomAnalysis } from "@/api/types";
import { Badge } from "@/components/ui/Badge";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { rowItem, scaleIn, staggerContainer } from "@/components/ui/motion";

const roomTypeLabel: Record<RoomAnalysis["roomType"], string> = {
  kitchen: "Kitchen",
  bedroom: "Bedroom",
  bathroom: "Bathroom",
  living_room: "Living Room",
  dining_room: "Dining Room",
  balcony: "Balcony",
  corridor: "Corridor",
  other: "Room",
};

const constructionLabel: Record<RoomAnalysis["constructionState"], string> = {
  unfinished: "Unfinished",
  under_construction: "Under Construction",
  finished_needs_renovation: "Finished, needs renovation",
};

const lightingLabel: Record<NonNullable<RoomAnalysis["lighting"]>, string> = {
  natural: "Natural light",
  artificial: "Artificial light",
  mixed: "Mixed lighting",
  low_light: "Low light",
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <motion.div
      variants={rowItem}
      className="min-w-0 rounded-xl border border-hairline/80 bg-white/70 px-3 py-2.5 transition-colors duration-200 hover:bg-white"
    >
      <dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-stone-900">{value}</dd>
    </motion.div>
  );
}

export function AnalysisSummary({ analysis }: { analysis: RoomAnalysis }) {
  return (
    <Card>
      <motion.div className="space-y-6 p-5" variants={staggerContainer(0.08)} initial="hidden" animate="show">
        <motion.div variants={rowItem} className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-2xl text-stone-900">{roomTypeLabel[analysis.roomType]}</h3>
            <p className="mt-1 text-sm text-stone-500">{constructionLabel[analysis.constructionState]}</p>
          </div>
          <motion.span variants={scaleIn}>
            <Badge tone={analysis.confidence >= 0.7 ? "success" : "warning"}>
              {Math.round(analysis.confidence * 100)}% confidence
            </Badge>
          </motion.span>
        </motion.div>

        <motion.dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" variants={staggerContainer(0.06)}>
          <Fact label="Floor" value={analysis.floorVisible ? analysis.floorCurrentMaterial ?? "Visible" : "Not visible"} />
          <Fact label="Walls" value={analysis.wallVisible ? analysis.wallCurrentMaterial ?? "Visible" : "Not visible"} />
          <Fact label="Lighting" value={analysis.lighting ? lightingLabel[analysis.lighting] : "Unknown"} />
          <Fact label="Doors / Windows" value={`${analysis.doorCount} / ${analysis.windowCount}`} />
        </motion.dl>

        {analysis.fixtures.length > 0 && (
          <motion.div variants={rowItem}>
            <p className="text-xs uppercase tracking-wide text-stone-500">Fixtures noticed</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {analysis.fixtures.map((f) => (
                <Badge key={f} tone="neutral">
                  {f}
                </Badge>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div variants={rowItem}>
          <p className="text-xs uppercase tracking-wide text-stone-500">Recommended for this room</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {analysis.recommendedSurfaces.length === 0 ? (
              <span className="text-sm text-stone-500">No surfaces suitable for new tile were identified.</span>
            ) : (
              analysis.recommendedSurfaces.map((s) => (
                <Badge key={s} tone="clay">
                  {s === "floor" ? "Floor tiling" : "Wall tiling"}
                </Badge>
              ))
            )}
          </div>
        </motion.div>

        {analysis.warnings.length > 0 && (
          <motion.div variants={rowItem} className="rounded-xl border border-amber-200/70 bg-amber-50 px-3 py-2.5">
            <p className="text-xs font-medium text-amber-800">Things to keep in mind</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-amber-700">
              {analysis.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </motion.div>
        )}
      </motion.div>
    </Card>
  );
}
