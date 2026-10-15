import { aiConfig } from "./config.js";
import { classifyGeminiError, getGeminiClient } from "./geminiClient.js";
import { GeminiEmptyResponseError, GeminiRateLimitError, GeminiUpstreamError, VisualizationGenerationError } from "./errors.js";
import { aiLogger } from "./logger.js";
import { buildDesignPrompt, distinctTileIds } from "./prompts/visualizationPrompt.js";
import { withTimeout } from "./timeout.js";
import { validateRoomImage, validateTileImage } from "./imageValidation.js";
import { prepareImageForModel } from "./prepareImageForModel.js";
import type { GenerateVisualizationInput, GeneratedVisualizationResult, ImageInput } from "./types.js";
import sharp from "sharp";

/** Aspect ratios the Gemini image models can output (width / height). */
const SUPPORTED_ASPECT_RATIOS: Array<{ label: string; value: number }> = [
  { label: "1:1", value: 1 },
  { label: "2:3", value: 2 / 3 },
  { label: "3:2", value: 3 / 2 },
  { label: "3:4", value: 3 / 4 },
  { label: "4:3", value: 4 / 3 },
  { label: "4:5", value: 4 / 5 },
  { label: "5:4", value: 5 / 4 },
  { label: "9:16", value: 9 / 16 },
  { label: "16:9", value: 16 / 9 },
  { label: "21:9", value: 21 / 9 },
];

/**
 * The supported output ratio closest to the source photo, compared on a log scale so
 * portrait and landscape errors weigh the same. Locking the output ratio stops the model
 * from re-framing (cropping or widening) the customer's room.
 */
export function closestAspectRatio(width: number, height: number): string {
  if (!(width > 0) || !(height > 0)) return "1:1";
  const target = Math.log(width / height);
  let best = SUPPORTED_ASPECT_RATIOS[0]!;
  for (const r of SUPPORTED_ASPECT_RATIOS) {
    if (Math.abs(Math.log(r.value) - target) < Math.abs(Math.log(best.value) - target)) best = r;
  }
  return best.label;
}

async function imageSize(image: ImageInput): Promise<{ width: number; height: number } | null> {
  try {
    const meta = await sharp(image.buffer).metadata();
    return meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
  } catch {
    return null;
  }
}

/**
 * Brings the generated image back onto the exact pixel grid of the (prepared) source photo
 * so the before/after slider lines up wall-for-wall. Only applied when the model kept the
 * framing (aspect within 6 %); a re-framed result is returned untouched rather than distorted.
 * Never throws: on any decode problem the model output is kept as it is.
 */
export async function alignToSource(
  generated: { buffer: Buffer; mimeType: string },
  source: { width: number; height: number } | null,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!source) return generated;
  try {
    const out = await imageSize({ buffer: generated.buffer, mimeType: generated.mimeType as ImageInput["mimeType"] });
    if (!out) return generated;
    if (out.width === source.width && out.height === source.height) return generated;
    const drift = Math.abs(Math.log(out.width / out.height) - Math.log(source.width / source.height));
    if (drift > 0.06) return generated;
    const buffer = await sharp(generated.buffer)
      .resize({ width: source.width, height: source.height, fit: "fill" })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
    return { buffer, mimeType: "image/jpeg" };
  } catch {
    return generated;
  }
}

/** True when the API rejected the request because of the output image options (older model / API). */
function isImageConfigRejection(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /aspect.?ratio|image.?config/i.test(message) && /400|invalid|not supported|unsupported/i.test(message);
}

interface InlineImagePart {
  inlineData?: { mimeType?: string; data?: string };
}

function extractGeneratedImage(response: {
  candidates?: Array<{ content?: { parts?: InlineImagePart[] }; finishReason?: string }>;
}): { buffer: Buffer; mimeType: string; finishReason: string | null } | null {
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data && part.inlineData.mimeType) {
      return {
        buffer: Buffer.from(part.inlineData.data, "base64"),
        mimeType: part.inlineData.mimeType,
        finishReason: candidate?.finishReason ?? null,
      };
    }
  }
  return null;
}

async function attemptGeneration(
  input: GenerateVisualizationInput,
  sourceSize: { width: number; height: number } | null,
): Promise<GeneratedVisualizationResult> {
  const client = getGeminiClient();
  const model = aiConfig.models.visualization;
  // The prompt letters tiles in first-use order; attach the reference photos in that same order.
  const orderedImages = distinctTileIds(input.areas).map((id) => input.tileImages.find((t) => t.tileId === id)!.image);
  const promptText = buildDesignPrompt(input.roomAnalysis, input.areas, input.requirements, undefined, input.roomType, input.layout ?? "open");
  const start = Date.now();

  // Each image is preceded by a short caption naming its role, so the model binds
  // "TILE B" to the right photo instead of guessing from position alone.
  const parts = [
    { text: promptText },
    { text: "Image 1 - SOURCE PHOTO (the customer's room to edit):" },
    { inlineData: { mimeType: input.roomImage.mimeType, data: input.roomImage.buffer.toString("base64") } },
    ...orderedImages.flatMap((image, i) => [
      { text: `Image ${i + 2} - TILE ${"ABCDEFGH"[i] ?? "?"} reference photo (copy its exact colour, pattern and finish):` },
      { inlineData: { mimeType: image.mimeType, data: image.buffer.toString("base64") } },
    ]),
  ];
  const aspectRatio = sourceSize ? closestAspectRatio(sourceSize.width, sourceSize.height) : undefined;

  const call = (withImageConfig: boolean) =>
    withTimeout(
      client.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["IMAGE"],
          ...(withImageConfig && aspectRatio ? { imageConfig: { aspectRatio } } : {}),
        },
      }),
      aiConfig.timeoutsMs.visualization,
      "generateVisualization",
    );

  let response;
  try {
    try {
      response = await call(true);
    } catch (err) {
      // A model/API version without output-ratio support: fall back to the plain request once.
      if (!aspectRatio || !isImageConfigRejection(err)) throw err;
      response = await call(false);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "GeminiTimeoutError") throw err;
    const category = classifyGeminiError(err);
    throw category === "rate_limited"
      ? new GeminiRateLimitError("generateVisualization", err)
      : new GeminiUpstreamError("generateVisualization", err);
  }

  const extracted = extractGeneratedImage(response as Parameters<typeof extractGeneratedImage>[0]);
  if (!extracted) {
    throw new GeminiEmptyResponseError("generateVisualization");
  }
  const aligned = await alignToSource(extracted, sourceSize);

  return {
    imageBuffer: aligned.buffer,
    mimeType: aligned.mimeType,
    model,
    finishReason: extracted.finishReason,
    durationMs: Date.now() - start,
  };
}

/**
 * Generates a finished-room visualization from an existing room upload +
 * its already-computed RoomAnalysis + a real selected tile's image.
 *
 * Does NOT re-run room analysis. Does NOT touch Supabase — the caller
 * (API route / DB service, next phase) is responsible for uploading
 * `imageBuffer` to Storage and updating the visualization/generation_job
 * rows. `context` identifiers are for logging/correlation only and are
 * never used here to make authorization decisions — the caller must have
 * already verified ownership before invoking this function.
 */
export async function generateVisualization(rawInput: GenerateVisualizationInput): Promise<GeneratedVisualizationResult> {
  validateRoomImage(rawInput.roomImage);
  for (const t of rawInput.tileImages) validateTileImage(t.image);

  // Model-input copies only (resized, metadata stripped). The stored room and
  // tile files are never modified; `rawInput` buffers stay untouched.
  const maxDimension = aiConfig.image.generationMaxDimension;
  const [roomImage, ...preparedTiles] = await Promise.all([
    prepareImageForModel(rawInput.roomImage, { maxDimension, label: "room image" }),
    ...rawInput.tileImages.map((t) => prepareImageForModel(t.image, { maxDimension, label: "tile image" })),
  ]);
  const tileImages = rawInput.tileImages.map((t, i) => ({ tileId: t.tileId, image: preparedTiles[i]! }));
  const input: GenerateVisualizationInput = { ...rawInput, roomImage, tileImages };

  const { roomUploadId, visualizationId, generationJobId } = input.context;
  const sourceSize = await imageSize(roomImage);

  try {
    const result = await attemptGeneration(input, sourceSize);
    aiLogger.info("visualization generation succeeded", {
      operation: "generateVisualization",
      model: result.model,
      roomUploadId,
      visualizationId,
      generationJobId,
      durationMs: result.durationMs,
      success: true,
      attempt: 1,
    });
    return result;
  } catch (err) {
    const retryable = err instanceof Error && "retryable" in err ? Boolean((err as { retryable?: boolean }).retryable) : false;

    aiLogger.warn("visualization generation attempt failed", {
      operation: "generateVisualization",
      model: aiConfig.models.visualization,
      roomUploadId,
      visualizationId,
      generationJobId,
      errorCategory: err instanceof Error ? err.name : "unknown",
      attempt: 1,
      success: false,
    });

    if (!retryable) {
      throw err;
    }

    // Single retry, only for transient failures (timeout/rate-limit/upstream).
    // Never retried for empty-response (likely safety block) or validation-shaped errors.
    try {
      const retryResult = await attemptGeneration(input, sourceSize);
      aiLogger.info("visualization generation succeeded on retry", {
        operation: "generateVisualization",
        model: retryResult.model,
        roomUploadId,
        visualizationId,
        generationJobId,
        durationMs: retryResult.durationMs,
        success: true,
        attempt: 2,
      });
      return retryResult;
    } catch (retryErr) {
      aiLogger.error("visualization generation failed after retry", {
        operation: "generateVisualization",
        model: aiConfig.models.visualization,
        roomUploadId,
        visualizationId,
        generationJobId,
        errorCategory: retryErr instanceof Error ? retryErr.name : "unknown",
        attempt: 2,
        success: false,
      });
      if (retryErr instanceof VisualizationGenerationError || retryErr instanceof GeminiEmptyResponseError) {
        throw retryErr;
      }
      // Preserve the actionable quota/configuration message after the bounded retry.
      if (retryErr instanceof GeminiRateLimitError || retryErr instanceof GeminiUpstreamError) {
        throw retryErr;
      }
      throw new VisualizationGenerationError(
        "Visualization generation failed after one retry",
        false,
        retryErr,
      );
    }
  }
}
