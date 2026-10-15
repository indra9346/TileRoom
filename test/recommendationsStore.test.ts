import { createFakeTablesClient } from "./helpers/fakeTable";

/**
 * Production regression: the tile_recommendations unique index was missing, so every upsert
 * failed with 42P10 and GET /api/tiles/recommend answered 500 ("Failed to store tile
 * recommendations.") while still paying for a Gemini call each time.
 */
const base = createFakeTablesClient({});
let upsertError: { code: string; message: string } | null = null;
const client = {
  ...base,
  from(table: string) {
    const builder = base.from(table) as any;
    builder.upsert = (rows: unknown) => (upsertError ? Promise.resolve({ data: null, error: upsertError }) : builder.insert(rows));
    return builder;
  },
};
jest.mock("../server/lib/supabaseServerClient", () => ({ getSupabaseServerClient: () => client }));

import { insertRecommendations } from "../server/db/recommendations";

const recs = [
  { tileId: "t1", surface: "floor" as const, rank: 1, reason: "Warm floor" },
  { tileId: "t2", surface: "wall" as const, rank: 1, reason: "Bright wall" },
];

beforeEach(() => {
  base._reset();
  upsertError = null;
});

test("without the unique index (42P10) the analysis's rows are replaced instead of failing", async () => {
  upsertError = { code: "42P10", message: "there is no unique or exclusion constraint matching the ON CONFLICT specification" };
  base._seed("tile_recommendations", [{ id: "old", room_analysis_id: "a1", tile_id: "t9", surface: "floor", rank: 1, reason: "stale" }, { id: "other", room_analysis_id: "a2", tile_id: "t9", surface: "floor", rank: 1, reason: "keep" }]);

  await insertRecommendations("a1", recs as any);

  const rows = base._dump("tile_recommendations");
  expect(rows.filter((r) => r.room_analysis_id === "a1").map((r) => r.tile_id).sort()).toEqual(["t1", "t2"]);
  expect(rows.some((r) => r.id === "other")).toBe(true); // another analysis is untouched
});

test("any other database error still fails loudly", async () => {
  upsertError = { code: "42501", message: "permission denied" };
  await expect(insertRecommendations("a1", recs as any)).rejects.toThrow("Failed to store tile recommendations.");
});
