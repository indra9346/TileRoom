import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { RoomUpload } from "@/api/types";
import { Badge } from "@/components/ui/Badge";
import { hoverLift, staggerItem } from "@/components/ui/motion";

const statusTone: Record<RoomUpload["status"], "neutral" | "clay" | "success" | "warning" | "danger"> = {
  uploaded: "neutral",
  analyzing: "clay",
  analyzed: "success",
  failed: "danger",
};

const statusLabel: Record<RoomUpload["status"], string> = {
  uploaded: "Uploaded",
  analyzing: "Analyzing…",
  analyzed: "Analyzed",
  failed: "Analysis failed",
};

/** One room photo. Uses `staggerItem` variants so a parent grid can lay rooms in one after another. */
export function RoomCard({ room, onDelete }: { room: RoomUpload; onDelete?: (room: RoomUpload) => void }) {
  const href = room.status === "analyzed" ? `/tiles/${room.id}` : `/analysis/${room.id}`;

  return (
    <motion.div variants={staggerItem} {...hoverLift} className="group relative min-w-0">
      <Link
        to={href}
        className="block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
        aria-label={`Open room photo from ${new Date(room.createdAt).toLocaleDateString()}`}
      >
        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface-card shadow-soft transition-[box-shadow,border-color] duration-300 group-hover:border-sage-400/70 group-hover:shadow-lift">
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
            {room.imageUrl ? (
              <img
                src={room.imageUrl}
                alt="Uploaded room"
                className="h-full w-full object-cover transition-transform duration-700 ease-out-quint group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-stone-400">No preview</div>
            )}
            {room.status === "analyzing" && (
              <span aria-hidden="true" className="skeleton-shimmer absolute inset-0" />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 sm:p-4">
            <span className="text-xs text-stone-500 sm:text-sm">{new Date(room.createdAt).toLocaleDateString()}</span>
            <Badge tone={statusTone[room.status]}>{statusLabel[room.status]}</Badge>
          </div>
        </div>
      </Link>
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(room)}
          aria-label="Delete this room photo"
          title="Delete this room photo"
          className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-red-700 shadow backdrop-blur-sm transition-[opacity,background-color,color,transform] duration-200 hover:bg-red-700 hover:text-white focus-visible:opacity-100 active:scale-95 sm:opacity-0 sm:group-hover:opacity-100"
        >
          Delete
        </button>
      )}
    </motion.div>
  );
}
