import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHandler } from "../../server/lib/httpHandler.js";
import { listPublicVisualizations } from "../../server/db/visualizations.js";
import { verifyRoomOwnership } from "../../server/db/rooms.js";
import { getTileById } from "../../server/db/tiles.js";
import { createSignedUrl } from "../../server/storage/imageStorage.js";
import { BUCKETS } from "../../server/storage/buckets.js";

/** Only what a public viewer needs to read the card; never the owner id. */
function publicTile(tile: Awaited<ReturnType<typeof getTileById>>) {
  if (!tile) return null;
  const { id, name, brand, category, material, finish, colorFamily, sizeMm, isActive, storagePath } = tile;
  return { id, name, brand, category, material, finish, colorFamily, sizeMm, isActive, storagePath };
}

/**
 * Public showcase feed (home page + "My Visualizations" signed-out view): real,
 * database-backed, COMPLETED visualizations their owner explicitly marked public
 * (see migration 0011 and setVisualizationVisibility). No authentication required,
 * and NEVER includes a private row — listPublicVisualizations() filters
 * is_public = true and status = completed at the query itself.
 *
 * Making a visualization public publishes its before/after comparison, so the
 * original room photo is included for these rows only. Every URL is signed with
 * the row's OWN owner id, since createSignedUrl requires proof the path belongs
 * to the id it is given.
 */
export default createHandler({ methods: ["GET"], operation: "listPublicVisualizations" }, async (_req: VercelRequest, res: VercelResponse) => {
  const rows = await listPublicVisualizations(24);

  const withDetails = await Promise.all(
    rows.map(async (v) => {
      const designTileIds = [...new Set(v.design?.areas.flatMap((a) => a.tileIds) ?? [v.tileId])];
      const [resultImageUrl, room, tiles] = await Promise.all([
        v.resultStoragePath ? createSignedUrl(BUCKETS.generatedVisualizations, v.resultStoragePath, v.userId) : Promise.resolve(null),
        verifyRoomOwnership(v.roomUploadId, v.userId).catch(() => null),
        Promise.all(designTileIds.map((id) => getTileById(id).catch(() => null))),
      ]);
      const roomImageUrl =
        room ? await createSignedUrl(BUCKETS.roomImages, room.storagePath, v.userId).catch(() => null) : null;
      const designTiles = tiles.map(publicTile).filter((t): t is NonNullable<ReturnType<typeof publicTile>> => t !== null);
      return {
        id: v.id,
        roomUploadId: v.roomUploadId,
        status: v.status,
        appliedSurfaces: v.appliedSurfaces,
        errorMessage: null,
        requirements: v.requirements,
        roomType: v.roomType,
        creditsCharged: v.creditsCharged,
        isPublic: true,
        createdAt: v.createdAt,
        completedAt: v.completedAt,
        resultImageUrl,
        roomImageUrl,
        tile: designTiles.find((t) => t.id === v.tileId) ?? publicTile(await getTileById(v.tileId)),
        design: v.design ?? null,
        designTiles,
      };
    }),
  );

  // Short shared cache: the showcase changes rarely, and signed URLs stay valid far longer than this.
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.status(200).json({ visualizations: withDetails.filter((v) => v.resultImageUrl) });
});
