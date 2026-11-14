import { test, expect, type Page } from "@playwright/test";

/** Switch the answer box to typing when the browser offers voice input first. */
async function typeMode(page: Page) {
  const btn = page.getByRole("button", { name: "Switch to typing" });
  if (await btn.count()) await btn.first().click();
}

async function onboard(page: Page, name = "Priya") {
  await page.goto("/start");
  await page.getByPlaceholder("Your first name").fill(name);
  for (let i = 0; i < 12; i++) {
    const finish = page.getByRole("button", { name: /Build my plan/ });
    if (await finish.count()) {
      await finish.click();
      break;
    }
    await page.getByRole("button", { name: /Continue/ }).click();
  }
  await page.waitForURL(/\/dashboard/);
}

test("landing page has all key sections and CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Stop Hesitating/ })).toBeVisible();
  for (const s of ["Your complete English-speaking toolkit", "Ten focused minutes a day", "A guided program with measurable milestones", "Free to learn. Premium later, optional.", "Questions, answered honestly"]) {
    await expect(page.getByText(s)).toBeVisible();
  }
  await expect(page.getByText("Sample testimonial").first()).toBeVisible();
  await page.getByRole("link", { name: /Start Learning/ }).first().click();
  await expect(page).toHaveURL(/\/start/);
});

test("guest onboarding leads to a personalised dashboard and data persists after reload", async ({ page }) => {
  await onboard(page, "Arjun");
  await expect(page.getByText(/Ready to speak, Arjun/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Ready to speak, Arjun/)).toBeVisible();
});

test("grammar coach corrects a sentence and tracks the mistake", async ({ page }) => {
  await page.goto("/grammar");
  await page.getByPlaceholder(/Type or speak a sentence/).fill("Yesterday I go to office.");
  await page.getByRole("button", { name: "Check grammar" }).click();
  await expect(page.getByText("Yesterday I went to the office.").first()).toBeVisible();
  await page.getByRole("tab", { name: /My mistakes/ }).click();
  await expect(page.getByText("Yesterday I go to office.").first()).toBeVisible();
});

test("speaking teacher replies in free mode with correction and score", async ({ page }) => {
  await onboard(page);
  await page.goto("/speak");
  await page.getByRole("tab", { name: /Chat & type/ }).click();
  await typeMode(page);
  await page.getByLabel("Your answer").fill("Yesterday I go to office and work on tickets.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/Correct sentence/).first()).toBeVisible();
  await expect(page.getByText(/Score \d+\/100/)).toBeVisible();
  await expect(page.getByText("Free coach").first()).toBeVisible();
});

test("30-day challenge day 1 can be completed and updates streak & XP", async ({ page }) => {
  await onboard(page);
  await page.goto("/challenge/1");
  await typeMode(page);
  await page.getByLabel("Your answer").fill("Hi, I'm Priya. I'm from Nagpur and I currently work as a support engineer. In my free time I play badminton. My goal is to speak English confidently in meetings.");
  await page.getByRole("button", { name: /Submit & get score/ }).click();
  await expect(page.getByText(/Day 1 badge earned/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Share on WhatsApp|WhatsApp/ }).first()).toHaveAttribute("href", /wa\.me/);
  await page.goto("/challenge");
  await expect(page.getByText("1/30 completed")).toBeVisible();
  await expect(page.getByTitle("Current daily streak")).toContainText("1");
});

test("vocabulary: save word, flashcard review and quiz", async ({ page }) => {
  await onboard(page);
  await page.goto("/vocabulary");
  await page.getByRole("tab", { name: "Word lists" }).click();
  await page.getByRole("button", { name: "Save word" }).first().click();
  await page.getByRole("tab", { name: /Flashcards/ }).click();
  await page.getByRole("button", { name: "Flip card" }).click();
  await page.getByRole("button", { name: /I knew it/ }).click();
  await expect(page.getByText(/All caught up/)).toBeVisible();
  await page.getByRole("tab", { name: /Daily quiz/ }).click();
  await expect(page.getByText(/What does this word mean/)).toBeVisible();
});

test("IELTS reading: answer, submit and get a band estimate", async ({ page }) => {
  await onboard(page);
  await page.goto("/ielts/reading");
  await page.getByRole("button", { name: /Practice \(untimed\)/ }).click();
  await page.getByRole("radio", { name: "C" }).first().click();
  await page.getByRole("button", { name: "Submit" }).first().click();
  await expect(page.getByText(/Reading result/)).toBeVisible();
  await expect(page.getByText(/not an official IELTS score/).first()).toBeVisible();
});

test("IELTS writing evaluation shows four criteria", async ({ page }) => {
  await onboard(page);
  await page.goto("/ielts/writing");
  await page.getByText("Opinion essay").click();
  const essay = Array(6).fill("In my opinion, free university education is beneficial because it gives talented students an opportunity. However, it is expensive for governments, so taxes may increase.").join("\n\n");
  await page.getByLabel("Your essay").fill(essay);
  await page.getByRole("button", { name: "Submit for evaluation" }).click();
  for (const c of ["Task Response", "Coherence & Cohesion", "Lexical Resource", "Grammatical Range & Accuracy"]) await expect(page.getByText(c).first()).toBeVisible();
});

test("IELTS listening practice renders sections, map and answer sheet", async ({ page }) => {
  await onboard(page);
  await page.goto("/ielts/listening");
  await page.getByRole("button", { name: /Practice mode/ }).click();
  await expect(page.getByRole("button", { name: /Play audio/ })).toBeVisible();
  await page.getByRole("button", { name: "Section 2" }).first().click();
  await expect(page.getByRole("img", { name: /Map of Greenfield/ })).toBeVisible();
  await page.getByRole("button", { name: "Section 1" }).first().click();
  await page.getByLabel("Answer for question 1").fill("Fernandes");
  await expect(page.getByRole("link", { name: "1", exact: true })).toHaveClass(/bg-brand-500/);
});

test("interview simulator scores an answer out of 100 and produces a report", async ({ page }) => {
  await onboard(page);
  await page.goto("/interview");
  await page.getByLabel("Questions").selectOption("3");
  await page.getByRole("button", { name: /HR Interview/ }).click();
  for (let i = 0; i < 6; i++) {
    const box = page.getByLabel("Your answer");
    if (!(await box.count())) await typeMode(page);
    if (!(await page.getByLabel("Your answer").count())) break;
    await page.getByLabel("Your answer").fill("I'm currently working as a support engineer with two years of experience. For example, in my last project I resolved forty tickets a day, and as a result my team met its SLA targets. I learned to stay calm under pressure.");
    await page.getByRole("button", { name: "Submit answer" }).click();
    await expect(page.getByText(/Grammar corrections/)).toBeVisible();
    const next = page.getByRole("button", { name: /Next question|Finish & see report/ });
    const label = await next.textContent();
    await next.click();
    if (label?.includes("Finish")) break;
  }
  await expect(page.getByText("Interview report")).toBeVisible();
});

test("progress, community and settings pages load", async ({ page }) => {
  await onboard(page);
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Your Progress" })).toBeVisible();
  await page.getByRole("tab", { name: "IELTS Preparation" }).click();
  await page.goto("/community");
  await expect(page.getByText("Challenge a friend")).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByText("AI mode (optional)")).toBeVisible();
  await expect(page.locator("main").getByText(/Guest mode/).first()).toBeVisible();
});

test("challenge-a-friend link works without an account", async ({ page }) => {
  await page.goto("/challenge-friend?d=3&n=Ravi&s=72");
  await expect(page.getByText("Ravi challenged you!")).toBeVisible();
  await expect(page.getByText(/They scored 72\/100/)).toBeVisible();
});

test("AI endpoint falls back gracefully without a provider", async ({ request }) => {
  const res = await request.post("/api/ai/chat", { data: { task: "grammar", messages: [{ role: "user", content: "I goes" }], consent: true } });
  expect(res.status()).toBe(503);
  expect((await res.json()).fallback).toBe(true);
  const bad = await request.post("/api/ai/chat", { data: { task: "grammar", messages: [{ role: "user", content: "x" }] } });
  expect(bad.status()).toBe(400);
});

test("admin APIs reject unauthenticated access", async ({ request }) => {
  const res = await request.get("/api/admin/stats");
  expect([401, 403, 503]).toContain(res.status());
});

test("PWA manifest and service worker are served", async ({ request }) => {
  const m = await request.get("/manifest.webmanifest");
  expect(m.ok()).toBeTruthy();
  expect((await m.json()).short_name).toBe("SpeakUp AI");
  expect((await request.get("/sw.js")).ok()).toBeTruthy();
});

test("no horizontal overflow on key pages (mobile)", async ({ page }) => {
  await onboard(page);
  for (const p of ["/dashboard", "/foundation", "/foundation/tense-review", "/speak", "/challenge", "/ielts", "/interview", "/vocabulary", "/progress", "/community", "/profile"]) {
    await page.goto(p);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, p).toBeLessThanOrEqual(1);
  }
});

test("foundation course: overview lists 28 lessons across grammar, verbs, adjectives and tenses", async ({ page }) => {
  await onboard(page);
  await page.goto("/foundation");
  await expect(page.getByRole("heading", { name: "Spoken English Foundation Course" })).toBeVisible();
  for (const t of ["Unit 1 · Building blocks", "Unit 2 · Verbs", "Unit 3 · Describing words", "Unit 4 · Tenses", "Unit 5 · Sentence skills"]) await expect(page.getByText(t)).toBeVisible();
  await expect(page.getByText("0/28 lessons")).toBeVisible();
});

test("foundation lesson: learn → practise (6 exercises) → speak, and progress is saved", async ({ page }) => {
  await onboard(page);
  await page.goto("/foundation/verb-to-be");
  await expect(page.getByText(/I am · he\/she\/it is/)).toBeVisible();
  // Hindi speakers get English + Hindi by default; the toggle hides/shows it.
  await expect(page.getByText(/I के साथ am/)).toBeVisible();
  await page.getByRole("button", { name: /हिंदी/ }).click();
  await expect(page.getByText(/I के साथ am/)).toBeHidden();
  await page.getByRole("button", { name: /Start practice/ }).click();
  // Exercise 1 (fill): correct answer.
  await page.getByLabel("Your answer").fill("is");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("✅ Correct!")).toBeVisible();
  await page.getByRole("button", { name: /^Next/ }).click();
  // Exercises 2–6: answer anything to move through (wrong answers show the correct one).
  for (let i = 0; i < 5; i++) {
    if (await page.getByLabel("Your answer").count()) {
      await page.getByLabel("Your answer").fill("xyz");
      await page.getByRole("button", { name: "Check" }).click();
    } else if (await page.getByText("Put the words in the correct order").count()) {
      const words = page.locator(".card button.rounded-lg:not([disabled])");
      while (await words.count()) await words.first().click();
      await page.getByRole("button", { name: "Check" }).click();
    } else {
      await page.locator(".card .grid button").first().click();
    }
    await page.getByRole("button", { name: /Next|Finish practice/ }).click();
  }
  await expect(page.getByText(/Practice complete: \d+% correct/)).toBeVisible();
  await expect(page.getByText("Speaking drill", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Next lesson: Have, has, had/ })).toBeVisible();
  await page.goto("/foundation");
  await expect(page.getByText("1/28 lessons")).toBeVisible();
});

test("mobile 'More' menu reaches every section", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await onboard(page);
  await page.getByRole("button", { name: "More sections" }).click();
  for (const l of ["IELTS", "Interview", "Grammar", "Vocabulary", "Progress", "Community", "Settings"]) await expect(page.getByRole("dialog").getByRole("link", { name: l })).toBeVisible();
  await page.getByRole("dialog").getByRole("link", { name: "Interview" }).click();
  await expect(page).toHaveURL(/\/interview/);
});

test("daily needs vocabulary: 50-word goal, study 10 picture words, pass the quick test", async ({ page }) => {
  await onboard(page);
  await page.goto("/vocabulary");
  await expect(page.getByText("Learn 50 new everyday words today")).toBeVisible();
  for (const t of ["Animals", "Fruits", "Plants & trees"]) await expect(page.getByRole("button", { name: new RegExp(t) }).first()).toBeVisible();
  await page.getByRole("button", { name: /Start 10 words/ }).click();
  // Read the 10 study cards (word + Hindi).
  const cards = page.locator(".card:has(p.font-bold.break-words)");
  await expect(cards).toHaveCount(10);
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < 10; i++) pairs.push([(await cards.nth(i).locator("p.font-bold").textContent())!.trim(), (await cards.nth(i).locator("p[lang=hi]").textContent())!.trim()]);
  await page.getByRole("button", { name: /test me/ }).click();
  for (let i = 0; i < 25; i++) {
    if (await page.getByText(/words learned$/).count()) break;
    const isPic = await page.getByText("Which word is this?").count();
    let answer: string;
    if (isPic) {
      const hi = (await page.locator(".card p.text-lg[lang=hi]").textContent())!.trim();
      answer = pairs.find((p) => p[1] === hi)![0];
    } else {
      const word = (await page.locator(".card p.text-3xl").textContent())!.trim();
      answer = pairs.find((p) => p[0] === word)![1];
    }
    await page.getByRole("radio", { name: answer, exact: true }).click();
    await page.getByRole("button", { name: "Next" }).click();
  }
  await expect(page.getByText("10/10 words learned")).toBeVisible();
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByRole("img", { name: /10 out of 50/ })).toBeVisible();
  await page.getByRole("tab", { name: /Flashcards/ }).click();
  await expect(page.getByText(/All caught up|No cards are due/).first()).toBeVisible();
});

test("daily needs vocabulary: choose topics and change the goal", async ({ page }) => {
  await onboard(page);
  await page.goto("/vocabulary");
  await page.getByLabel("Daily word goal").selectOption("20");
  await expect(page.getByText("Learn 20 new everyday words today")).toBeVisible();
  await page.getByRole("button", { name: /🐘 Animals/ }).first().click();
  await page.getByRole("button", { name: /🍎 Fruits/ }).first().click();
  await expect(page.getByText("Only selected topics are used.")).toBeVisible();
  await expect(page.getByText(/Today's words \(0\/20\)/)).toBeVisible();
  await page.getByRole("button", { name: /Animals.*learned/ }).click();
  await expect(page.getByText(/🐘 Animals · 0\/35/)).toBeVisible();
});

test("voice input: Android-style cumulative results do not repeat the sentence, and the teacher's voice stops when the mic starts", async ({ page }) => {
  await page.addInitScript(() => {
    // Fake SpeechRecognition that behaves like Chrome on Android: cumulative + duplicated finals.
    const steps = [
      [{ t: "yesterday I go", f: false }],
      [{ t: "yesterday I go", f: true }],
      [{ t: "yesterday I go", f: true }, { t: "yesterday I go to office", f: true }],
      [{ t: "yesterday I go", f: true }, { t: "yesterday I go to office", f: true }, { t: "yesterday I go to office", f: true }],
    ];
    (window as unknown as { __cancelled: number }).__cancelled = 0;
    const realCancel = window.speechSynthesis?.cancel.bind(window.speechSynthesis);
    if (window.speechSynthesis) window.speechSynthesis.cancel = () => { (window as unknown as { __cancelled: number }).__cancelled++; realCancel?.(); };
    class FakeRec {
      lang = ""; continuous = false; interimResults = false; maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null; onerror: ((e: unknown) => void) | null = null; onend: (() => void) | null = null; onstart: (() => void) | null = null;
      private stopped = false;
      start() {
        setTimeout(() => this.onstart?.(), 10);
        steps.forEach((s, i) => setTimeout(() => {
          if (this.stopped) return;
          const results = s.map((r) => Object.assign([{ transcript: r.t, confidence: 0.9 }], { isFinal: r.f, length: 1 }));
          this.onresult?.({ resultIndex: 0, results: Object.assign(results, { length: results.length }) });
        }, 60 * (i + 1)));
      }
      stop() { this.stopped = true; setTimeout(() => this.onend?.(), 10); }
      abort() { this.stop(); }
    }
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRec;
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRec;
  });
  await page.goto("/grammar");
  await page.getByRole("button", { name: /Speak instead/ }).click();
  const cancelledBefore = await page.evaluate(() => (window as unknown as { __cancelled: number }).__cancelled);
  await page.getByRole("button", { name: "Start speaking" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Stop recording" }).click();
  const box = page.locator("[aria-live=polite]").filter({ hasText: "yesterday" }).first();
  await expect(box).toHaveText(/^\s*yesterday I go to office\s*$/);
  expect(await page.evaluate(() => (window as unknown as { __cancelled: number }).__cancelled)).toBeGreaterThan(cancelledBefore);
  await page.getByRole("button", { name: /Check grammar/ }).click();
  await expect(page.getByText("Yesterday I went to the office.").first()).toBeVisible();
});

test("voice coach: hands-free conversation — coach speaks, listens, corrects, asks again", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const spoken: string[] = [];
    w.__spoken = spoken;
    // Instant fake text-to-speech.
    const fakeSynth = {
      speak(u: SpeechSynthesisUtterance) { spoken.push(u.text); setTimeout(() => { u.onstart?.(new Event("start") as SpeechSynthesisEvent); setTimeout(() => u.onend?.(new Event("end") as SpeechSynthesisEvent), 20); }, 10); },
      cancel() {}, pause() {}, resume() {}, getVoices: () => [], addEventListener() {}, removeEventListener() {}, speaking: false, pending: false, paused: false,
    };
    Object.defineProperty(window, "speechSynthesis", { value: fakeSynth, configurable: true });
    // Fake recogniser: each listening turn hears the next answer, then silence.
    const answers = ["yesterday I go to office", "I like cricket because it is exciting"];
    let calls = 0;
    w.__recStarts = 0;
    class FakeRec {
      lang = ""; continuous = false; interimResults = false; maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null; onerror: ((e: unknown) => void) | null = null; onend: (() => void) | null = null; onstart: (() => void) | null = null;
      start() {
        (w.__recStarts as number)++;
        const text = answers[calls++] ?? "";
        setTimeout(() => this.onstart?.(), 10);
        if (text) setTimeout(() => {
          const res = Object.assign([{ transcript: text, confidence: 0.9 }], { isFinal: true, length: 1 });
          this.onresult?.({ resultIndex: 0, results: Object.assign([res], { length: 1 }) });
        }, 80);
      }
      stop() { setTimeout(() => this.onend?.(), 10); }
      abort() { this.stop(); }
    }
    w.webkitSpeechRecognition = FakeRec;
    w.SpeechRecognition = FakeRec;
  });
  await onboard(page);
  await page.goto("/speak");
  await expect(page.getByRole("tab", { name: /Voice coach/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: /Short pauses/ }).click();
  await page.getByRole("button", { name: "Start conversation" }).click();
  // Coach greeted and asked a question out loud, then started listening by itself.
  await expect(page.getByText(/I'm your English coach/)).toBeVisible();
  // First answer is heard, the pause ends the turn, and the coach corrects it out loud.
  await expect(page.getByText("yesterday I go to office")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Correct sentence: "Yesterday I went to the office\."/)).toBeVisible({ timeout: 10000 });
  // Second turn happens hands-free.
  await expect(page.getByText(/Score \d+\/100/)).toHaveCount(2, { timeout: 10000 });
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.join(" | "));
  expect(spoken).toContain("The correct sentence is: Yesterday I went to the office.");
  expect(spoken).not.toMatch(/[\u0900-\u097F]/);
  expect(await page.evaluate(() => (window as unknown as { __recStarts: number }).__recStarts)).toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: "End" }).click();
  await expect(page.getByText("Great conversation!")).toBeVisible();
  await expect(page.getByText(/2 answers/)).toBeVisible();
});
