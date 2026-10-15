import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHandler } from "../../server/lib/httpHandler.js";
import { authenticateRequest } from "../../server/lib/auth.js";
import { checkRateLimit } from "../../server/lib/rateLimit.js";
import {
  MAX_DESIGN_TEMPLATES_PER_USER,
  deleteDesignTemplateQuerySchema,
  designTemplateBodySchema,
  parseOrThrow,
  updateDesignTemplateBodySchema,
} from "../../server/lib/validation.js";
import {
  countDesignTemplates,
  createDesignTemplate,
  deleteDesignTemplate,
  listDesignTemplates,
  updateDesignTemplate,
} from "../../server/db/designTemplates.js";
import { Errors } from "../../server/lib/apiError.js";

/**
 * Custom Design Studio templates (GET list / POST create / PUT update / DELETE).
 * A template only stores ids and labels; the tiles it names are re-checked
 * (ownership, active, surface) by the generate endpoint when it is used, so a
 * template can never smuggle in another showroom's tile.
 */
export default createHandler({ methods: ["GET", "POST", "PUT", "DELETE"], operation: "designTemplates" }, async (req: VercelRequest, res: VercelResponse) => {
  const user = await authenticateRequest(req);

  if (req.method === "GET") {
    res.status(200).json({ templates: await listDesignTemplates(user.id) });
    return;
  }

  if (req.method === "DELETE") {
    const { templateId } = parseOrThrow(deleteDesignTemplateQuerySchema, req.query);
    if (!(await deleteDesignTemplate(user.id, templateId))) throw Errors.notFound("Template not found.");
    res.status(200).json({ deleted: true, templateId });
    return;
  }

  checkRateLimit(`designTemplateWrite:${user.id}`, 120, 60 * 60 * 1000);

  if (req.method === "PUT") {
    const body = parseOrThrow(updateDesignTemplateBodySchema, req.body);
    const template = await updateDesignTemplate(user.id, body.templateId, body.template);
    if (!template) throw Errors.notFound("Template not found.");
    res.status(200).json({ template });
    return;
  }

  // POST: create
  const body = parseOrThrow(designTemplateBodySchema, req.body);
  if ((await countDesignTemplates(user.id)) >= MAX_DESIGN_TEMPLATES_PER_USER) {
    throw Errors.validation(`You can keep up to ${MAX_DESIGN_TEMPLATES_PER_USER} templates. Delete one you no longer use first.`);
  }
  res.status(201).json({ template: await createDesignTemplate(user.id, body) });
});
