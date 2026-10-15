import { getSupabaseServerClient } from "../lib/supabaseServerClient.js";
import { Errors } from "../lib/apiError.js";
import { apiLogger } from "../lib/logger.js";
import type { DesignTemplateBody } from "../lib/validation.js";

export type DesignTemplateArea = DesignTemplateBody["areas"][number];

export interface DesignTemplateRow {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  baseTemplate: string;
  areas: DesignTemplateArea[];
  createdAt: string;
  updatedAt: string;
}

interface DbRow {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  base_template: string;
  areas: unknown;
  created_at: string;
  updated_at: string;
}

const COLUMNS = "id, owner_id, name, description, base_template, areas, created_at, updated_at";

function mapRow(row: DbRow): DesignTemplateRow {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    baseTemplate: row.base_template,
    areas: Array.isArray(row.areas) ? (row.areas as DesignTemplateArea[]) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDb(body: DesignTemplateBody) {
  return {
    name: body.name,
    description: body.description && body.description.length > 0 ? body.description : null,
    base_template: body.baseTemplate,
    areas: body.areas,
  };
}

export async function listDesignTemplates(ownerId: string): Promise<DesignTemplateRow[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("design_templates").select(COLUMNS).eq("owner_id", ownerId).order("updated_at", { ascending: false });
  if (error) {
    apiLogger.error("listDesignTemplates failed", { operation: "listDesignTemplates", errorCategory: error.code });
    throw Errors.internal("Failed to load your templates.");
  }
  return ((data ?? []) as DbRow[]).map(mapRow);
}

export async function countDesignTemplates(ownerId: string): Promise<number> {
  const supabase = getSupabaseServerClient();
  const { count, error } = await supabase.from("design_templates").select("id", { count: "exact", head: true }).eq("owner_id", ownerId);
  if (error) {
    apiLogger.error("countDesignTemplates failed", { operation: "countDesignTemplates", errorCategory: error.code });
    throw Errors.internal("Failed to load your templates.");
  }
  return count ?? 0;
}

export async function createDesignTemplate(ownerId: string, body: DesignTemplateBody): Promise<DesignTemplateRow> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("design_templates")
    .insert({ owner_id: ownerId, ...toDb(body) })
    .select(COLUMNS)
    .single();
  if (error || !data) {
    apiLogger.error("createDesignTemplate failed", { operation: "createDesignTemplate", errorCategory: error?.code });
    throw Errors.internal("Failed to save the template.");
  }
  return mapRow(data as DbRow);
}

/** Owner-scoped update; null when the template does not exist or belongs to someone else. */
export async function updateDesignTemplate(ownerId: string, templateId: string, body: DesignTemplateBody): Promise<DesignTemplateRow | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("design_templates")
    .update(toDb(body))
    .eq("id", templateId)
    .eq("owner_id", ownerId)
    .select(COLUMNS)
    .maybeSingle();
  if (error) {
    apiLogger.error("updateDesignTemplate failed", { operation: "updateDesignTemplate", errorCategory: error.code });
    throw Errors.internal("Failed to update the template.");
  }
  return data ? mapRow(data as DbRow) : null;
}

/** Owner-scoped delete; false when nothing of the caller's was removed. */
export async function deleteDesignTemplate(ownerId: string, templateId: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("design_templates").delete().eq("id", templateId).eq("owner_id", ownerId).select("id").maybeSingle();
  if (error) {
    apiLogger.error("deleteDesignTemplate failed", { operation: "deleteDesignTemplate", errorCategory: error.code });
    throw Errors.internal("Failed to delete the template.");
  }
  return Boolean(data);
}
