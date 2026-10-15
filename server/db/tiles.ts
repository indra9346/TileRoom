import { getSupabaseServerClient } from "../lib/supabaseServerClient.js";
import { Errors } from "../lib/apiError.js";
import { apiLogger } from "../lib/logger.js";
import type { RoomType, SurfaceType, TileCandidate, TileStockStatus } from "../ai/types.js";

/**
 * Strips PostgREST filter-grammar delimiter characters (`,`, `(`, `)`)
 * from a value before it is interpolated into a raw `.or(...)` filter
 * string. Supabase-js always parameterizes the underlying SQL — this is
 * not SQL injection — but PostgREST's filter mini-language treats these
 * characters as clause/group separators, so an unescaped search term
 * containing them (e.g. `q=x,category.eq.wall`) can inject additional
 * OR-ed filter clauses into the query. `.eq()`/`.ilike()` calls elsewhere
 * in this file are unaffected since they pass values as bind parameters,
 * not as part of a hand-built filter string.
 */
export function sanitizePostgrestFilterValue(value: string): string {
  return value.replace(/[,()]/g, "");
}

interface RawTileRow {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  category: TileCandidate["category"];
  material: string | null;
  finish: string | null;
  color_family: string | null;
  size_mm: string | null;
  price_per_sqft: number | null;
  currency: string;
  storage_path: string;
  suitable_rooms: RoomType[];
  is_active: boolean;
  owner_id: string | null;
  description: string | null;
  tile_type: string | null;
  pattern: string | null;
  stock_status: TileStockStatus;
  created_at: string;
  /** Present once migration 0014 has run and the query selected it. */
  is_public?: boolean;
}

export interface TileRow extends TileCandidate {
  ownerId: string | null;
  /** Listed in the public catalog. Undefined when it was not selected (or migration 0014 has not run yet). */
  isPublic?: boolean;
  currency: string;
  createdAt: string;
}

function mapRow(row: RawTileRow): TileRow {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    brand: row.brand,
    category: row.category,
    material: row.material,
    finish: row.finish,
    colorFamily: row.color_family,
    sizeMm: row.size_mm,
    pricePerSqft: row.price_per_sqft,
    currency: row.currency,
    suitableRooms: row.suitable_rooms,
    storagePath: row.storage_path,
    isActive: row.is_active,
    ownerId: row.owner_id,
    description: row.description,
    tileType: row.tile_type,
    pattern: row.pattern,
    stockStatus: row.stock_status,
    createdAt: row.created_at,
    ...(row.is_public !== undefined ? { isPublic: row.is_public } : {}),
  };
}

/** Postgres "undefined column": the database has not run the migration that adds a column yet. */
const isMissingColumn = (error: { code?: string } | null | undefined) => error?.code === "42703";

export const PUBLIC_CATALOG_NOT_READY =
  "The public catalog isn't set up in the database yet. Run supabase/migrations/0014_public_catalog.sql in Supabase, then try again.";

const SELECT_COLUMNS =
  "id, sku, name, brand, category, material, finish, color_family, size_mm, price_per_sqft, currency, storage_path, suitable_rooms, is_active, owner_id, description, tile_type, pattern, stock_status, created_at";

export interface TileSearchFilters {
  category?: TileCandidate["category"];
  roomType?: RoomType;
  colorFamily?: string;
  material?: string;
  finish?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function searchTiles(filters: TileSearchFilters, ownerId?: string, publicOnly = false): Promise<{ tiles: TileRow[]; total: number }> {
  const supabase = getSupabaseServerClient();
  let query = supabase.from("tiles").select(SELECT_COLUMNS, { count: "exact" }).eq("is_active", true);
  if (ownerId) query = query.eq("owner_id", ownerId);
  // Public catalog: only tiles a showroom chose to list (never ownerless seed rows).
  if (publicOnly) query = query.eq("is_public", true).not("owner_id", "is", null);

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.roomType) query = query.contains("suitable_rooms", [filters.roomType]);
  if (filters.colorFamily) query = query.ilike("color_family", `%${filters.colorFamily}%`);
  if (filters.material) query = query.ilike("material", `%${filters.material}%`);
  if (filters.finish) query = query.ilike("finish", `%${filters.finish}%`);
  if (filters.q) {
    const safeQ = sanitizePostgrestFilterValue(filters.q);
    query = query.or(`name.ilike.%${safeQ}%,brand.ilike.%${safeQ}%,sku.ilike.%${safeQ}%`);
  }

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  // Before migration 0014 there is no public catalog yet: show an empty one instead of failing.
  if (publicOnly && isMissingColumn(error)) return { tiles: [], total: 0 };

  if (error) {
    apiLogger.error("searchTiles failed", { operation: "searchTiles", errorCategory: error.code });
    throw Errors.internal("Failed to search tiles.");
  }

  return { tiles: (data ?? []).map(mapRow), total: count ?? 0 };
}

/** Candidate set for recommendTiles(): active tiles whose category matches one of the requested surfaces. */
export async function getCandidateTilesForSurfaces(surfaces: SurfaceType[], ownerId?: string): Promise<TileRow[]> {
  const supabase = getSupabaseServerClient();
  const categories = [...surfaces, "both"];
  let query = supabase.from("tiles").select(SELECT_COLUMNS).eq("is_active", true).in("category", categories);
  if (ownerId) query = query.eq("owner_id", ownerId);
  const { data, error } = await query;

  if (error) {
    apiLogger.error("getCandidateTilesForSurfaces failed", { operation: "getCandidateTilesForSurfaces", errorCategory: error.code });
    throw Errors.internal("Failed to load tile catalog.");
  }

  return (data ?? []).map(mapRow);
}

/**
 * Loads a tile by id regardless of active status. Callers that need to
 * distinguish "doesn't exist" (404) from "exists but inactive" (409) —
 * e.g. POST /api/visualizations/generate — must use this rather than
 * filtering is_active in the query, which collapses both cases into null.
 */
export async function getTileById(tileId: string): Promise<TileRow | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("tiles").select(SELECT_COLUMNS).eq("id", tileId).maybeSingle();

  if (error) {
    apiLogger.error("getTileById failed", { operation: "getTileById", errorCategory: error.code });
    throw Errors.internal("Failed to load tile.");
  }

  return data ? mapRow(data) : null;
}

/** Use only where an inactive tile should be indistinguishable from a nonexistent one (e.g. recommendation candidate lookups). */
export async function getActiveTileById(tileId: string): Promise<TileRow | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("tiles").select(SELECT_COLUMNS).eq("id", tileId).eq("is_active", true).maybeSingle();

  if (error) {
    apiLogger.error("getActiveTileById failed", { operation: "getActiveTileById", errorCategory: error.code });
    throw Errors.internal("Failed to load tile.");
  }

  return data ? mapRow(data) : null;
}

export interface NewTileInput {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  category: TileCandidate["category"];
  material: string | null;
  finish: string | null;
  colorFamily: string | null;
  sizeMm: string | null;
  pricePerSqft: number | null;
  currency: string;
  suitableRooms: RoomType[];
  storagePath: string;
  description: string | null;
  tileType: string | null;
  pattern: string | null;
  stockStatus: TileStockStatus;
}

/** All tiles owned by this showroom, including deactivated ones (for the management screen). */
export async function listOwnedTiles(ownerId: string): Promise<TileRow[]> {
  const supabase = getSupabaseServerClient();
  const run = (columns: string) => supabase.from("tiles").select(columns).eq("owner_id", ownerId).order("created_at", { ascending: false });
  // The owner screen shows each tile's public switch; fall back to the base columns before migration 0014.
  let { data, error } = await run(`${SELECT_COLUMNS}, is_public`);
  if (isMissingColumn(error)) ({ data, error } = await run(SELECT_COLUMNS));
  if (error) {
    apiLogger.error("listOwnedTiles failed", { operation: "listOwnedTiles", errorCategory: error.code });
    throw Errors.internal("Failed to load your tiles.");
  }
  return ((data ?? []) as unknown as RawTileRow[]).map(mapRow);
}

/** Owner-scoped: list or unlist one tile in the public catalog. */
export async function setOwnedTilePublic(ownerId: string, tileId: string, isPublic: boolean): Promise<TileRow | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tiles")
    .update({ is_public: isPublic })
    .eq("id", tileId)
    .eq("owner_id", ownerId)
    .select(`${SELECT_COLUMNS}, is_public`)
    .maybeSingle();
  if (isMissingColumn(error)) throw Errors.validation(PUBLIC_CATALOG_NOT_READY);
  if (error) {
    apiLogger.error("setOwnedTilePublic failed", { operation: "setOwnedTilePublic", errorCategory: error.code });
    throw Errors.internal("Failed to update the tile.");
  }
  return data ? mapRow(data as unknown as RawTileRow) : null;
}

export async function createTile(ownerId: string, input: NewTileInput): Promise<TileRow> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tiles")
    .insert({
      id: input.id,
      owner_id: ownerId,
      sku: input.sku,
      name: input.name,
      brand: input.brand,
      category: input.category,
      material: input.material,
      finish: input.finish,
      color_family: input.colorFamily,
      size_mm: input.sizeMm,
      price_per_sqft: input.pricePerSqft,
      currency: input.currency,
      suitable_rooms: input.suitableRooms,
      storage_path: input.storagePath,
      description: input.description,
      tile_type: input.tileType,
      pattern: input.pattern,
      stock_status: input.stockStatus,
      is_active: true,
    })
    .select(SELECT_COLUMNS)
    .single();
  if (error || !data) {
    if (error?.code === "23505") throw Errors.validation("You already have a tile with this SKU. Use a different SKU.");
    apiLogger.error("createTile failed", { operation: "createTile", errorCategory: error?.code });
    throw Errors.internal("Failed to save the tile.");
  }
  return mapRow(data);
}

/** Owner-scoped: the owner_id filter guarantees a showroom can only change its own tiles. */
export async function setOwnedTileActive(ownerId: string, tileId: string, isActive: boolean): Promise<TileRow | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tiles")
    .update({ is_active: isActive })
    .eq("id", tileId)
    .eq("owner_id", ownerId)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) {
    apiLogger.error("setOwnedTileActive failed", { operation: "setOwnedTileActive", errorCategory: error.code });
    throw Errors.internal("Failed to update the tile.");
  }
  return data ? mapRow(data) : null;
}

export interface TilePatch {
  name?: string;
  sku?: string;
  brand?: string | null;
  category?: TileCandidate["category"];
  material?: string | null;
  finish?: string | null;
  colorFamily?: string | null;
  sizeMm?: string | null;
  description?: string | null;
  tileType?: string | null;
  pattern?: string | null;
  stockStatus?: TileStockStatus;
  pricePerSqft?: number | null;
  currency?: string;
  suitableRooms?: RoomType[];
  isActive?: boolean;
  storagePath?: string;
}

/** Loads one tile by id, only if the caller owns it (another showroom's tile is reported as absent). */
export async function getOwnedTile(ownerId: string, tileId: string): Promise<TileRow | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("tiles").select(SELECT_COLUMNS).eq("id", tileId).eq("owner_id", ownerId).maybeSingle();
  if (error) {
    apiLogger.error("getOwnedTile failed", { operation: "getOwnedTile", errorCategory: error.code });
    throw Errors.internal("Failed to load the tile.");
  }
  return data ? mapRow(data) : null;
}

/** Owner-scoped edit: only the fields present in `patch` change; the owner_id filter makes cross-showroom edits impossible. */
export async function updateOwnedTile(ownerId: string, tileId: string, patch: TilePatch): Promise<TileRow | null> {
  const columns: Record<string, unknown> = {};
  const map: Array<[keyof TilePatch, string]> = [
    ["name", "name"], ["sku", "sku"], ["brand", "brand"], ["category", "category"], ["material", "material"], ["finish", "finish"],
    ["colorFamily", "color_family"], ["sizeMm", "size_mm"], ["description", "description"], ["tileType", "tile_type"], ["pattern", "pattern"],
    ["stockStatus", "stock_status"], ["pricePerSqft", "price_per_sqft"], ["currency", "currency"], ["suitableRooms", "suitable_rooms"],
    ["isActive", "is_active"], ["storagePath", "storage_path"],
  ];
  for (const [key, column] of map) if (patch[key] !== undefined) columns[column] = patch[key];
  if (Object.keys(columns).length === 0) return getOwnedTile(ownerId, tileId);

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("tiles").update(columns).eq("id", tileId).eq("owner_id", ownerId).select(SELECT_COLUMNS).maybeSingle();
  if (error) {
    if (error.code === "23505") throw Errors.validation("You already have a tile with this SKU. Use a different SKU.");
    apiLogger.error("updateOwnedTile failed", { operation: "updateOwnedTile", errorCategory: error.code });
    throw Errors.internal("Failed to update the tile.");
  }
  return data ? mapRow(data) : null;
}

/**
 * Owner-scoped delete. Refused (409 TILE_IN_USE) if any visualization or saved
 * recommendation references the tile — the database also enforces this with
 * ON DELETE RESTRICT — so history is never orphaned. Returns the removed row
 * (for storage cleanup) or null if it was not found / not owned.
 */
export async function deleteOwnedTile(ownerId: string, tileId: string): Promise<TileRow | null> {
  const existing = await getOwnedTile(ownerId, tileId);
  if (!existing) return null;

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("tiles").delete().eq("id", tileId).eq("owner_id", ownerId);
  if (error) {
    if (error.code === "23503") throw Errors.tileInUse(); // foreign_key_violation from ON DELETE RESTRICT
    apiLogger.error("deleteOwnedTile failed", { operation: "deleteOwnedTile", errorCategory: error.code });
    throw Errors.internal("Failed to delete the tile.");
  }
  return existing;
}
