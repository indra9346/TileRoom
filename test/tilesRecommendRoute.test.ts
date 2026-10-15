import { makeReq, makeRes } from "./helpers/fakeHttp";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const ROOM_ID = "33333333-3333-3333-3333-333333333333";

const fakeRoom = { id: ROOM_ID, projectId: "p1", userId: USER_ID, storagePath: "x", mimeType: "image/jpeg", fileSizeBytes: 1, status: "analyzed" as const, errorMessage: null, createdAt: "2026-01-01" };
const fakeAnalysis = {
  id: "analysis-1",
  roomUploadId: ROOM_ID,
  roomType: "bathroom" as const,
  confidence: 0.9,
  constructionState: "unfinished" as const,
  floorVisible: true,
  floorCurrentMaterial: null,
  floorConditionNotes: null,
  wallVisible: true,
  wallCurrentMaterial: null,
  wallConditionNotes: null,
  recommendedSurfaces: ["floor" as const],
  doorCount: 1,
  windowCount: 1,
  fixtures: [],
  lighting: "natural" as const,
  perspective: "straight_on" as const,
  warnings: [],
  rawAiResponse: {},
  analysisModel: "gemini-2.5-flash",
  createdAt: "2026-01-01",
};

let analysisImpl: () => Promise<typeof fakeAnalysis | null> = async () => fakeAnalysis;
let hasRecommendationsImpl: () => Promise<boolean> = async () => false;
let candidateTilesImpl: () => Promise<unknown[]> = async () => [];
const recommendTilesMock = jest.fn(async () => [] as unknown[]);
const insertRecommendationsMock = jest.fn(async () => undefined);
const deleteRecommendationsMock = jest.fn(async () => undefined);
let existingRecommendations: unknown[] = [];

jest.mock("../server/lib/auth", () => ({ authenticateRequest: async () => ({ id: USER_ID, email: null }) }));
jest.mock("../server/lib/rateLimit", () => ({
  checkRateLimit: jest.fn(),
  RateLimits: { roomAnalyze: { limit: 999, windowMs: 1000 }, tileRecommend: { limit: 999, windowMs: 1000 }, visualizationGenerate: { limit: 999, windowMs: 1000 }, roomUpload: { limit: 999, windowMs: 1000 } },
}));
jest.mock("../server/db/rooms", () => ({
  verifyRoomOwnership: async (_id: string, userId: string) => {
    if (userId !== USER_ID) {
      const { Errors } = require("../server/lib/apiError");
      throw Errors.roomNotFound();
    }
    return fakeRoom;
  },
}));
jest.mock("../server/db/analyses", () => ({ getAnalysisByRoomUploadId: () => analysisImpl() }));
jest.mock("../server/db/tiles", () => ({ getCandidateTilesForSurfaces: () => candidateTilesImpl() }));
jest.mock("../server/db/recommendations", () => ({
  hasRecommendations: () => hasRecommendationsImpl(),
  getRecommendationsWithTiles: async () => existingRecommendations,
  insertRecommendations: (...args: unknown[]) => insertRecommendationsMock(...(args as [])),
  deleteRecommendations: (...args: unknown[]) => deleteRecommendationsMock(...(args as [])),
}));
jest.mock("../server/ai/recommendTiles", () => {
  const FALLBACK_REASON = "Matched by category and room-type compatibility from the catalog.";
  return {
    FALLBACK_REASON,
    isFallbackRanking: (recs: Array<{ reason: string }>) => recs.length > 0 && recs.every((r) => r.reason === FALLBACK_REASON),
    recommendTiles: (...args: unknown[]) => recommendTilesMock(...(args as [])),
  };
});
const FALLBACK = "Matched by category and room-type compatibility from the catalog.";

import handler from "../api/_routes/tilesRecommend";

function buildReq() {
  return makeReq({ method: "GET", headers: { authorization: "Bearer x" }, query: { roomUploadId: ROOM_ID } });
}

describe("GET /api/_routes/tilesRecommend", () => {
  beforeEach(() => {
    analysisImpl = async () => fakeAnalysis;
    hasRecommendationsImpl = async () => false;
    candidateTilesImpl = async () => [];
    existingRecommendations = [];
    recommendTilesMock.mockClear();
    insertRecommendationsMock.mockClear();
    deleteRecommendationsMock.mockClear();
  });

  test("a fallback (non-AI) ranking is returned but NOT stored, so the next visit retries the AI", async () => {
    candidateTilesImpl = async () => [{ id: "t1", name: "Tile 1" }];
    recommendTilesMock.mockImplementationOnce(async () => [{ tileId: "t1", surface: "floor", rank: 1, reason: FALLBACK }]);
    const res = makeRes();
    await handler(buildReq(), res);
    expect(res.statusCode).toBe(200);
    expect((res._json as any).fallback).toBe(true);
    expect((res._json as any).recommendations[0].tile.id).toBe("t1");
    expect(insertRecommendationsMock).not.toHaveBeenCalled();
  });

  test("a stored fallback ranking is recomputed and replaced by the AI ranking", async () => {
    hasRecommendationsImpl = async () => true;
    existingRecommendations = [{ tileId: "t1", surface: "floor", rank: 1, reason: FALLBACK, tile: { id: "t1" } }];
    candidateTilesImpl = async () => [{ id: "t1", name: "Tile 1" }];
    recommendTilesMock.mockImplementationOnce(async () => [{ tileId: "t1", surface: "floor", rank: 1, reason: "Warm matte floor for a sunny room." }]);
    const res = makeRes();
    await handler(buildReq(), res);
    expect(res.statusCode).toBe(201);
    expect(recommendTilesMock).toHaveBeenCalledTimes(1);
    expect(deleteRecommendationsMock).toHaveBeenCalledTimes(1);
    expect(insertRecommendationsMock).toHaveBeenCalledTimes(1);
  });

  test("CRITICAL: never silently analyzes — returns ANALYSIS_REQUIRED and never calls the AI when no analysis exists", async () => {
    analysisImpl = async () => null;

    const req = buildReq();
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect((res._json as any).error.code).toBe("ANALYSIS_REQUIRED");
    expect(recommendTilesMock).not.toHaveBeenCalled();
  });

  test("reuses existing recommendations without calling the AI again", async () => {
    hasRecommendationsImpl = async () => true;
    existingRecommendations = [{ tileId: "t1", surface: "floor", rank: 1, reason: "r", tile: {} }];

    const req = buildReq();
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res._json as any).reused).toBe(true);
    expect(recommendTilesMock).not.toHaveBeenCalled();
  });

  test("an empty tile catalog produces an empty (not fake) recommendation list", async () => {
    candidateTilesImpl = async () => [];
    recommendTilesMock.mockResolvedValueOnce([]);

    const req = buildReq();
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect((res._json as any).recommendations).toEqual([]);
  });
});
