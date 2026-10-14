import { getSupabaseServerClient } from "../lib/supabaseServerClient.js";
import { Errors } from "../lib/apiError.js";
import { apiLogger } from "../lib/logger.js";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export const MAX_GENERATION_ATTEMPTS = 3;

export interface GenerationJobRow {
  id: string;
  visualizationId: string;
  status: JobStatus;
  attemptNumber: number;
  generationModel: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface RawJobRow {
  id: string;
  visualization_id: string;
  status: string;
  attempt_number: number;
  generation_model: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

function normalizeJobStatus(status: string): JobStatus {
  if (status === "processing" || status === "active") return "processing";
  if (status === "completed" || status === "closed") return "completed";
  if (status === "failed" || status === "rejected") return "failed";
  return "pending";
}

function mapRow(row: RawJobRow): GenerationJobRow {
  return {
    id: row.id,
    visualizationId: row.visualization_id,
    status: normalizeJobStatus(row.status),
    attemptNumber: row.attempt_number,
    generationModel: row.generation_model,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

const SELECT_COLUMNS = "id, visualization_id, status, attempt_number, generation_model, error_message, started_at, completed_at, created_at";

export async function countJobsForVisualization(visualizationId: string): Promise<number> {
  const supabase = getSupabaseServerClient();
  const { count, error } = await supabase
    .from("generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("visualization_id", visualizationId);

  if (error) {
    apiLogger.error("countJobsForVisualization failed", { operation: "countJobsForVisualization", errorCategory: error.code });
    throw Errors.internal("Failed to check generation attempts.");
  }

  return count ?? 0;
}

export async function getLatestJobForVisualization(visualizationId: string): Promise<GenerationJobRow | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("generation_jobs")
    .select(SELECT_COLUMNS)
    .eq("visualization_id", visualizationId)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    apiLogger.error("getLatestJobForVisualization failed", { operation: "getLatestJobForVisualization", errorCategory: error.code });
    throw Errors.internal("Failed to load generation job.");
  }

  return data ? mapRow(data) : null;
}

/**
 * Creates the next attempt for a visualization, enforcing
 * MAX_GENERATION_ATTEMPTS in application code (no schema change).
 */
export async function createNextGenerationJob(visualizationId: string): Promise<GenerationJobRow> {
  // If a previous job attempt was created but never started (e.g. earlier crash before processing),
  // reuse it instead of consuming another attempt count.
  const latest = await getLatestJobForVisualization(visualizationId);
  if (latest && latest.status === "pending" && !latest.startedAt) {
    return latest;
  }

  const existingCount = await countJobsForVisualization(visualizationId);
  if (existingCount >= MAX_GENERATION_ATTEMPTS) {
    throw Errors.retryLimitExceeded(MAX_GENERATION_ATTEMPTS);
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("generation_jobs")
    .insert({ visualization_id: visualizationId, attempt_number: existingCount + 1, status: "pending" })
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      // Concurrent request already created this attempt number; surface the real current state.
      const current = await getLatestJobForVisualization(visualizationId);
      if (current) return current;
    }
    apiLogger.error("createNextGenerationJob failed", { operation: "createNextGenerationJob", errorCategory: error?.code });
    throw Errors.internal("Failed to create generation job.");
  }

  return mapRow(data);
}

/**
 * Updates generation_jobs with schema-adaptive fallback so differences in the DB enum
 * (e.g., standard 'processing'/'completed'/'failed' vs legacy 'active'/'closed'/'rejected')
 * or transient database errors never abort user image generation.
 */
async function updateJobSafely(
  jobId: string,
  preferredStatus: JobStatus,
  fallbackStatus: string,
  fields: Record<string, unknown>,
  operationName: string
): Promise<void> {
  const supabase = getSupabaseServerClient();

  // 1. Try preferred status value
  let { error } = await supabase
    .from("generation_jobs")
    .update({ ...fields, status: preferredStatus })
    .eq("id", jobId);

  // 2. If rejected by Postgres enum check (22P02), try the compatible fallback
  if (error && error.code === "22P02") {
    const fallbackRes = await supabase
      .from("generation_jobs")
      .update({ ...fields, status: fallbackStatus })
      .eq("id", jobId);

    if (fallbackRes.error && fallbackRes.error.code === "22P02") {
      // 3. If neither enum value is supported, update timestamps and metadata without status
      const noStatusRes = await supabase
        .from("generation_jobs")
        .update(fields)
        .eq("id", jobId);
      error = noStatusRes.error;
    } else {
      error = fallbackRes.error;
    }
  }

  if (error) {
    apiLogger.warn(`${operationName} failed to update generation_jobs row`, {
      operation: operationName,
      jobId,
      errorCategory: error.code,
      message: error.message,
    });
    // Non-fatal: an audit log failure must never fail the user's visualization generation
  }
}

export async function markJobProcessing(jobId: string, generationModel?: string): Promise<void> {
  await updateJobSafely(
    jobId,
    "processing",
    "active",
    {
      started_at: new Date().toISOString(),
      generation_model: generationModel ?? null,
    },
    "markJobProcessing"
  );
}

export async function markJobCompleted(jobId: string): Promise<void> {
  await updateJobSafely(
    jobId,
    "completed",
    "closed",
    {
      completed_at: new Date().toISOString(),
    },
    "markJobCompleted"
  );
}

export async function markJobFailed(jobId: string, safeErrorMessage: string): Promise<void> {
  await updateJobSafely(
    jobId,
    "failed",
    "rejected",
    {
      completed_at: new Date().toISOString(),
      error_message: safeErrorMessage,
    },
    "markJobFailed"
  );
}
