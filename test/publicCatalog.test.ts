import { createFakeTablesClient } from "./helpers/fakeTable";
import { makeReq, makeRes } from "./helpers/fakeHttp";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let currentUser: string | null = A;

const client = createFakeTablesClient({});
jest.mock("../server/lib/supabaseServerClient", () => ({ getSupabaseServerClient: () => client }));
jest.mock("../server/lib/auth", () => ({
  authenticateRequest: async () => {
    if (!currentUser) throw Object.assign(new Error("no auth"), { name: "ApiError", code: "UNAUTHENTICATED", status: 401 });
    return { id: currentUser, email: null };
  },
  authenticateRequestOptional: async () => (currentUser ? { id: currentUser, email: null } : null),
}));
jest.mock("../server/lib/rateLimit", () => ({ checkRateLimit: jest.fn(), RateLimits: {} }));

import searchHandler from "../api/_routes/tilesSearch";
import manageHandler from "../api/_routes/tilesManage";

const tile = (id: string, owner: string | null, extra: Record<string, unknown> = {}) => ({
  id,
  sku: id,
  name: `Tile ${id}`,
  brand: null,
  category: "both",
  material: null,
  finish: null,
  color_family: null,
  size_mm: "600x600",
  price_per_sqft: null,
  currency: "INR",
  storage_path: `${owner}/${id}.jpg`,
  suitable_rooms: [],
  is_active: true,
  owner_id: owner,
  description: null,
  tile_type: null,
  pattern: null,
  stock_status: "in_stock",
  created_at: "2026-10-15T00:00:00Z",
  is_public: false,
  ...extra,
});

async function search(query: Record<string, unknown> = {}) {
  const res = makeRes();
  await searchHandler(makeReq({ method: "GET", headers: currentUser ? { authorization: "Bearer x" } : {}, query }), res);
  return { status: res.statusCode as number, json: res._json as any };
}

beforeEach(() => {
  client._reset();
  client._seed("tiles", [
    tile("a-public", A, { is_public: true }),
    tile("a-private", A),
    tile("a-public-hidden", A, { is_public: true, is_active: false }),
    tile("b-public", B, { is_public: true }),
    tile("seed-ownerless", null, { is_public: true }),
  ]);
  currentUser = A;
});

describe("public tile catalog", () => {
  test("signed out: only active, public, owned tiles, without the owner id", async () => {
    currentUser = null;
    const { status, json } = await search();
    expect(status).toBe(200);
    expect(json.scope).toBe("public");
    expect(json.tiles.map((t: any) => t.id).sort()).toEqual(["a-public", "b-public"]);
    expect(json.tiles.every((t: any) => !("ownerId" in t))).toBe(true);
  });

  test("signed in: the showroom's own active tiles (public and private), as the Design Studio needs", async () => {
    const { json } = await search();
    expect(json.scope).toBe("mine");
    expect(json.tiles.map((t: any) => t.id).sort()).toEqual(["a-private", "a-public"]);
  });

  test("signed in with scope=public sees the public catalog", async () => {
    currentUser = B;
    const { json } = await search({ scope: "public" });
    expect(json.tiles.map((t: any) => t.id).sort()).toEqual(["a-public", "b-public"]);
  });

  test("an owner can list and unlist only their own tile", async () => {
    const patch = async (body: unknown) => {
      const res = makeRes();
      await manageHandler(makeReq({ method: "PATCH", headers: { authorization: "Bearer x" }, body }), res);
      return { status: res.statusCode as number, json: res._json as any };
    };
    const listed = await patch({ tileId: "00000000-0000-4000-8000-000000000001", isPublic: true });
    expect(listed.status).toBe(404);

    client._seed("tiles", [tile("00000000-0000-4000-8000-000000000002", A)]);
    const ok = await patch({ tileId: "00000000-0000-4000-8000-000000000002", isPublic: true });
    expect(ok.status).toBe(200);
    expect(ok.json.tile.isPublic).toBe(true);

    currentUser = B;
    expect((await patch({ tileId: "00000000-0000-4000-8000-000000000002", isPublic: false })).status).toBe(404);
    expect((await patch({ tileId: "00000000-0000-4000-8000-000000000002" })).status).toBe(400);
  });
});
