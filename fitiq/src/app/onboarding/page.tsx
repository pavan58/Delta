"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore, DEMO_PERSONA } from "@/lib/client/store";
import type { BodyBuild, ColorFamily, FitType, Pattern, StyleTag, UserProfile } from "@/lib/types";
import { ALL_BUILDS, ALL_COLORS, ALL_STYLES, BUILD_BLURB, BUILD_LABEL, COLOR_HEX, COLOR_LABEL, FIT_LABEL, PATTERN_LABEL, STYLE_LABEL, cmToFeetIn, feetInToCm, formatINR } from "@/lib/taxonomy";
import { Icon } from "@/components/Icon";

const STEPS = ["Body", "Fit", "Style DNA", "Budget", "Review"];
const TOP_FITS: FitType[] = ["slim", "regular", "relaxed", "oversized"];
const BOTTOM_FITS: FitType[] = ["slim", "tapered", "straight", "relaxed"];
const FIT_DESC: Partial<Record<FitType, string>> = {
  slim: "Close to the body",
  regular: "Classic room, not tight",
  relaxed: "Easy room through body",
  oversized: "Dropped shoulder, roomy",
  tapered: "Roomy thigh, narrow ankle",
  straight: "Same width hip to hem",
};
const SHIRT_TO_CHEST: Record<string, number> = { S: 37, M: 39, L: 41, XL: 43, XXL: 45 };
const PATTERNS: Pattern[] = ["solid", "stripe", "check", "print", "texture", "embroidered"];
const BRAND_SUGGESTIONS = ["Uniqlo", "H&M", "Levi's", "Snitch", "Van Heusen", "Allen Solly", "U.S. Polo Assn.", "Manyavar", "Roadster", "Puma", "Adidas", "Bewakoof"];

type Draft = Omit<UserProfile, "createdAt" | "updatedAt" | "version">;

const initial: Draft = {
  name: "",
  city: "",
  body: { heightCm: 172, weightKg: 68, waistIn: 32, chestIn: 39, build: "average" },
  fit: { tops: "regular", bottoms: "straight" },
  style: { styles: [], colors: [], avoidColors: [], brands: [], materials: [], patterns: [], shoes: [], accessories: [] },
  budget: { perOutfit: 3000 },
  photoConsent: false,
};

function toggle<T>(arr: T[], v: T) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function Onboarding() {
  const router = useRouter();
  const store = useStore();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(initial);
  const [units, setUnits] = useState<"ft" | "cm">("ft");
  const [brandInput, setBrandInput] = useState("");
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (store.ready && store.profile) {
      const { version: _v, createdAt: _c, updatedAt: _u, ...rest } = store.profile;
      setD(rest);
      setConsent(true);
    }
  }, [store.ready, store.profile]);

  const setBody = (patch: Partial<Draft["body"]>) => setD((x) => ({ ...x, body: { ...x.body, ...patch } }));
  const setStyle = (patch: Partial<Draft["style"]>) => setD((x) => ({ ...x, style: { ...x.style, ...patch } }));
  const ft = Math.floor(d.body.heightCm / 2.54 / 12);
  const inch = Math.round(d.body.heightCm / 2.54 - ft * 12);

  const bodyValid = d.body.heightCm >= 120 && d.body.heightCm <= 230 && d.body.weightKg >= 30 && d.body.waistIn >= 22 && d.body.chestIn >= 28;
  const canNext = [bodyValid, true, d.style.styles.length > 0, d.budget.perOutfit >= 300, consent][step];

  function save() {
    const now = new Date().toISOString();
    store.setProfile({ version: 1, ...d, createdAt: store.profile?.createdAt ?? now, updatedAt: now });
    router.push("/stylist?welcome=1");
  }

  function useDemo() {
    store.loadDemoPersona();
    router.push("/stylist?welcome=1");
  }

  return (
    <div className="container-x max-w-3xl py-8 sm:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My Style DNA · Step {step + 1} of {STEPS.length}</p>
          <h1 className="h-display mt-2 text-4xl sm:text-5xl">{["Your body, in numbers.", "How do you like clothes to sit?", "What does your style look like?", "What do you want to spend?", "Looks right?"][step]}</h1>
        </div>
        {!store.profile && (
          <button onClick={useDemo} className="btn-ghost btn-sm" title={`${BUILD_LABEL[DEMO_PERSONA.body.build]}, ${cmToFeetIn(DEMO_PERSONA.body.heightCm)}, ${formatINR(DEMO_PERSONA.budget.perOutfit)}`}>
            Skip — use demo persona (slim, 5&apos;7&quot;, ₹3,000)
          </button>
        )}
      </div>

      <ol className="mb-8 grid grid-cols-5 gap-1.5" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button onClick={() => i < step && setStep(i)} className="w-full text-left" disabled={i > step}>
              <div className={`h-1 rounded-full ${i <= step ? "bg-ink" : "bg-bone-line"}`} />
              <span className={`mt-1.5 hidden text-[11px] font-medium sm:block ${i === step ? "text-ink" : "text-ink-mute"}`}>{s}</span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="h-ft">Height</label>
                <button className="text-[11px] font-semibold text-saffron-deep" onClick={() => setUnits(units === "ft" ? "cm" : "ft")}>Use {units === "ft" ? "cm" : "ft/in"}</button>
              </div>
              {units === "ft" ? (
                <div className="flex gap-2">
                  <select id="h-ft" className="input" value={ft} onChange={(e) => setBody({ heightCm: feetInToCm(Number(e.target.value), inch) })}>
                    {[4, 5, 6, 7].map((f) => <option key={f} value={f}>{f} ft</option>)}
                  </select>
                  <select aria-label="Inches" className="input" value={inch} onChange={(e) => setBody({ heightCm: feetInToCm(ft, Number(e.target.value)) })}>
                    {Array.from({ length: 12 }).map((_, i) => <option key={i} value={i}>{i} in</option>)}
                  </select>
                </div>
              ) : (
                <input id="h-ft" className="input" type="number" inputMode="numeric" value={d.body.heightCm} onChange={(e) => setBody({ heightCm: Number(e.target.value) })} />
              )}
            </div>
            <NumberField label="Weight (kg)" value={d.body.weightKg} onChange={(v) => setBody({ weightKg: v })} />
            <div>
              <NumberField label='Waist (inches)' value={d.body.waistIn} onChange={(v) => setBody({ waistIn: v })} hint="Your usual jeans size works" />
            </div>
            <div>
              <NumberField label="Chest (inches)" value={d.body.chestIn} onChange={(v) => setBody({ chestIn: v })} />
              <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-ink-mute">
                Don&apos;t know? Usual shirt size:
                {Object.entries(SHIRT_TO_CHEST).map(([s, c]) => (
                  <button key={s} className="rounded border border-bone-line px-1.5 py-0.5 hover:border-ink" onClick={() => setBody({ chestIn: c })}>{s}</button>
                ))}
              </div>
            </div>
            <NumberField label="Shoulder width (inches, optional)" value={d.body.shoulderIn} onChange={(v) => setBody({ shoulderIn: v || undefined })} optional />
            <NumberField label="Shoe size (UK, optional)" value={d.body.shoeUK} onChange={(v) => setBody({ shoeUK: v || undefined })} optional />
            <NumberField label="Inseam (inches, optional)" value={d.body.inseamIn} onChange={(v) => setBody({ inseamIn: v || undefined })} optional hint="Improves length advice for trousers" />
          </div>

          <fieldset>
            <legend className="label">Body build — pick the closest. This only shapes silhouette suggestions.</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ALL_BUILDS.map((b: BodyBuild) => (
                <button key={b} onClick={() => setBody({ build: b })} className={`card p-3 text-left transition ${d.body.build === b ? "border-ink ring-1 ring-ink" : "hover:border-ink/40"}`} aria-pressed={d.body.build === b}>
                  <p className="text-sm font-semibold">{BUILD_LABEL[b]}</p>
                  <p className="mt-0.5 text-[11px] text-ink-mute">{BUILD_BLURB[b]}</p>
                </button>
              ))}
            </div>
          </fieldset>
          <p className="flex items-start gap-2 text-xs text-ink-mute"><Icon name="lock" className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Measurements stay on this device in demo mode and are used only to score fit. You can delete them anytime from Profile.</p>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-8">
          {([["Tops", "tops", TOP_FITS], ["Bottoms", "bottoms", BOTTOM_FITS]] as const).map(([label, key, fits]) => (
            <fieldset key={key}>
              <legend className="label">{label}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {fits.map((f) => (
                  <button key={f} onClick={() => setD((x) => ({ ...x, fit: { ...x.fit, [key]: f } }))} className={`card p-3 text-left ${d.fit[key] === f ? "border-ink ring-1 ring-ink" : "hover:border-ink/40"}`} aria-pressed={d.fit[key] === f}>
                    <FitGlyph fit={f} bottom={key === "bottoms"} />
                    <p className="mt-2 text-sm font-semibold">{FIT_LABEL[f]}</p>
                    <p className="text-[11px] text-ink-mute">{FIT_DESC[f]}</p>
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <p className="text-xs text-ink-mute">FITIQ checks every product against this preference and your build. If a cut doesn&apos;t line up, you&apos;ll see a fit-risk flag and a better-fit alternative.</p>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-7">
          <ChipGroup label="Styles you wear or want to (pick 1–3)" options={ALL_STYLES} value={d.style.styles} render={(s) => STYLE_LABEL[s as StyleTag]} onToggle={(s) => setStyle({ styles: toggle(d.style.styles, s as StyleTag) })} />
          <div>
            <p className="label">Colours you like</p>
            <ColorPicker value={d.style.colors} onToggle={(c) => setStyle({ colors: toggle(d.style.colors, c), avoidColors: d.style.avoidColors.filter((x) => x !== c) })} />
          </div>
          <div>
            <p className="label">Colours to avoid</p>
            <ColorPicker value={d.style.avoidColors} onToggle={(c) => setStyle({ avoidColors: toggle(d.style.avoidColors, c), colors: d.style.colors.filter((x) => x !== c) })} tone="avoid" />
          </div>
          <ChipGroup label="Patterns" options={PATTERNS} value={d.style.patterns} render={(p) => PATTERN_LABEL[p as Pattern]} onToggle={(p) => setStyle({ patterns: toggle(d.style.patterns, p as Pattern) })} />
          <ChipGroup label="Materials" options={["Cotton", "Linen", "Denim", "Wool", "Silk"]} value={d.style.materials} onToggle={(m) => setStyle({ materials: toggle(d.style.materials, m) })} />
          <div>
            <p className="label">Brands you like (optional)</p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(new Set([...BRAND_SUGGESTIONS, ...d.style.brands])).map((b) => (
                <button key={b} className={`chip ${d.style.brands.includes(b) ? "chip-on" : ""}`} onClick={() => setStyle({ brands: toggle(d.style.brands, b) })}>{b}</button>
              ))}
            </div>
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (brandInput.trim()) { setStyle({ brands: [...d.style.brands, brandInput.trim()] }); setBrandInput(""); } }}>
              <input className="input max-w-xs" placeholder="Add another brand" value={brandInput} onChange={(e) => setBrandInput(e.target.value)} maxLength={40} />
              <button className="btn-ghost btn-sm">Add</button>
            </form>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-6">
          <div>
            <p className="label">Per outfit</p>
            <div className="flex flex-wrap gap-2">
              {[1500, 2000, 3000, 5000, 8000, 12000].map((b) => (
                <button key={b} className={`chip px-4 py-2 text-sm ${d.budget.perOutfit === b ? "chip-on" : ""}`} onClick={() => setD((x) => ({ ...x, budget: { ...x.budget, perOutfit: b } }))}>{formatINR(b)}</button>
              ))}
            </div>
            <div className="mt-3 max-w-xs">
              <NumberField label="Or enter an amount (₹)" value={d.budget.perOutfit} onChange={(v) => setD((x) => ({ ...x, budget: { ...x.budget, perOutfit: v } }))} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Monthly clothing budget (₹, optional)" value={d.budget.monthly} onChange={(v) => setD((x) => ({ ...x, budget: { ...x.budget, monthly: v || undefined } }))} optional />
            <div>
              <label className="label" htmlFor="city">City (optional, for weather-aware styling)</label>
              <input id="city" className="input" value={d.city ?? ""} onChange={(e) => setD((x) => ({ ...x, city: e.target.value }))} placeholder="e.g. Pune" maxLength={60} />
            </div>
          </div>
          <p className="text-xs text-ink-mute">FITIQ never recommends an outfit above your selected budget unless you explicitly allow it.</p>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-5">
          <div className="card grid gap-4 p-5 sm:grid-cols-2">
            <Summary label="Body" value={`${cmToFeetIn(d.body.heightCm)} · ${d.body.weightKg} kg · ${BUILD_LABEL[d.body.build]}`} />
            <Summary label="Measurements" value={`Chest ${d.body.chestIn}" · Waist ${d.body.waistIn}"${d.body.shoeUK ? ` · UK ${d.body.shoeUK}` : ""}`} />
            <Summary label="Preferred fit" value={`${FIT_LABEL[d.fit.tops]} tops · ${FIT_LABEL[d.fit.bottoms]} bottoms`} />
            <Summary label="Style" value={d.style.styles.map((s) => STYLE_LABEL[s]).join(", ") || "—"} />
            <Summary label="Colours" value={d.style.colors.map((c) => COLOR_LABEL[c]).join(", ") || "Open to all"} />
            <Summary label="Budget" value={`${formatINR(d.budget.perOutfit)} per outfit${d.budget.monthly ? ` · ${formatINR(d.budget.monthly)}/month` : ""}`} />
          </div>
          <div>
            <label className="label" htmlFor="name">What should we call you? (optional)</label>
            <input id="name" className="input max-w-xs" value={d.name ?? ""} onChange={(e) => setD((x) => ({ ...x, name: e.target.value }))} maxLength={60} />
          </div>
          <label className="flex items-start gap-3 rounded-2xl border border-bone-line bg-white/60 p-4 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-ink" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I agree that FITIQ may use these measurements and preferences to score fit and build outfits. They&apos;re stored on this device, not sold, and deletable anytime. <a href="/privacy" className="underline" target="_blank">Privacy details</a></span>
          </label>
        </section>
      )}

      <div className="mt-10 flex items-center justify-between border-t border-bone-line pt-5">
        <button className="btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</button>
        {step < STEPS.length - 1 ? (
          <button className="btn-primary" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>Continue <Icon name="arrow" className="h-4 w-4" /></button>
        ) : (
          <button className="btn-accent" onClick={save} disabled={!canNext}>Save my Style DNA</button>
        )}
      </div>
      {step === 2 && !canNext && <p className="mt-2 text-right text-xs text-ink-mute">Pick at least one style to continue.</p>}
    </div>
  );
}

function NumberField({ label, value, onChange, optional, hint }: { label: string; value?: number; onChange: (v: number) => void; optional?: boolean; hint?: string }) {
  const id = label.replace(/\W+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input" type="number" inputMode="decimal" step="0.5" value={value ?? ""} placeholder={optional ? "Optional" : undefined} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
      {hint && <p className="mt-1 text-[11px] text-ink-mute">{hint}</p>}
    </div>
  );
}

function ChipGroup({ label, options, value, onToggle, render }: { label: string; options: string[]; value: string[]; onToggle: (v: string) => void; render?: (v: string) => string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o} className={`chip ${value.includes(o) ? "chip-on" : ""}`} onClick={() => onToggle(o)} aria-pressed={value.includes(o)}>{render ? render(o) : o}</button>
        ))}
      </div>
    </div>
  );
}

function ColorPicker({ value, onToggle, tone }: { value: ColorFamily[]; onToggle: (c: ColorFamily) => void; tone?: "avoid" }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ALL_COLORS.filter((c) => c !== "gold" && c !== "silver").map((c) => {
        const on = value.includes(c);
        return (
          <button key={c} onClick={() => onToggle(c)} className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs ${on ? (tone === "avoid" ? "border-risk-high bg-risk-high/10" : "border-ink bg-white") : "border-bone-line bg-white/60"}`} aria-pressed={on}>
            <span className="h-5 w-5 rounded-full border border-black/10" style={{ background: COLOR_HEX[c] }} />
            {COLOR_LABEL[c]}
          </button>
        );
      })}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function FitGlyph({ fit, bottom }: { fit: FitType; bottom: boolean }) {
  const w = { skinny: 8, slim: 11, tapered: 13, regular: 14, straight: 15, relaxed: 18, oversized: 22 }[fit];
  if (bottom) {
    const ankle = fit === "tapered" ? 7 : fit === "slim" ? 8 : w;
    return (
      <svg viewBox="0 0 60 50" className="h-10 w-12 text-ink" aria-hidden>
        <path d={`M${30 - w - 2} 4 L${30 + w + 2} 4 L${30 + 2 + ankle} 46 L32 46 L30 16 L28 46 L${28 - ankle} 46 Z`} fill="currentColor" opacity={0.85} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 60 50" className="h-10 w-12 text-ink" aria-hidden>
      <path d={`M${30 - w} 6 L${30 + w} 6 L${30 + w + 8} 18 L${30 + w + 2} 22 L${30 + w} 46 L${30 - w} 46 L${30 - w - 2} 22 L${30 - w - 8} 18 Z`} fill="currentColor" opacity={0.85} />
    </svg>
  );
}
