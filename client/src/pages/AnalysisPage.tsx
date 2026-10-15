import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProgressSteps, type Step } from "@/components/ui/ProgressSteps";
import { AnalysisSummary } from "@/components/analysis/AnalysisSummary";
import { Tile, TileLabel } from "@/components/ui/Tile";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { getRoomAnalysis, analyzeRoom } from "@/api/rooms";
import { friendlyErrorMessage } from "@/api/client";
import { useWorkflow } from "@/context/WorkflowContext";
import type { RoomAnalysis } from "@/api/types";
import { EASE_IN, EASE_OUT, Reveal } from "@/components/ui/motion";

/** Cross-fades between the analysis phases (progress → summary / error). */
const phaseMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18, ease: EASE_IN } },
};

const ANALYZING_STAGES = ["Uploading room", "Preparing image", "Analyzing room", "Identifying surfaces", "Preparing recommendations"];

export function AnalysisPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { setRoom, setAnalysis: setWorkflowAnalysis } = useWorkflow();

  const [phase, setPhase] = useState<"checking" | "analyzing" | "done" | "error">("checking");
  const [analysis, setAnalysis] = useState<RoomAnalysis | null>(null);
  const [wasReused, setWasReused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!roomId) return;
    setRoom(roomId);
    let cancelled = false;

    async function run() {
      setPhase("checking");
      setError(null);
      try {
        // Never re-triggers Gemini: this is a read-only lookup of the reusable artifact.
        const existing = await getRoomAnalysis(roomId!);
        if (cancelled) return;

        if (existing) {
          setAnalysis(existing);
          setWorkflowAnalysis(existing);
          setWasReused(true);
          setPhase("done");
          return;
        }

        setPhase("analyzing");
        setActiveStageIndex(2); // "Uploading room" and "Preparing image" are already behind us at this point
        stageTimer.current = setInterval(() => {
          setActiveStageIndex((i) => Math.min(i + 1, ANALYZING_STAGES.length - 1));
        }, 1800);

        const result = await analyzeRoom(roomId!);
        if (cancelled) return;

        if (stageTimer.current) clearInterval(stageTimer.current);
        setActiveStageIndex(ANALYZING_STAGES.length - 1);
        setAnalysis(result.analysis);
        setWorkflowAnalysis(result.analysis);
        setWasReused(result.reused);
        setPhase("done");
      } catch (err) {
        if (cancelled) return;
        if (stageTimer.current) clearInterval(stageTimer.current);
        setError(friendlyErrorMessage(err, "We couldn't analyze this room. Please try again."));
        setPhase("error");
      }
    }

    run();
    return () => {
      cancelled = true;
      if (stageTimer.current) clearInterval(stageTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const steps: Step[] = ANALYZING_STAGES.map((label, i): Step => ({
    label,
    status: i < activeStageIndex ? "done" : i === activeStageIndex ? "active" : "pending",
  }));

  return (
    <PageContainer className="max-w-5xl">
      <Reveal immediate>
        <h1 className="font-display text-3xl text-stone-900">Room Analysis</h1>
      </Reveal>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={phase === "done" && wasReused ? "reused" : "fresh"}
          className="mt-2 text-stone-600"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.35, delay: 0.08 } }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
        >
          {phase === "done" && wasReused
            ? "We already have an analysis for this room, so no new AI analysis was needed."
            : "Our AI is identifying the room type, surfaces, and construction state."}
        </motion.p>
      </AnimatePresence>

      <div className="mt-8">
        <AnimatePresence mode="wait" initial={false}>
        {(phase === "checking" || phase === "analyzing") && (
          <motion.div key="progress" {...phaseMotion}>
            <Tile tone="soft" className="relative mx-auto max-w-2xl overflow-hidden p-6 sm:p-8">
              {/* Scanning light — a slow sweep across the card while the AI works. */}
              <span aria-hidden="true" className="skeleton-shimmer pointer-events-none absolute inset-0 opacity-60" />
              <div className="relative">
                <ProgressSteps steps={steps} />
              </div>
            </Tile>
          </motion.div>
        )}

        {phase === "error" && error && (
          <motion.div key="error" {...phaseMotion}>
          <ErrorState
            message={error}
            onRetry={() => {
              if (roomId) {
                setPhase("checking");
                analyzeRoom(roomId)
                  .then((result) => {
                    setAnalysis(result.analysis);
                    setWorkflowAnalysis(result.analysis);
                    setPhase("done");
                  })
                  .catch((err) => {
                    setError(friendlyErrorMessage(err, "We couldn't analyze this room. Please try again."));
                    setPhase("error");
                  });
              }
            }}
          />
          </motion.div>
        )}

        {phase === "done" && analysis && (
          <motion.div key="done" {...phaseMotion} className="grid gap-5 lg:grid-cols-[1fr_300px]">
            <div className="min-w-0">
              <AnalysisSummary analysis={analysis} />
            </div>
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.25, ease: EASE_OUT }}
              className="h-fit lg:sticky lg:top-24"
            >
            <Tile tone="feature" className="relative flex flex-col gap-4 overflow-hidden p-6">
              <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 animate-float rounded-full bg-white/10 blur-2xl" />
              <div>
                <TileLabel>Next step</TileLabel>
                <p className="mt-1 font-display text-xl font-semibold text-white">Choose tiles for each area</p>
                <p className="mt-2 text-sm text-teal-50">Pick which tile goes on which wall, floor or step, and the pattern for each.</p>
              </div>
              <Button size="lg" className="group w-full bg-white text-stone-900 hover:bg-teal-50" onClick={() => navigate(`/tiles/${roomId}`)}>
                Open Design Studio
                <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </Button>
            </Tile>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </PageContainer>
  );
}
