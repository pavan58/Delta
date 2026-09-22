"use client";
import { useRef, useState } from "react";
import { useStore } from "@/lib/client/store";
import { post } from "@/lib/client/api";
import { downscale } from "@/lib/client/image";
import type { Category, ColorFamily, FitAnalysis, FitType, Pattern, Product } from "@/lib/types";
import type { GarmentDetection } from "@/lib/ai/types";
import { ALL_COLORS, CATEGORY_LABEL, COLOR_HEX, COLOR_LABEL, FIT_LABEL, PATTERN_LABEL } from "@/lib/taxonomy";
import { ProductCard } from "@/components/ProductCard";
import { ErrorState, SkeletonGrid } from "@/components/States";
import { Icon } from "@/components/Icon";

type Piece = { category: Category; color: ColorFamily; fit?: FitType; pattern?: Pattern };
type Results = { results: { piece: Piece; matches: { product: Product; score: number; fit?: FitAnalysis; label: string }[] }[] };
const PIECE_CATS: Category[] = ["shirt", "tshirt", "polo", "overshirt", "jacket", "blazer", "kurta", "nehru-jacket", "jeans", "chinos", "trousers", "joggers", "sneakers", "loafers", "mojaris", "watch"];

export default function VisualSearch() {
  const store = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [consented, setConsented] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Results | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(file?: File) {
    if (!file) return;
    setErr(null); setRes(null); setBusy(true);
    try {
      const img = await downscale(file, 480);
      setImage(img.dataUrl);
      const det = await post<GarmentDetection>("/api/wardrobe/detect", { image: img.base64, mediaType: "image/jpeg", dominantColor: img.dominant, consent: true });
      setNote(det.method);
      setPieces([{ category: det.category ?? "shirt", color: det.colorFamily ?? img.dominant, fit: det.fit, pattern: det.pattern }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't read the image");
    } finally {
      setBusy(false);
    }
  }

  async function search() {
    setBusy(true); setErr(null);
    try {
      setRes(await post<Results>("/api/visual-search", { pieces, context: store.context() }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  const update = (i: number, patch: Partial<Piece>) => setPieces((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <div className="container-x py-8 sm:py-12">
      <p className="eyebrow">Visual search</p>
      <h1 className="h-display mt-2 text-4xl sm:text-6xl">Saw a look you liked?</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">Upload an Instagram or Pinterest screenshot, a product screenshot or an outfit photo. FITIQ identifies the garments, colours and silhouettes, then finds the <b>closest permitted alternatives</b>. We never claim an exact product match from an image.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[320px_1fr]">
        <div>
          {!consented ? (
            <div className="card p-5 text-sm">
              <p className="font-semibold">Photo processing consent</p>
              <p className="mt-2 text-ink-soft">The image is shrunk on your device and sent once to identify garments. It isn&apos;t stored or shared, and we don&apos;t analyse people&apos;s faces or bodies.</p>
              <button className="btn-primary btn-sm mt-4" onClick={() => setConsented(true)}>I agree</button>
            </div>
          ) : (
            <button className="flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-3xl border border-dashed border-ink/30 bg-bone-deep text-ink-mute" onClick={() => fileRef.current?.click()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {image ? <img src={image} alt="Uploaded look" className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-2 text-sm"><Icon name="camera" className="h-7 w-7" /> Upload a screenshot or photo</span>}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          {note && <p className="mt-2 text-[11px] text-ink-mute">{note}</p>}
        </div>

        <div>
          {pieces.length > 0 && (
            <div className="card p-5">
              <p className="font-semibold">Detected pieces — confirm or adjust</p>
              <div className="mt-3 space-y-3">
                {pieces.map((p, i) => (
                  <div key={i} className="grid gap-2 rounded-xl bg-bone p-3 sm:grid-cols-4">
                    <select className="input py-2" value={p.category} onChange={(e) => update(i, { category: e.target.value as Category })} aria-label="Garment">{PIECE_CATS.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select>
                    <select className="input py-2" value={p.color} onChange={(e) => update(i, { color: e.target.value as ColorFamily })} aria-label="Colour">{ALL_COLORS.map((c) => <option key={c} value={c}>{COLOR_LABEL[c]}</option>)}</select>
                    <select className="input py-2" value={p.fit ?? ""} onChange={(e) => update(i, { fit: (e.target.value || undefined) as FitType })} aria-label="Silhouette"><option value="">Any silhouette</option>{(["slim", "regular", "relaxed", "oversized", "straight", "tapered"] as FitType[]).map((f) => <option key={f} value={f}>{FIT_LABEL[f]}</option>)}</select>
                    <div className="flex items-center gap-2">
                      <select className="input py-2" value={p.pattern ?? "solid"} onChange={(e) => update(i, { pattern: e.target.value as Pattern })} aria-label="Pattern">{(["solid", "stripe", "check", "print", "texture"] as Pattern[]).map((x) => <option key={x} value={x}>{PATTERN_LABEL[x]}</option>)}</select>
                      <span className="h-8 w-8 shrink-0 rounded-full border border-black/10" style={{ background: COLOR_HEX[p.color] }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {pieces.length < 4 && <button className="btn-ghost btn-sm" onClick={() => setPieces([...pieces, { category: "chinos", color: "beige" }])}>+ Add another piece from the look</button>}
                <button className="btn-primary btn-sm" onClick={search} disabled={busy}>Find closest alternatives</button>
              </div>
            </div>
          )}
          {pieces.length === 0 && !busy && <p className="text-sm text-ink-soft">No image yet. Or describe it in <a href="/discover" className="underline">Discover</a> — e.g. &ldquo;beige overshirt&rdquo;.</p>}
          {err && <div className="mt-4"><ErrorState message={err} /></div>}
          {busy && <div className="mt-6"><SkeletonGrid n={3} /></div>}
          {res && !busy && res.results.map((r, i) => (
            <section key={i} className="mt-8">
              <p className="eyebrow mb-3">{COLOR_LABEL[r.piece.color]} {CATEGORY_LABEL[r.piece.category].toLowerCase()} · closest alternatives</p>
              {r.matches.length === 0 ? <p className="text-sm text-ink-soft">No available products in this category right now.</p> : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{r.matches.map((m) => <ProductCard key={m.product.id} product={m.product} fit={m.fit} note="Similar alternative — not the exact item" />)}</div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
