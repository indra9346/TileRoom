import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { Project, RoomUpload } from "@/api/types";
import { Card, CardBody } from "@/components/ui/Card";
import { RoomCard } from "./RoomCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { staggerContainer } from "@/components/ui/motion";

export function ProjectCard({
  project,
  rooms,
  loadingRooms,
  onDeleteProject,
  onDeleteRoom,
}: {
  project: Project;
  rooms: RoomUpload[] | undefined;
  loadingRooms: boolean;
  onDeleteProject?: (project: Project) => void;
  onDeleteRoom?: (room: RoomUpload) => void;
}) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h3 className="min-w-0 break-words font-display text-xl text-stone-900">{project.name}</h3>
          <div className="flex items-center gap-4">
            <span className="text-xs text-stone-500">Created {new Date(project.createdAt).toLocaleDateString()}</span>
            {onDeleteProject && (
              <button
                type="button"
                onClick={() => onDeleteProject(project)}
                className="rounded-lg px-2.5 py-1.5 text-sm text-stone-500 transition-[background-color,color,transform] duration-200 hover:bg-red-50 hover:text-red-700 active:scale-95"
              >
                Delete project
              </button>
            )}
          </div>
        </div>

        <div className="mt-4">
          {loadingRooms ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/3] w-full rounded-2xl" />
              ))}
            </div>
          ) : !rooms || rooms.length === 0 ? (
            <div className="animate-fade-up flex flex-col items-center gap-2 rounded-xl border border-dashed border-stone-300 bg-surface-app/60 px-4 py-5 text-center text-sm text-stone-500 sm:flex-row sm:justify-center sm:gap-4">
              <span>No rooms uploaded to this project yet.</span>
              <Link to="/upload" className="rounded-lg bg-stone-900 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-stone-800">
                Upload a room photo
              </Link>
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-2 gap-3 sm:grid-cols-4"
              variants={staggerContainer(0.06)}
              initial="hidden"
              animate="show"
            >
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} onDelete={onDeleteRoom} />
              ))}
            </motion.div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
