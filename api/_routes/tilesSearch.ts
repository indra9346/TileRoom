import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHandler } from "../../server/lib/httpHandler.js";
import { authenticateRequestOptional } from "../../server/lib/auth.js";
import { parseOrThrow, tilesSearchQuerySchema } from "../../server/lib/validation.js";
import { searchTiles } from "../../server/db/tiles.js";

/**
 * Returns only real `tiles` rows — the catalog is the only product source of truth.
 *
 * Signed in (default scope): the showroom's OWN active tiles, as used by the Design Studio.
 * Signed out, or scope=public: the public catalog — active tiles their owners listed as public,
 * without the owner id. Listing a tile publicly never lets anyone else use it in a design: the
 * generate endpoint still requires the caller to own every tile.
 */
export default createHandler({ methods: ["GET"], operation: "searchTiles" }, async (req: VercelRequest, res: VercelResponse) => {
  const user = await authenticateRequestOptional(req);
  const { scope, ...filters } = parseOrThrow(tilesSearchQuerySchema, req.query);

  const publicView = !user || scope === "public";
  const { tiles, total } = publicView ? await searchTiles(filters, undefined, true) : await searchTiles(filters, user.id);
  const shaped = publicView ? tiles.map(({ ownerId: _owner, ...tile }) => tile) : tiles;

  res.setHeader("Cache-Control", publicView ? "public, max-age=60, stale-while-revalidate=300" : "private, no-store");
  res.status(200).json({ tiles: shaped, page: filters.page ?? 1, pageSize: filters.pageSize ?? 20, total, scope: publicView ? "public" : "mine" });
});
