import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageBanner } from "@/components/ui/PageBanner";
import { createMyTile, listMyTiles, setMyTileActive } from "@/api/tiles";
import { friendlyErrorMessage } from "@/api/client";
import { validateRoomImageFile } from "@/api/rooms";
import { getPublicTileImageUrl } from "@/lib/tileImage";
import { formatTileSize } from "@/lib/fitRecommend";
import type { RoomType, Tile, TileCategory } from "@/api/types";
import { EASE_OUT, hoverLift, staggerContainer, staggerItem } from "@/components/ui/motion";

const ROOMS: { value: RoomType; label: string }[] = [
  { value: "kitchen", label: "Kitchen" },
  { value: "bedroom", label: "Bedroom" },
  { value: "bathroom", label: "Bathroom" },
  { value: "living_room", label: "Living room" },
  { value: "dining_room", label: "Dining room" },
  { value: "balcony", label: "Balcony" },
  { value: "corridor", label: "Corridor" },
  { value: "other", label: "Other" },
];

const label = "mb-1.5 block text-sm font-medium text-stone-700";
const choiceInput =
  "h-4 w-4 shrink-0 cursor-pointer accent-sage-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500";
const choiceLabel = "flex cursor-pointer items-center gap-2 rounded-md py-0.5 text-sm text-stone-700 transition-colors hover:text-stone-950";

export function MyTilesPage() {
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState<TileCategory>("floor");
  const [material, setMaterial] = useState("");
  const [finish, setFinish] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  function load() {
    setLoadError(null);
    listMyTiles()
      .then(setTiles)
      .catch((err) => setLoadError(friendlyErrorMessage(err, "We couldn't load your tiles.")));
  }
  useEffect(load, []);

  useEffect(() => {
    if (!image) return setPreview(null);
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function pickImage(file: File | undefined) {
    if (!file) return;
    const err = validateRoomImageFile(file);
    if (err) {
      setFormError(err.message);
      return;
    }
    setFormError(null);
    setImage(file);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!image) return setFormError("Please add a photo of the tile.");
    setFormError(null);
    setSaving(true);
    try {
      const tile = await createMyTile({
        name,
        brand,
        sku,
        category,
        material,
        finish,
        colorFamily: color,
        sizeMm: size,
        pricePerSqft: price.trim() === "" ? null : Number(price),
        suitableRooms: rooms,
        image,
      });
      setTiles((prev) => [tile, ...(prev ?? [])]);
      setJustAdded(tile.name);
      setName("");
      setBrand("");
      setSku("");
      setMaterial("");
      setFinish("");
      setColor("");
      setSize("");
      setPrice("");
      setRooms([]);
      setImage(null);
    } catch (err) {
      setFormError(friendlyErrorMessage(err, "We couldn't save this tile. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(tile: Tile) {
    try {
      const updated = await setMyTileActive(tile.id, !tile.isActive);
      setTiles((prev) => prev?.map((t) => (t.id === updated.id ? updated : t)) ?? prev);
    } catch (err) {
      setLoadError(friendlyErrorMessage(err, "We couldn't update that tile."));
    }
  }

  return (
    <PageContainer>
      <PageBanner
        scene="hex"
        badge="Craftsmanship • Showroom Inventory"
        title="Curate Your Tile Inventory"
        subtitle="List the tiles your showroom offers. These products are mapped to customer room trials for realistic in-situ visualizations."
        actions={
          <>
            <Link to="/tiles">
              <Button size="lg" className="bg-clay-500 hover:bg-clay-400 text-stone-950 font-semibold shadow-md">
                View Public Catalog →
              </Button>
            </Link>
            <Link to="/upload">
              <Button size="lg" variant="outline" className="border-stone-300 bg-white/80 text-stone-900 hover:bg-white">
                Try in a Room
              </Button>
            </Link>
          </>
        }
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[420px_1fr]">
        <motion.div
          className="min-w-0"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15, ease: EASE_OUT }}
        >
        <Card className="h-fit border-stone-200 shadow-md">
          <CardBody>
            <h2 className="font-display text-xl text-stone-900">Add a New Tile</h2>
            <form className="mt-5 space-y-4" onSubmit={onSubmit}>
              <div>
                <span className={label}>Tile photo *</span>
                <label className="group flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 text-center text-sm text-stone-500 transition-[border-color,background-color] duration-300 focus-within:border-champagne-500 hover:border-clay-400 hover:bg-surface-sage/50">
                  <AnimatePresence mode="wait" initial={false}>
                    {preview ? (
                      <motion.img
                        key={preview}
                        src={preview}
                        alt="Preview of the tile you selected"
                        className="h-full w-full object-cover"
                        initial={{ opacity: 0, scale: 1.06 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: EASE_OUT }}
                      />
                    ) : (
                      <motion.span
                        key="placeholder"
                        className="flex flex-col items-center gap-2 px-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-stone-400 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:text-sage-600">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="m21 15-5-5L5 21" />
                        </svg>
                        Click to choose a clear, straight-on photo of the tile surface (JPEG, PNG or WebP)
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickImage(e.target.files?.[0])} />
                </label>
              </div>

              <div>
                <label className={label} htmlFor="name">
                  Product name *
                </label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Calacatta Gold Slab" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="brand">
                    Brand / Manufacturer
                  </label>
                  <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Kajaria, Somany" />
                </div>
                <div>
                  <label className={label} htmlFor="sku">
                    SKU / Article #
                  </label>
                  <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. KJR-8012" />
                </div>
              </div>

              <div>
                <span className={label}>Category *</span>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {(["floor", "wall", "both"] as TileCategory[]).map((cat) => (
                    <label key={cat} className={`${choiceLabel} capitalize`}>
                      <input type="radio" name="category" className={choiceInput} checked={category === cat} onChange={() => setCategory(cat)} />
                      {cat}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="material">
                    Material
                  </label>
                  <Input id="material" value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="e.g. Glazed Vitrified" />
                </div>
                <div>
                  <label className={label} htmlFor="finish">
                    Finish
                  </label>
                  <Input id="finish" value={finish} onChange={(e) => setFinish(e.target.value)} placeholder="e.g. High Gloss, Matte" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className={label} htmlFor="color">
                    Color family
                  </label>
                  <Input id="color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. White" />
                </div>
                <div>
                  <label className={label} htmlFor="size">
                    Size
                  </label>
                  <Input id="size" value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. 600x1200" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className={label} htmlFor="price">
                    Price / sq ft
                  </label>
                  <Input id="price" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 85" />
                </div>
              </div>

              <fieldset>
                <legend className={label}>Suitable spaces</legend>
                <div className="grid grid-cols-2 gap-2">
                  {ROOMS.map((r) => (
                    <label key={r.value} className={choiceLabel}>
                      <input
                        type="checkbox"
                        className={choiceInput}
                        checked={rooms.includes(r.value)}
                        onChange={() => setRooms((prev) => (prev.includes(r.value) ? prev.filter((x) => x !== r.value) : [...prev, r.value]))}
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-stone-500">Leave empty if the tile suits any room.</p>
              </fieldset>

              <AnimatePresence initial={false}>
                {formError && (
                  <motion.p
                    key="form-error"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0, x: [0, -5, 5, -3, 3, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    role="alert"
                    className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                  >
                    {formError}
                  </motion.p>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {justAdded && !formError && (
                  <motion.p
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    role="status"
                    className="overflow-hidden rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"
                  >
                    "{justAdded}" was added to your catalog.
                  </motion.p>
                )}
              </AnimatePresence>

              <Button type="submit" size="lg" className="w-full" loading={saving}>
                {saving ? "Saving to Catalog…" : "Add Tile to Showroom"}
              </Button>
            </form>
          </CardBody>
        </Card>
        </motion.div>

        <motion.div
          className="min-w-0"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.25, ease: EASE_OUT }}
        >
          <h2 className="font-display text-xl text-stone-900">Your Showroom Catalog{tiles ? ` (${tiles.length})` : ""}</h2>
          <div className="mt-4">
            {loadError ? (
              <ErrorState message={loadError} onRetry={load} />
            ) : tiles === null ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[3/4] w-full rounded-2xl" />
                ))}
              </div>
            ) : tiles.length === 0 ? (
              <EmptyState title="No tiles yet" description="Add your first tile with a photo using the form. It appears here straight away." />
            ) : (
              <motion.div
                className="grid grid-cols-2 gap-4 sm:grid-cols-3"
                initial="hidden"
                animate="show"
                variants={staggerContainer(0.05)}
              >
                <AnimatePresence>
                  {tiles.map((tile) => (
                    <motion.div
                      key={tile.id}
                      layout
                      variants={staggerItem}
                      {...hoverLift}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="group min-w-0"
                    >
                      {/* Dimming lives on the Card: framer owns the wrapper's inline opacity, which would override a class there. */}
                      <Card
                        className={`h-full overflow-hidden transition-[opacity,box-shadow,border-color] duration-300 group-hover:border-sage-400/70 group-hover:shadow-lift ${
                          tile.isActive ? "" : "opacity-60"
                        }`}
                      >
                        <div className="aspect-square overflow-hidden bg-stone-100">
                          <img
                            src={getPublicTileImageUrl(tile.storagePath)}
                            alt={tile.name}
                            className="h-full w-full object-cover transition-transform duration-700 ease-out-quint group-hover:scale-[1.06]"
                            loading="lazy"
                          />
                        </div>
                        <div className="space-y-1.5 p-3">
                          <p className="break-words font-display font-semibold leading-tight text-stone-900">{tile.name}</p>
                          <p className="break-words text-xs text-stone-500">{[tile.brand, tile.material, formatTileSize(tile.sizeMm)].filter(Boolean).join(" · ")}</p>
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <Badge tone={tile.isActive ? "success" : "neutral"}>{tile.isActive ? "Active" : "Hidden"}</Badge>
                            <button
                              type="button"
                              onClick={() => toggle(tile)}
                              className="rounded-md px-1.5 py-1 text-xs font-medium text-clay-700 transition-[background-color,color,transform] duration-200 hover:bg-clay-100 hover:text-clay-800 active:scale-95"
                            >
                              {tile.isActive ? "Hide" : "Show"}
                            </button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </PageContainer>
  );
}
