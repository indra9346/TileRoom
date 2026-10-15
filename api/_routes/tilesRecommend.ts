import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHandler } from "../../server/lib/httpHandler.js";
import { authenticateRequest } from "../../server/lib/auth.js";
import { parseOrThrow, tilesRecommendQuerySchema } from "../../server/lib/validation.js";
import { checkRateLimit, RateLimits } from "../../server/lib/rateLimit.js";
import { verifyRoomOwnership } from "../../server/db/rooms.js";
import { getAnalysisByRoomUploadId } from "../../server/db/analyses.js";
import { getCandidateTilesForSurfaces } from "../../server/db/tiles.js";
import { hasRecommendations, getRecommendationsWithTiles, insertRecommendations, deleteRecommendations } from "../../server/db/recommendations.js";
import { isFallbackRanking, recommendTiles } from "../../server/ai/recommendTiles.js";
import { Errors } from "../../server/lib/apiError.js";

/**
 * CRITICAL: does NOT call analyzeRoom(). If no analysis exists yet, this
 * fails explicitly (409 ANALYSIS_REQUIRED) rather than silently
 * triggering one — the workflow stays explicit and analysis stays a
 * reusable, single-computed artifact.
 *
 * Also avoids redundant Gemini calls: if recommendations already exist
 * for this room's analysis, they are returned directly.
 */
export default createHandler({ methods: ["GET"], operation: "recommendTilesEndpoint" }, async (req: VercelRequest, res: VercelResponse) => {
  const user = await authenticateRequest(req);
  const { roomUploadId } = parseOrThrow(tilesRecommendQuerySchema, req.query);

  const room = await verifyRoomOwnership(roomUploadId, user.id);
  const analysis = await getAnalysisByRoomUploadId(room.id);

  if (!analysis) {
    throw Errors.analysisRequired();
  }

  // A stored AI ranking is reused. A stored FALLBACK ranking (saved before fallbacks stopped being
  // persisted) is not: it is recomputed so the room can still get real AI reasons.
  const existing = (await hasRecommendations(analysis.id)) ? await getRecommendationsWithTiles(analysis.id) : [];
  if (existing.length > 0 && !isFallbackRanking(existing)) {
    res.status(200).json({ recommendations: existing, reused: true });
    return;
  }

  checkRateLimit(`tileRecommend:${user.id}`, RateLimits.tileRecommend.limit, RateLimits.tileRecommend.windowMs);

  const candidateTiles = await getCandidateTilesForSurfaces(analysis.recommendedSurfaces, user.id);
  const recommendations = await recommendTiles(analysis, candidateTiles);

  // The AI was unavailable: answer with the fallback ranking but do not store it, so the next
  // visit tries the AI again instead of reusing a generic list forever.
  if (isFallbackRanking(recommendations)) {
    const byId = new Map(candidateTiles.map((t) => [t.id, t]));
    const transient = recommendations.map((r) => ({ ...r, tile: byId.get(r.tileId) })).filter((r) => r.tile);
    res.status(200).json({ recommendations: transient, reused: false, fallback: true });
    return;
  }

  if (existing.length > 0) await deleteRecommendations(analysis.id);
  await insertRecommendations(analysis.id, recommendations);
  const withTiles = await getRecommendationsWithTiles(analysis.id);

  res.status(201).json({ recommendations: withTiles, reused: false });
});
