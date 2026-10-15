import sharp from "sharp";
import { STALE_GENERATION_MS, isJobStale } from "../server/db/generationJobs";
import { alignToSource, closestAspectRatio } from "../server/ai/generateVisualization";
import { buildDesignPrompt, parseTileSizeMm } from "../server/ai/prompts/visualizationPrompt";
import type { DesignAreaInput, RoomAnalysis, TileCandidate } from "../server/ai/types";

describe("closestAspectRatio", () => {
  it.each([
    [4000, 3000, "4:3"],
    [3000, 4000, "3:4"],
    [1920, 1080, "16:9"],
    [1080, 1920, "9:16"],
    [1000, 1000, "1:1"],
    [3000, 2000, "3:2"],
    [2520, 1080, "21:9"],
    [0, 100, "1:1"],
  ])("%i x %i -> %s", (w, h, expected) => {
    expect(closestAspectRatio(w, h)).toBe(expected);
  });
});

describe("parseTileSizeMm", () => {
  it.each([
    ["600x600", { w: 600, h: 600 }],
    ["600 x 1200 mm", { w: 600, h: 1200 }],
    ["60x120 cm", { w: 600, h: 1200 }],
    ["2x4 ft", { w: 610, h: 1219 }],
    ["12 x 24 in", { w: 305, h: 610 }],
    ["800×1600", { w: 800, h: 1600 }],
  ])("%s", (raw, expected) => {
    expect(parseTileSizeMm(raw)).toEqual(expected);
  });

  it.each([null, undefined, "", "large", "1x1", "99999x5"])("rejects %p", (raw) => {
    expect(parseTileSizeMm(raw as string | null | undefined)).toBeNull();
  });
});

describe("alignToSource", () => {
  const solid = (width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: { r: 120, g: 110, b: 100 } } }).png().toBuffer();

  it("resizes a same-framing result onto the source pixel grid", async () => {
    const out = await alignToSource({ buffer: await solid(1024, 768), mimeType: "image/png" }, { width: 1600, height: 1200 });
    const meta = await sharp(out.buffer).metadata();
    expect([meta.width, meta.height]).toEqual([1600, 1200]);
    expect(out.mimeType).toBe("image/jpeg");
  });

  it("leaves a re-framed result untouched instead of distorting it", async () => {
    const buffer = await solid(1024, 1024);
    const out = await alignToSource({ buffer, mimeType: "image/png" }, { width: 1600, height: 900 });
    expect(out.buffer).toBe(buffer);
  });

  it("never throws on undecodable output", async () => {
    const buffer = Buffer.from("not an image");
    const out = await alignToSource({ buffer, mimeType: "image/png" }, { width: 100, height: 100 });
    expect(out.buffer).toBe(buffer);
  });
});

describe("prompt scale hints", () => {
  const analysis = {
    roomType: "bathroom",
    constructionState: "unfinished",
    perspective: "straight_on",
    lighting: "natural",
    doorCount: 1,
    windowCount: 0,
    fixtures: [],
  } as unknown as RoomAnalysis;
  const tile = { id: "t1", name: "Grey", sizeMm: "600x1200" } as TileCandidate;

  it("turns measured area + tile size into an approximate tile count", () => {
    const areas: DesignAreaInput[] = [
      { surface: "wall", location: "Back wall", pattern: "single", tiles: [tile], dimensions: { widthMm: 2400, heightMm: 2400 } },
    ];
    const prompt = buildDesignPrompt(analysis, areas, null, "B");
    expect(prompt).toContain("roughly 4 tiles across and 2 tiles up the height");
  });

  it("gives a real-object scale reference when no measurement exists", () => {
    const areas: DesignAreaInput[] = [{ surface: "floor", location: "Entire floor", pattern: "single", tiles: [tile] }];
    expect(buildDesignPrompt(analysis, areas, null, "B")).toContain("each main tile is 600 x 1200 mm");
  });
});


describe("stale generation detection", () => {
  const now = Date.parse("2026-10-15T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("a processing job past the function limit is stale", () => {
    expect(isJobStale({ status: "processing", startedAt: ago(STALE_GENERATION_MS + 1000), createdAt: ago(STALE_GENERATION_MS + 2000) }, now)).toBe(true);
  });
  it("a job still inside the limit, or already finished, is not", () => {
    expect(isJobStale({ status: "processing", startedAt: ago(30_000), createdAt: ago(31_000) }, now)).toBe(false);
    expect(isJobStale({ status: "completed", startedAt: ago(STALE_GENERATION_MS * 3), createdAt: ago(STALE_GENERATION_MS * 3) }, now)).toBe(false);
    expect(isJobStale({ status: "failed", startedAt: null, createdAt: ago(STALE_GENERATION_MS * 3) }, now)).toBe(false);
  });
});
