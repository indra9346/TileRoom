import { ApiClientError, apiGet, apiPost, apiSend } from "./client";
import {
  loadLocalTemplates,
  newLocalTemplate,
  saveLocalTemplates,
  type CustomTemplate,
  type CustomTemplateInput,
} from "@/lib/customTemplates";

/**
 * Custom Design Studio templates. The server (table design_templates) is the source of truth so a template
 * follows the owner to every device. If the server store is unreachable or not migrated yet (5xx / 404),
 * templates fall back to this browser so saving never silently fails; those carry `local: true`.
 */
const serverUnavailable = (err: unknown) => !(err instanceof ApiClientError) || err.status >= 500 || err.status === 404;

export async function listCustomTemplates(): Promise<{ templates: CustomTemplate[]; offline: boolean }> {
  const localOnes = loadLocalTemplates();
  try {
    const res = await apiGet<{ templates: CustomTemplate[] }>("/api/templates");
    return { templates: [...res.templates, ...localOnes], offline: false };
  } catch (err) {
    if (!serverUnavailable(err)) throw err;
    return { templates: localOnes, offline: true };
  }
}

export async function createCustomTemplate(input: CustomTemplateInput): Promise<CustomTemplate> {
  try {
    const res = await apiPost<{ template: CustomTemplate }>("/api/templates", input);
    return res.template;
  } catch (err) {
    if (!serverUnavailable(err)) throw err;
    const created = newLocalTemplate(input);
    saveLocalTemplates([created, ...loadLocalTemplates()]);
    return created;
  }
}

export async function updateCustomTemplate(existing: CustomTemplate, input: CustomTemplateInput): Promise<CustomTemplate> {
  if (existing.local) {
    const updated: CustomTemplate = { ...existing, ...input, description: input.description ?? null, updatedAt: new Date().toISOString() };
    saveLocalTemplates(loadLocalTemplates().map((t) => (t.id === existing.id ? updated : t)));
    return updated;
  }
  const res = await apiSend<{ template: CustomTemplate }>("PUT", "/api/templates", { templateId: existing.id, template: input });
  return res.template;
}

export async function deleteCustomTemplate(template: CustomTemplate): Promise<void> {
  if (template.local) {
    saveLocalTemplates(loadLocalTemplates().filter((t) => t.id !== template.id));
    return;
  }
  await apiSend<{ deleted: boolean }>("DELETE", `/api/templates?templateId=${encodeURIComponent(template.id)}`);
}
