import { createContext, useContext, useCallback, useMemo, useState, type ReactNode } from "react";
import type { RoomAnalysis, SurfaceType, Tile } from "@/api/types";

/**
 * Holds only IDs and already-fetched, non-sensitive data (never signed
 * URLs) so the room analysis stays a reusable artifact across the whole
 * "select another tile" loop without ever re-triggering POST /analyze.
 * Persisted to localStorage as plain UUIDs/analysis fields only — no
 * secrets, no signed URLs, nothing that expires.
 */
interface WorkflowState {
  projectId: string | null;
  roomUploadId: string | null;
  analysis: RoomAnalysis | null;
  selectedTile: Tile | null;
  selectedSurfaces: SurfaceType[];
}

interface WorkflowContextValue extends WorkflowState {
  setProject: (projectId: string) => void;
  setRoom: (roomUploadId: string) => void;
  setAnalysis: (analysis: RoomAnalysis) => void;
  selectTile: (tile: Tile) => void;
  setSurfaces: (surfaces: SurfaceType[]) => void;
  reset: () => void;
}

const STORAGE_KEY = "tile-visualizer:workflow";

function loadInitial(): WorkflowState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as WorkflowState;
    return {
      projectId: parsed.projectId ?? null,
      roomUploadId: parsed.roomUploadId ?? null,
      analysis: parsed.analysis ?? null,
      selectedTile: parsed.selectedTile ?? null,
      selectedSurfaces: parsed.selectedSurfaces ?? [],
    };
  } catch {
    return { projectId: null, roomUploadId: null, analysis: null, selectedTile: null, selectedSurfaces: [] };
  }
}

const WorkflowContext = createContext<WorkflowContextValue | undefined>(undefined);

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkflowState>(loadInitial);

  // Always derived from the LATEST state (functional update), so two setters called back to back
  // (e.g. setProject then setRoom) both land instead of the second overwriting the first.
  const update = useCallback((change: (prev: WorkflowState) => WorkflowState) => {
    setState((prev) => {
      const next = change(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // best-effort only — the app still works from in-memory state if storage is unavailable
      }
      return next;
    });
  }, []);

  const setProject = useCallback((projectId: string) => update((s) => ({ ...s, projectId })), [update]);
  // A new room drops the previous room's analysis, but keeps a tile picked in the catalog ("Try in my space").
  const setRoom = useCallback(
    (roomUploadId: string) => update((s) => (s.roomUploadId === roomUploadId ? s : { ...s, roomUploadId, analysis: null })),
    [update],
  );
  // An analysis always belongs to its own room.
  const setAnalysis = useCallback((analysis: RoomAnalysis) => update((s) => ({ ...s, roomUploadId: analysis.roomUploadId, analysis })), [update]);
  const selectTile = useCallback(
    (tile: Tile) => {
      const defaultSurfaces: SurfaceType[] = tile.category === "both" ? ["floor", "wall"] : [tile.category];
      update((s) => ({ ...s, selectedTile: tile, selectedSurfaces: defaultSurfaces }));
    },
    [update],
  );
  const setSurfaces = useCallback((selectedSurfaces: SurfaceType[]) => update((s) => ({ ...s, selectedSurfaces })), [update]);
  const reset = useCallback(() => {
    update(() => ({ projectId: null, roomUploadId: null, analysis: null, selectedTile: null, selectedSurfaces: [] }));
  }, [update]);

  const value = useMemo(
    () => ({ ...state, setProject, setRoom, setAnalysis, selectTile, setSurfaces, reset }),
    [state, setProject, setRoom, setAnalysis, selectTile, setSurfaces, reset],
  );

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}

export function useWorkflow(): WorkflowContextValue {
  const ctx = useContext(WorkflowContext);
  if (!ctx) throw new Error("useWorkflow must be used within WorkflowProvider");
  return ctx;
}
