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
  for (const p of ["/dashboard", "/speak", "/challenge", "/ielts", "/interview", "/vocabulary", "/progress", "/community", "/profile"]) {
    await page.goto(p);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, p).toBeLessThanOrEqual(1);
  }
});
