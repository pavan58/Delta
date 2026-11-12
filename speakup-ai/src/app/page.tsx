import Link from "next/link";
import {
  ArrowRight, BookOpen, Briefcase, CalendarCheck, Check, ChevronDown, GraduationCap, LineChart, Mic, Share2,
  ShieldCheck, Sparkles, Trophy, Volume2, Wand2,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const FEATURES = [
  { icon: Mic, title: "AI Speaking Teacher", text: "Talk by voice or text. Get instant, friendly corrections and a follow-up question every time." },
  { icon: Wand2, title: "Grammar Coach", text: "See the original, the correct sentence, why it was wrong, and a more professional version." },
  { icon: CalendarCheck, title: "30-Day Confidence Challenge", text: "A guided daily program from self-introductions to a final mock interview." },
  { icon: GraduationCap, title: "IELTS Academic & General", text: "Speaking, Listening, Reading and Writing practice with estimated band scores." },
  { icon: Briefcase, title: "Interview Simulator", text: "HR, fresher, IT helpdesk, AWS, Azure, mainframe and more — scored out of 100." },
  { icon: BookOpen, title: "Vocabulary Builder", text: "Flashcards, spaced repetition and daily quizzes, with Hindi explanations on request." },
  { icon: LineChart, title: "Daily Speaking Score", text: "Track grammar, fluency, vocabulary and speaking minutes. Watch your trend improve." },
  { icon: Share2, title: "Share Your Progress", text: "Create a score card and share it on WhatsApp — only when you choose to." },
];

const STEPS = [
  { n: 1, title: "Tell us about you", text: "Your level, goals and daily time. Takes one minute — no account needed." },
  { n: 2, title: "Practise every day", text: "Speak about a daily topic, answer interview questions or do an IELTS task." },
  { n: 3, title: "Get instant feedback", text: "Corrections, explanations, a better version and a score for every answer." },
  { n: 4, title: "Track your growth", text: "Streaks, badges and before-and-after reports show real, measurable progress." },
];

const WEEKS = [
  { title: "Week 1 · Foundation", text: "Introduce yourself, family, hometown, routine, present & past tense." },
  { title: "Week 2 · No Hesitation", text: "Hobbies, movies, goals, future tense, questions and opinions." },
  { title: "Week 3 · Professional English", text: "Meetings, clients, technical problems, phone, email, HR interview." },
  { title: "Week 4 · Confident Communication", text: "Public speaking, storytelling, group discussion, presentations, final assessment." },
];

const FAQ = [
  { q: "Is SpeakUp AI really free?", a: "Yes. Every lesson, the 30-day challenge, grammar correction, vocabulary, IELTS practice and the interview simulator work in Free Mode with no payment and no API key. An optional Premium plan for advanced AI features may be offered later; billing is not active yet." },
  { q: "Do I need to create an account?", a: "No. You can start as a guest and your progress is saved in this browser. If you clear your browser data, guest progress is lost — create a free account to keep it safely and use it on other devices." },
  { q: "How does voice practice work?", a: "We use your browser's built-in speech recognition (best in Chrome, Edge and Safari). Some browsers send audio to their own speech service to transcribe it. If voice is not supported you can always type your answers." },
  { q: "Are the IELTS band scores official?", a: "No. All bands are automated estimates for practice only. Official IELTS results come only from an official IELTS test. Our practice material is original and not taken from official papers." },
  { q: "Can it check my pronunciation?", a: "Browser transcription lets us estimate clarity (how well your speech was recognised). It is not phoneme-level pronunciation analysis, and we label it as an indicator." },
  { q: "Will I be fluent in 30 days?", a: "Nobody can honestly promise that. The 30-day challenge is a structured program with measurable milestones. Most learners see clear improvement in confidence and accuracy when they practise daily." },
  { q: "Do you store my voice?", a: "No. Voice recordings are not stored. Only the text transcript and your scores are saved — in your browser, or in your account if you sign in." },
];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-base bg-[var(--bg)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted md:flex">
            <a href="#features" className="hover:text-[var(--text)]">Features</a>
            <a href="#challenge" className="hover:text-[var(--text)]">30-Day Challenge</a>
            <a href="#ielts" className="hover:text-[var(--text)]">IELTS</a>
            <a href="#pricing" className="hover:text-[var(--text)]">Pricing</a>
            <a href="#faq" className="hover:text-[var(--text)]">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="btn btn-ghost hidden sm:inline-flex">Log in</Link>
            <Link href="/start" className="btn btn-primary">Start Learning</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_70%_10%,rgba(59,99,246,.18),transparent),radial-gradient(40%_40%_at_10%_80%,rgba(255,154,31,.14),transparent)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-24">
          <div className="fade-in">
            <span className="chip mb-5"><Sparkles size={14} className="text-accent-500" /> Free to start · No credit card</span>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
              Stop Hesitating.<br />
              <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">Start Speaking.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted">
              SpeakUp AI is your personal English coach. Practise speaking every day, fix your grammar instantly, prepare for IELTS and
              crack job interviews — in English, with Hindi explanations when you need them.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/start" className="btn btn-primary px-6 py-3 text-base">Start Learning Free <ArrowRight size={18} /></Link>
              <Link href="/grammar" className="btn btn-secondary px-6 py-3 text-base">Try the Grammar Coach</Link>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted"><ShieldCheck size={16} /> No voice recordings stored. Works on any phone browser.</p>
          </div>
          <HeroDemo />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16">
        <SectionTitle eyebrow="Everything in one app" title="Your complete English-speaking toolkit" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300"><f.icon size={22} /></div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="surface-2 border-y border-base">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <SectionTitle eyebrow="How it works" title="Ten focused minutes a day" />
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n}>
                <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-brand-600 font-bold text-white">{s.n}</div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 30-day */}
      <section id="challenge" className="mx-auto max-w-6xl px-4 py-16">
        <SectionTitle eyebrow="30-Day English Confidence Challenge" title="A guided program with measurable milestones" subtitle="Each day has a learning objective, a short lesson, vocabulary, a speaking task, feedback, a score and a badge. Compare your Day 1 and Day 30 in a before-and-after report." />
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {WEEKS.map((w, i) => (
            <div key={w.title} className="card relative overflow-hidden p-5">
              <div className="absolute right-3 top-2 text-6xl font-black text-brand-500/10">{i + 1}</div>
              <h3 className="font-semibold">{w.title}</h3>
              <p className="mt-2 text-sm text-muted">{w.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* IELTS + Interview */}
      <section id="ielts" className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 md:grid-cols-2">
        <div className="card p-6 md:p-8">
          <GraduationCap className="text-brand-500" size={30} />
          <h2 className="mt-4 text-2xl font-bold">IELTS preparation, Academic & General</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {["Speaking Parts 1, 2 & 3 with cue-card timer", "Listening: 4 sections, original audio scripts", "Reading: T/F/NG, headings, completion & more", "Writing Task 1 & 2 with criteria-based feedback", "Full mock test with overall band estimate", "Target bands 5.0 to 9.0"].map((x) => (
              <li key={x} className="flex gap-2"><Check size={18} className="shrink-0 text-mint-500" /> {x}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">Band scores are automated estimates, not official IELTS results. All material is original.</p>
        </div>
        <div className="card p-6 md:p-8">
          <Briefcase className="text-accent-500" size={30} />
          <h2 className="mt-4 text-2xl font-bold">Job interview simulator</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {["12 categories: HR, Fresher, Desktop Support, AWS, Azure…", "Answer by voice or text, one question at a time", "Grammar fixes and a stronger sample answer", "Scored on communication, grammar, vocabulary, relevance, fluency", "Final report out of 100 you can share"].map((x) => (
              <li key={x} className="flex gap-2"><Check size={18} className="shrink-0 text-mint-500" /> {x}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Progress */}
      <section className="surface-2 border-y border-base">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2">
          <div>
            <SectionTitle align="left" eyebrow="Progress tracking" title="See your improvement, day by day" subtitle="Your dashboard shows today's speaking score, streak, total speaking minutes, grammar trend, vocabulary learned, interview readiness and IELTS band estimates — calculated from your real practice." />
          </div>
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Example score card</p>
              <span className="chip">🔥 12-day streak</span>
            </div>
            {[["Grammar", 85], ["Fluency", 78], ["Vocabulary", 90], ["Pronunciation (est.)", 80]].map(([k, v]) => (
              <div key={k} className="mt-4">
                <div className="mb-1 flex justify-between text-sm"><span>{k}</span><span className="font-semibold">{v}</span></div>
                <div className="h-2 rounded-full bg-[var(--border)]"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${v}%` }} /></div>
              </div>
            ))}
            <p className="mt-4 text-xs text-muted">Illustration only.</p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionTitle eyebrow="What learners could say" title="Built for real learners" subtitle="These are sample testimonials written to illustrate typical goals. They are not from real users yet." />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { t: "I used to freeze in stand-up meetings. Practising office conversations every day made me much more comfortable.", n: "Sample: IT support engineer" },
            { t: "The cue-card timer felt like the real speaking test. The band estimate showed me exactly what to work on.", n: "Sample: IELTS candidate" },
            { t: "Hindi explanations helped me understand why my sentences were wrong, not just what to fix.", n: "Sample: Final-year student" },
          ].map((x) => (
            <figure key={x.n} className="card p-5">
              <span className="chip mb-3">Sample testimonial</span>
              <blockquote className="text-sm">“{x.t}”</blockquote>
              <figcaption className="mt-3 text-sm font-semibold text-muted">— {x.n}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="surface-2 border-y border-base">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <SectionTitle eyebrow="Pricing" title="Free to learn. Premium later, optional." />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="card p-6 ring-2 ring-brand-500">
              <p className="font-semibold text-brand-500">Free</p>
              <p className="mt-2 text-4xl font-extrabold">₹0</p>
              <p className="text-sm text-muted">Forever, for core learning</p>
              <ul className="mt-5 space-y-2 text-sm">
                {["Daily English practice (voice & text)", "Rule-based grammar correction", "30-day challenge & daily speaking score", "IELTS practice in all four skills", "Interview question bank & simulator", "Vocabulary, streaks, badges & progress"].map((x) => (
                  <li key={x} className="flex gap-2"><Check size={18} className="shrink-0 text-mint-500" /> {x}</li>
                ))}
              </ul>
              <Link href="/start" className="btn btn-primary mt-6 w-full">Start free</Link>
            </div>
            <div className="card p-6">
              <p className="font-semibold text-accent-500">Premium · coming later</p>
              <p className="mt-2 text-4xl font-extrabold">₹199<span className="text-base font-medium text-muted">/month (planned)</span></p>
              <p className="text-sm text-muted">Billing is not active. Nothing will be charged.</p>
              <ul className="mt-5 space-y-2 text-sm">
                {["Advanced AI conversations", "Detailed AI IELTS writing & speaking evaluation", "Advanced interview simulation", "Personalised AI learning plans", "Detailed downloadable reports"].map((x) => (
                  <li key={x} className="flex gap-2"><Sparkles size={18} className="shrink-0 text-accent-500" /> {x}</li>
                ))}
              </ul>
              <p className="mt-6 text-xs text-muted">Already have your own AI API key? You can connect it in Settings today and use AI features at your own provider&apos;s cost.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-16">
        <SectionTitle eyebrow="FAQ" title="Questions, answered honestly" />
        <div className="mt-8 space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="card group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                {f.q}
                <ChevronDown size={18} className="transition group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-8 text-center text-white md:p-12">
          <Trophy className="mx-auto" size={36} />
          <h2 className="mt-4 text-3xl font-bold">Your first English conversation is one tap away</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">Start as a guest in under a minute. No sign-up, no card.</p>
          <Link href="/start" className="btn btn-accent mt-6 px-6 py-3 text-base">Start Learning <ArrowRight size={18} /></Link>
        </div>
      </section>

      <footer className="border-t border-base">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between">
          <div>
            <Logo />
            <p className="mt-2">Stop Hesitating. Start Speaking.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/ielts">IELTS</Link>
            <Link href="/interview">Interviews</Link>
          </div>
          <p>© {new Date().getFullYear()} SpeakUp AI. IELTS is a trademark of its owners; SpeakUp AI is not affiliated with them.</p>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ eyebrow, title, subtitle, align = "center" }: { eyebrow: string; title: string; subtitle?: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : ""}>
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-500">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-3 text-muted">{subtitle}</p>}
    </div>
  );
}

function HeroDemo() {
  return (
    <div className="card fade-in mx-auto w-full max-w-md p-4 shadow-xl shadow-brand-900/10">
      <div className="flex items-center gap-2 border-b border-base pb-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-white"><Volume2 size={18} /></div>
        <div>
          <p className="text-sm font-semibold">SpeakUp Teacher</p>
          <p className="text-xs text-muted">Speaking practice · Beginner</p>
        </div>
      </div>
      <div className="space-y-3 py-4 text-sm">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[var(--surface-2)] px-3 py-2">What did you do yesterday?</div>
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-600 px-3 py-2 text-white">Yesterday I go to office.</div>
        <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-[var(--surface-2)] px-3 py-2">
          <p>Good attempt! 👏</p>
          <p className="mt-1"><span className="font-semibold text-mint-500">Correct:</span> Yesterday, I went to the office.</p>
          <p className="mt-1 text-muted">Why? &ldquo;Yesterday&rdquo; is the past, so we use <b>went</b> instead of <b>go</b>.</p>
          <p className="mt-1">Now try another sentence in the past tense.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-base p-2">
        <span className="flex-1 px-2 text-sm text-muted">Tap the mic and speak…</span>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-red-500 text-white"><Mic size={18} /></span>
      </div>
    </div>
  );
}
