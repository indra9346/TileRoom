/**
 * Diagnostic: times one real Gemini tile-recommendation call with the live catalog and the
 * walls+floor room's analysis, using the same prompt/schema as production. Read-only (no DB writes).
 * Usage: npx tsx scripts/probe-recommend-timing.ts <roomUploadId>
 */
import "../server/lib/loadLocalEnv.js";
import { getGeminiClient } from "../server/ai/geminiClient.js";
import { aiConfig } from "../server/ai/config.js";
import { buildTileRecommendationPrompt } from "../server/ai/prompts/tileRecommendationPrompt.js";
import { geminiTileRecommendationJsonSchema, geminiTileRecommendationResponseSchema } from "../server/ai/schemas/tileRecommendationSchema.js";
import { getAnalysisByRoomUploadId } from "../server/db/analyses.js";
import { getSupabaseServerClient } from "../server/lib/supabaseServerClient.js";

async function main() {
  const roomId = process.argv[2];
  if (!roomId) throw new Error("pass a roomUploadId");
  const analysis = await getAnalysisByRoomUploadId(roomId);
  if (!analysis) throw new Error("no analysis");
  const { data: room } = await getSupabaseServerClient().from("room_uploads").select("user_id").eq("id", roomId).single();
  const { data: rows } = await getSupabaseServerClient()
    .from("tiles")
    .select("id, sku, name, brand, category, material, finish, color_family, size_mm, price_per_sqft, currency, storage_path, suitable_rooms, is_active")
    .eq("owner_id", room!.user_id)
    .eq("is_active", true);
  const candidates = (rows ?? []).map((r: any) => ({ id: r.id, sku: r.sku, name: r.name, brand: r.brand, category: r.category, material: r.material, finish: r.finish, colorFamily: r.color_family, sizeMm: r.size_mm, pricePerSqft: r.price_per_sqft, suitableRooms: r.suitable_rooms, storagePath: r.storage_path, isActive: r.is_active }));
  const prompt = buildTileRecommendationPrompt(analysis, candidates as any);
  console.log(`model=${aiConfig.models.tileRecommendation} timeoutMs=${aiConfig.timeoutsMs.tileRecommendation} candidates=${candidates.length} promptChars=${prompt.length}`);
  const t0 = Date.now();
  const res = await getGeminiClient().models.generateContent({
    model: aiConfig.models.tileRecommendation,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json", responseSchema: geminiTileRecommendationJsonSchema },
  });
  const ms = Date.now() - t0;
  const parsed = geminiTileRecommendationResponseSchema.safeParse(JSON.parse(res.text ?? "{}"));
  console.log(`geminiMs=${ms} valid=${parsed.success}`);
  if (parsed.success) for (const r of parsed.data.recommendations.slice(0, 6)) console.log(`  ${r.surface} #${r.rank} ${candidates.find((c) => c.id === r.tileId)?.name ?? "UNKNOWN " + r.tileId}: ${r.reason}`);
  else console.log(parsed.error.issues.slice(0, 3));
}

main().catch((e) => {
  console.error("probe failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
