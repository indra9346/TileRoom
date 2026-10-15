import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PageContainer } from "@/components/layout/PageContainer";
import { VisualizationHistory } from "@/components/history/VisualizationHistory";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { friendlyErrorMessage } from "@/api/client";
import { listPublicVisualizations } from "@/api/visualizations";
import { getPublicTileImageUrl } from "@/lib/tileImage";
import { visualizationSubtitle, visualizationTitle } from "@/lib/history";
import { useAuth } from "@/context/AuthContext";
import type { Visualization } from "@/api/types";
import { Reveal, hoverLift, staggerContainer, staggerItem } from "@/components/ui/motion";

/**
 * Signed in: a chat-style history of the caller's own designs (see VisualizationHistory).
 * Signed out: the public feed, which only ever contains designs their owners chose to make public
 * (GET /api/visualizations/public). Never demo data; see the privacy model in migration 0011.
 */
export function MyVisualizationsPage() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <PageContainer className="max-w-6xl">
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-stone-300 border-t-sage-700" aria-label="Loading" />
        </div>
      </PageContainer>
    );
  }

  if (user) {
    return (
      <PageContainer className="max-w-7xl" compact>
        <VisualizationHistory />
      </PageContainer>
    );
  }
  return <PublicFeed />;
}

function PublicFeed() {
  const [items, setItems] = useState<Visualization[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPublicVisualizations()
      .then(setItems)
      .catch((err) => setError(friendlyErrorMessage(err, "We couldn't load visualizations.")));
  }, []);

  if (error) {
    return (
      <PageContainer className="max-w-6xl">
        <ErrorState message={error} />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-6xl">
      <Reveal immediate>
        <h1 className="font-display text-3xl text-stone-900">Designs</h1>
      </Reveal>
      <Reveal immediate delay={0.08}>
        <p className="mt-2 text-stone-600">Real visualizations generated on TileRoom that their owners have chosen to make public.</p>
        <p className="mt-1 text-sm text-stone-500">
          <Link
            to="/login"
            state={{ from: { pathname: "/my-visualizations" } }}
            className="font-medium text-stone-900 underline decoration-champagne-500 underline-offset-4 transition-colors hover:text-sage-700"
          >
            Sign in
          </Link>{" "}
          to see your own design history.
        </p>
      </Reveal>

      <div className="mt-8">
        {items === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-hairline bg-surface-card shadow-soft" aria-hidden="true">
                <Skeleton className="aspect-[4/3] rounded-none" />
                <div className="space-y-2 p-5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No public designs yet"
            description="No one has made a design public yet. Sign in and try one yourself."
            action={
              <Link to="/login" className="text-sm font-medium text-stone-900 underline decoration-champagne-500 underline-offset-4 transition-colors hover:text-sage-700">
                Sign in
              </Link>
            }
          />
        ) : (
          <motion.div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" variants={staggerContainer(0.07)} initial="hidden" animate="show">
            {items.map((v) => (
              <motion.div key={v.id} variants={staggerItem} {...hoverLift} className="group min-w-0">
              <Card className="h-full overflow-hidden group-hover:border-sage-400/70 group-hover:shadow-lift">
                <div className="aspect-[4/3] overflow-hidden bg-stone-100">
                  {v.resultImageUrl ? (
                    <img
                      src={v.resultImageUrl}
                      alt="Generated visualization"
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 ease-out-quint group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-stone-400">Not ready yet</div>
                  )}
                </div>
                <CardBody>
                  <div className="flex min-w-0 items-center gap-2">
                    {v.tile && <img src={getPublicTileImageUrl(v.tile.storagePath)} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-hairline" />}
                    <p className="truncate text-sm font-medium text-stone-900">{visualizationTitle(v)}</p>
                  </div>
                  <div className="mt-2">
                    <Badge tone="clay">{visualizationSubtitle(v) || "Design"}</Badge>
                  </div>
                  <p className="mt-3 text-xs text-stone-500">{new Date(v.createdAt).toLocaleDateString()}</p>
                  <Link
                    to={`/result/${v.id}`}
                    className="group/link mt-3 inline-flex items-center gap-1 text-sm font-medium text-stone-900 underline decoration-champagne-500 underline-offset-4 transition-colors hover:text-sage-700"
                  >
                    View result
                    <span aria-hidden="true" className="transition-transform duration-200 group-hover/link:translate-x-0.5">→</span>
                  </Link>
                </CardBody>
              </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </PageContainer>
  );
}
