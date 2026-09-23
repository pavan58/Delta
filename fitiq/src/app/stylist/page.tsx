"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/client/store";
import { post } from "@/lib/client/api";
import type { Occasion, Outfit, OutfitRequest, ParsedQuery, StyleTag, WeatherContext } from "@/lib/types";
import { ALL_OCCASIONS, ALL_STYLES, BUILD_LABEL, FIT_LABEL, OCCASION_LABEL, STYLE_LABEL, cmToFeetIn, formatINR } from "@/lib/taxonomy";
import { OutfitCard } from "@/components/OutfitCard";
import { EmptyState, ErrorState, ProfilePrompt, SkeletonBlock } from "@/components/States";
import { Icon } from "@/components/Icon";

interface Result {
  recipe: { id: string; name: string; description: string };
  outfits: Outfit[];
  cheapestPossible?: number;
  message?: string;
  request: OutfitRequest;
  parsed?: ParsedQuery;
}

const EXAMPLES = [
  "Smart casual office outfit under ₹3000",
  "Wedding outfit for my brother under 5000",
  "Date night look under 4k",
  "Haldi outfit under 3500",
  "First day at work, formal, under 4000",
  "College streetwear under 2500",
];
const WEATHER: WeatherContext["condition"][] = ["hot", "humid", "rain", "mild", "cool", "cold"];

export default function StylistPage() {
  return (
    <Suspense fallback={<div className="container-x py-10"><SkeletonBlock className="h-64" /></div>}>
      <Stylist />
    </Suspense>
  );
}

function Stylist() {
  const store = useStore();
  const params = useSearchParams();
  const p = store.profile;
  const [text, setText] = useState("");
  const [occasion, setOccasion] = useState<Occasion>((params.get("occasion") as Occasion) || "office");
  const [style, setStyle] = useState<StyleTag | "">((params.get("style") as StyleTag) || "");
  const [budget, setBudget] = useState<number>(0);
  const [useWardrobe, setUseWardrobe] = useState(false);
  const [recipeId, setRecipeId] = useState<string | undefined>(params.get("recipe") ?? undefined);
  const [allowOver, setAllowOver] = useState(false);
  const [weather, setWeather] = useState<WeatherContext | null>(null);
  const [liveWeather, setLiveWeather] = useState<{ available: boolean; weather: WeatherContext | null } | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialised = useRef(false);
  useEffect(() => {
    if (!p || initialised.current) return;
    initialised.current = true;
    setBudget(p.budget.perOutfit);
    if (!params.get("style")) setStyle(p.style.styles.includes("smart-casual") ? "smart-casual" : p.style.styles[0] ?? "");
  }, [p, params]);

  useEffect(() => {
    if (!p?.city) return;
    fetch(`/api/weather?city=${encodeURIComponent(p.city)}`).then((r) => r.json()).then(setLiveWeather).catch(() => setLiveWeather(null));
  }, [p?.city]);

  const run = useCallback(
    async (opts?: { text?: string }) => {
      if (!store.profile) return;
      setLoading(true);
      setError(null);
      try {
        const body = opts?.text
          ? { text: opts.text, request: { useWardrobe, allowOverBudget: allowOver, weather: weather ?? undefined }, context: store.context() }
          : { request: { budget: budget || store.profile.budget.perOutfit, occasion, style: style || undefined, recipeId, useWardrobe, allowOverBudget: allowOver, weather: weather ?? undefined }, context: store.context() };
        const r = await post<Result>("/api/outfits", body);
        setRes(r);
        if (opts?.text) {
          setOccasion(r.request.occasion);
          if (r.request.style) setStyle(r.request.style);
          setBudget(r.request.budget);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't build outfits");
      } finally {
        setLoading(false);
      }
    },
    [store, budget, occasion, style, recipeId, useWardrobe, allowOver, weather],
  );

  // Auto-run once for deep links (?q=, ?occasion=) and right after onboarding.
  const [auto, setAuto] = useState(false);
  useEffect(() => {
    if (auto || !store.ready || !store.profile || !budget) return;
    const q = params.get("q");
    if (q) {
      setText(q);
      void run({ text: q });
      setAuto(true);
    } else if (params.get("welcome") || params.get("occasion") || params.get("recipe")) {
      void run();
      setAuto(true);
    }
  }, [auto, store.ready, store.profile, budget, params, run]);

  if (store.ready && !p) {
    return (
      <div className="container-x py-12">
        <Header />
        <div className="mt-8"><ProfilePrompt what="complete outfits checked against your body, style and budget" /></div>
        <div className="mt-6"><EmptyState title="Outfits need a profile" body="FITIQ doesn't recommend generic looks — every outfit is fitted to your measurements, preferred silhouette and budget." cta={{ href: "/onboarding", label: "Build my style profile" }} /></div>
      </div>
    );
  }

  return (
    <div className="container-x py-8 sm:py-12">
      <Header />
      {params.get("welcome") && p && (
        <div className="card mt-6 flex flex-col gap-3 bg-moss-soft/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <span className="font-semibold">Style DNA saved.</span> {BUILD_LABEL[p.body.build]}, {cmToFeetIn(p.body.heightCm)}, {FIT_LABEL[p.fit.tops].toLowerCase()} tops / {FIT_LABEL[p.fit.bottoms].toLowerCase()} bottoms, {formatINR(p.budget.perOutfit)} per outfit.
          </p>
          <Link href="/profile" className="btn-ghost btn-sm shrink-0">View profile</Link>
        </div>
      )}

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) void run({ text: text.trim() });
        }}
      >
        <label htmlFor="ask" className="sr-only">Describe what you need</label>
        <div className="flex items-center gap-2 rounded-full border border-ink/20 bg-white p-1.5 pl-5 focus-within:border-ink">
          <Icon name="spark" className="h-5 w-5 shrink-0 text-saffron" />
          <input id="ask" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none sm:text-base" placeholder="e.g. Smart-casual office outfit for a slim guy under ₹3000" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
          <button className="btn-primary btn-sm" disabled={loading || !text.trim()}>Build</button>
        </div>
        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
          {EXAMPLES.map((ex) => (
            <button type="button" key={ex} className="chip shrink-0" onClick={() => { setText(ex); void run({ text: ex }); }}>{ex}</button>
          ))}
        </div>
      </form>

      <details className="card mt-5 p-4" open>
        <summary className="cursor-pointer text-sm font-semibold">Or set it up precisely</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div>
            <label className="label" htmlFor="occ">Occasion</label>
            <select id="occ" className="input" value={occasion} onChange={(e) => { setOccasion(e.target.value as Occasion); setRecipeId(undefined); }}>
              {ALL_OCCASIONS.map((o) => <option key={o} value={o}>{OCCASION_LABEL[o]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sty">Style</label>
            <select id="sty" className="input" value={style} onChange={(e) => { setStyle(e.target.value as StyleTag); setRecipeId(undefined); }}>
              <option value="">From my Style DNA</option>
              {ALL_STYLES.map((s) => <option key={s} value={s}>{STYLE_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="bud">Max budget (₹)</label>
            <input id="bud" className="input" type="number" min={300} step={100} value={budget || ""} onChange={(e) => setBudget(Number(e.target.value))} />
          </div>
          <div>
            <p className="label">Weather</p>
            {liveWeather?.weather ? (
              <button type="button" className={`chip ${weather?.source === "provider" ? "chip-on" : ""}`} onClick={() => setWeather(weather?.source === "provider" ? null : liveWeather.weather)}>
                <Icon name="cloud" className="h-3.5 w-3.5" /> {liveWeather.weather.city}: {liveWeather.weather.condition}{liveWeather.weather.tempC !== undefined ? ` ${Math.round(liveWeather.weather.tempC)}°C` : ""}
              </button>
            ) : (
              <select className="input" value={weather?.source === "user" ? weather.condition : ""} onChange={(e) => setWeather(e.target.value ? { condition: e.target.value as WeatherContext["condition"], source: "user", city: p?.city } : null)} aria-label="Weather conditions you expect">
                <option value="">Not specified</option>
                {WEATHER.map((w) => <option key={w} value={w}>I expect: {w}</option>)}
              </select>
            )}
            {!liveWeather?.available && <p className="mt-1 text-[10px] text-ink-mute">No live weather source configured — tell us the conditions.</p>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-ink" checked={useWardrobe} onChange={(e) => setUseWardrobe(e.target.checked)} /> Use what I own ({store.wardrobe.length} items)</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-ink" checked={allowOver} onChange={(e) => setAllowOver(e.target.checked)} /> Allow going over budget</label>
          <button type="button" className="btn-primary btn-sm ml-auto" onClick={() => void run()} disabled={loading || !budget}>Build outfits</button>
        </div>
      </details>

      <section className="mt-10" aria-live="polite">
        {loading && (
          <div className="grid gap-5 lg:grid-cols-3">{[0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-[520px]" />)}</div>
        )}
        {!loading && error && <ErrorState message={error} onRetry={() => void run(text ? { text } : undefined)} />}
        {!loading && !error && res && (
          <>
            {res.parsed && (
              <div className="mb-5 flex flex-wrap items-center gap-1.5">
                <span className="eyebrow mr-1">Understood</span>
                {res.parsed.understood.map((u) => (
                  <span key={u.label} className="chip"><span className="text-ink-mute">{u.label}</span> {u.value}</span>
                ))}
              </div>
            )}
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">{res.recipe.name} recipe · {OCCASION_LABEL[res.request.occasion]} · max {formatINR(res.request.budget)}</p>
                <h2 className="h-display mt-1 text-3xl">{res.outfits.length ? `${res.outfits.length} ways to build it` : "No outfit fits yet"}</h2>
                <p className="mt-1 max-w-2xl text-sm text-ink-soft">{res.recipe.description}</p>
              </div>
              <Link href={`/recipes#${res.recipe.id}`} className="text-sm font-semibold text-ink-soft hover:text-ink">See the recipe →</Link>
            </div>
            {res.outfits.length === 0 ? (
              <EmptyState
                title="Nothing complete fits this budget"
                body={res.message ?? "Try a higher budget, a different occasion, or include pieces you own."}
                cta={res.cheapestPossible ? { onClick: () => { setBudget(Math.ceil(res.cheapestPossible! / 100) * 100); }, label: `Set budget to ${formatINR(Math.ceil(res.cheapestPossible / 100) * 100)}` } : undefined}
              />
            ) : (
              <div className="grid items-start gap-5 lg:grid-cols-3">
                {res.outfits.map((o) => <OutfitCard key={o.id} outfit={o} request={res.request} />)}
              </div>
            )}
            <p className="mt-6 text-[11px] text-ink-mute">Fit, style, budget and colour scores are FITIQ shopping metrics, not measurements or judgements about you. <Link href="/how-scores-work" className="underline">How they work</Link>.</p>
          </>
        )}
        {!loading && !error && !res && p && (
          <EmptyState title="Tell us the occasion and budget" body={`We'll build complete outfits for your ${BUILD_LABEL[p.body.build].toLowerCase()} ${cmToFeetIn(p.body.heightCm)} frame and check each piece's fit risk.`} cta={{ onClick: () => void run(), label: `Build a ${OCCASION_LABEL[occasion].toLowerCase()} outfit under ${formatINR(budget || p.budget.perOutfit)}` }} />
        )}
      </section>
    </div>
  );
}

function Header() {
  return (
    <div>
      <p className="eyebrow">AI Stylist · Outfit budget optimizer</p>
      <h1 className="h-display mt-2 text-4xl sm:text-6xl">The best complete outfit<br className="hidden sm:block" /> within your exact budget.</h1>
    </div>
  );
}
