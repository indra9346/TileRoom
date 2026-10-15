import { makeReq, makeRes } from "./helpers/fakeHttp";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const row = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  roomUploadId: `room-${id}`,
  userId: OWNER,
  tileId: "tile-1",
  status: "completed",
  appliedSurfaces: ["floor"],
  errorMessage: "internal detail",
  requirements: null,
  roomType: "living_room",
  creditsCharged: 10,
  isPublic: true,
  createdAt: "2026-10-15",
  completedAt: "2026-10-15",
  resultStoragePath: `${OWNER}/p/${id}.jpg`,
  design: { areas: [{ surface: "floor", location: "Entire floor", pattern: "border_frame", patternNote: null, tileIds: ["tile-1", "tile-2"] }] },
  ...extra,
});

jest.mock("../server/db/visualizations", () => ({
  listPublicVisualizations: async () => [row("v1"), row("v2", { resultStoragePath: null })],
}));
jest.mock("../server/db/rooms", () => ({
  verifyRoomOwnership: async (roomId: string, userId: string) => ({ id: roomId, userId, storagePath: `${userId}/p/${roomId}.jpg` }),
}));
jest.mock("../server/db/tiles", () => ({
  getTileById: async (id: string) => ({ id, name: `Tile ${id}`, ownerId: OWNER, storagePath: `${OWNER}/${id}.jpg`, category: "both", brand: null, material: null, finish: null, colorFamily: null, sizeMm: "600x600", isActive: true }),
}));
jest.mock("../server/storage/imageStorage", () => ({
  createSignedUrl: async (bucket: string, path: string) => `https://signed/${bucket}/${path}`,
}));

import handler from "../api/_routes/vizPublic";

test("public showcase: only rows with a result, with before photo and tiles, never owner data or errors", async () => {
  const res = makeRes();
  await handler(makeReq({ method: "GET", headers: {} }), res);
  expect(res.statusCode).toBe(200);
  const list = (res._json as any).visualizations;
  expect(list).toHaveLength(1);
  const v = list[0];
  expect(v.roomImageUrl).toContain("room-images/");
  expect(v.resultImageUrl).toContain("generated-visualizations/");
  expect(v.designTiles.map((t: any) => t.id)).toEqual(["tile-1", "tile-2"]);
  expect(v.errorMessage).toBeNull();
  expect(JSON.stringify(v)).not.toContain('"ownerId"');
  expect(v).not.toHaveProperty("userId");
});
