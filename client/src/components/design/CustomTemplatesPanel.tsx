import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { friendlyErrorMessage } from "@/api/client";
import { createCustomTemplate, deleteCustomTemplate, listCustomTemplates, updateCustomTemplate } from "@/api/designTemplates";
import { baseTemplateLabel, draftToTemplate, templateProblem, templateSummary, type CustomTemplate } from "@/lib/customTemplates";
import type { DraftArea } from "@/lib/designDraft";
import type { TemplateId } from "@/lib/roomTemplates";

interface Props {
  templateId: TemplateId;
  areas: DraftArea[];
  /** Apply a saved template to this room (replaces the current areas). */
  onApply: (template: CustomTemplate) => void | Promise<void>;
}

const listMotion = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const itemMotion = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 380, damping: 30 } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
};

/**
 * "My templates": save the current room template + areas (surfaces, patterns, sizes, chosen tiles) under a name
 * and re-apply it to any room in one click. Works per showroom account; falls back to this browser when the
 * server store is unavailable so a save is never lost silently.
 */
export function CustomTemplatesPanel({ templateId, areas, onApply }: Props) {
  const [templates, setTemplates] = useState<CustomTemplate[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomTemplate | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CustomTemplate | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCustomTemplates()
      .then((res) => {
        if (cancelled) return;
        setTemplates(res.templates);
        setOffline(res.offline);
      })
      .catch((err) => !cancelled && setLoadError(friendlyErrorMessage(err, "We couldn't load your templates.")));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  function openForm(existing: CustomTemplate | null) {
    setEditing(existing);
    setName(existing?.name ?? "");
    setDescription(existing?.description ?? "");
    setFormError(null);
    setFormOpen(true);
  }

  async function save() {
    const problem = templateProblem(name, areas);
    if (problem) {
      setFormError(problem);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const input = draftToTemplate(name, description, templateId, areas);
      const saved = editing ? await updateCustomTemplate(editing, input) : await createCustomTemplate(input);
      setTemplates((prev) => [saved, ...(prev ?? []).filter((t) => t.id !== saved.id)]);
      setFormOpen(false);
      setNotice(saved.local ? `"${saved.name}" saved in this browser (the server store is unavailable right now).` : `"${saved.name}" saved to your templates.`);
    } catch (err) {
      setFormError(friendlyErrorMessage(err, "We couldn't save this template. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft" aria-label="My templates">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg text-stone-900">My templates</h2>
          <p className="mt-1 text-sm text-stone-600">Save this setup (surfaces, patterns, sizes and tiles) and reuse it on any room in one click.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => openForm(null)} disabled={areas.length === 0}>
          Save as template
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {formOpen && (
          <motion.form
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="mt-4 space-y-3 rounded-xl border border-clay-200 bg-clay-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                {editing ? `Update "${editing.name}" with the current design` : `New template from ${baseTemplateLabel(templateId)}`}
              </p>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-stone-800">Name</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Premium bathroom, grey dado" autoFocus />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-stone-800">Description (optional)</span>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="When to use it" />
              </label>
              {formError && <p className="text-sm text-red-700" role="alert">{formError}</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" loading={saving}>
                  {editing ? "Update template" : "Save template"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notice && (
          <motion.p
            key={notice}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            role="status"
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>

      {offline && <p className="mt-3 text-xs text-amber-800">Templates are being kept in this browser until the server store is available.</p>}
      {loadError && <p className="mt-3 text-sm text-red-700">{loadError}</p>}

      {templates === null && !loadError ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-stone-100" />
          ))}
        </div>
      ) : templates && templates.length === 0 ? (
        <p className="mt-4 rounded-lg bg-stone-50 px-3 py-2.5 text-xs text-stone-600">No saved templates yet. Design a room once, then save it here to reuse it.</p>
      ) : (
        <motion.ul variants={listMotion} initial="hidden" animate="show" className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <AnimatePresence>
            {(templates ?? []).map((t) => (
              <motion.li
                key={t.id}
                layout
                variants={itemMotion}
                exit="exit"
                whileHover={{ y: -2 }}
                className="flex min-w-0 flex-col rounded-xl border border-stone-200 bg-stone-50/60 p-3 transition-shadow hover:shadow-soft"
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold text-stone-900" title={t.name}>
                    {t.name}
                  </p>
                  {t.local && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">This browser</span>}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">{t.description || templateSummary(t)}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Button size="sm" onClick={() => void onApply(t)}>
                    Apply
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openForm(t)} disabled={areas.length === 0} title="Overwrite with the current design">
                    Update
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setToDelete(t)}>
                    Delete
                  </Button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete template?"
        message={toDelete ? `"${toDelete.name}" will be removed. Designs already generated with it are not affected.` : ""}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteCustomTemplate(toDelete);
          } catch (err) {
            throw new Error(friendlyErrorMessage(err, "We couldn't delete this template."));
          }
          setTemplates((prev) => (prev ?? []).filter((x) => x.id !== toDelete.id));
        }}
      />
    </section>
  );
}
