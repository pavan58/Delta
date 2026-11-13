import { describe, it, expect } from "vitest";
import { FOUNDATION_LESSONS, FOUNDATION_UNITS, getFoundationLesson, nextFoundationLesson } from "@/content/foundation";
import { checkExercise, normaliseSentence, shuffledWords } from "@/lib/foundation/check";
import { analyse } from "@/lib/grammar/engine";

describe("foundation course content", () => {
  it("has 28 lessons across 5 units with unique ids", () => {
    expect(FOUNDATION_LESSONS).toHaveLength(28);
    expect(new Set(FOUNDATION_LESSONS.map((l) => l.id)).size).toBe(28);
    for (const u of FOUNDATION_UNITS) expect(FOUNDATION_LESSONS.some((l) => l.unit === u.id)).toBe(true);
  });

  it("starts with grammar basics, verbs, adjectives, then tenses", () => {
    const ids = FOUNDATION_LESSONS.map((l) => l.id);
    expect(ids.indexOf("verbs-basics")).toBeLessThan(ids.indexOf("adjectives"));
    expect(ids.indexOf("adjectives")).toBeLessThan(ids.indexOf("present-simple"));
    expect(FOUNDATION_LESSONS.filter((l) => l.unit === 4)).toHaveLength(9);
  });

  it.each(FOUNDATION_LESSONS.map((l) => [l.id, l] as const))("%s is complete and well-formed", (_id, l) => {
    expect(l.explain.length).toBeGreaterThanOrEqual(4);
    expect(l.hi.length).toBeGreaterThan(20);
    expect(l.examples.length).toBeGreaterThanOrEqual(3);
    expect(l.mistakes.length).toBeGreaterThanOrEqual(3);
    expect(l.exercises.length).toBeGreaterThanOrEqual(6);
    expect(l.speaking.keywords.length).toBeGreaterThan(2);
    for (const e of l.exercises) {
      if (e.type === "mcq") expect(e.options[e.answer]).toBeDefined();
      if (e.type === "fill") expect(e.q).toContain("___");
      if (e.type === "order") expect(e.answer.split(" ").length).toBeGreaterThanOrEqual(3);
      // The stored answer must be accepted by the checker.
      expect(checkExercise(e, e.type === "mcq" ? e.answer : e.answer.split("|")[0])).toBe(true);
    }
    if (l.table) for (const r of l.table.rows) expect(r.length).toBe(l.table.headers.length);
  });

  it("model answers to 'fix' exercises pass the grammar engine (no tense/agreement errors)", () => {
    for (const l of FOUNDATION_LESSONS)
      for (const e of l.exercises)
        if (e.type === "fix") {
          const r = analyse(e.answer.split("|")[0]);
          const serious = r.issues.filter((i) => ["tense", "agreement", "article", "preposition"].includes(i.category));
          expect(serious, `${l.id}: ${e.answer}`).toHaveLength(0);
        }
  });

  it("navigates to the next lesson", () => {
    expect(nextFoundationLesson("sentence-structure")?.id).toBe("nouns");
    expect(getFoundationLesson("conditionals")?.unit).toBe(5);
    expect(nextFoundationLesson("conditionals")).toBeUndefined();
  });
});

describe("foundation answer checker", () => {
  it("accepts contractions and ignores punctuation/case", () => {
    expect(normaliseSentence("He doesn't like it!")).toBe("he does not like it");
    expect(checkExercise({ type: "fix", q: "", answer: "They are not ready." }, "they aren't ready")).toBe(true);
    expect(checkExercise({ type: "fill", q: "___", answer: "are meeting|'re meeting" }, "Are meeting")).toBe(true);
  });
  it("keeps articles significant", () => {
    expect(checkExercise({ type: "fix", q: "", answer: "I am an engineer." }, "I am engineer.")).toBe(false);
  });
  it("mcq uses the option index", () => {
    expect(checkExercise({ type: "mcq", q: "", options: ["a", "b"], answer: 1 }, 1)).toBe(true);
    expect(checkExercise({ type: "mcq", q: "", options: ["a", "b"], answer: 1 }, 0)).toBe(false);
  });
  it("shuffles words into a different order containing the same words", () => {
    const s = "I usually have breakfast at eight.";
    const w = shuffledWords(s, "x");
    expect([...w].sort()).toEqual("I usually have breakfast at eight".split(" ").sort());
    expect(w.join(" ")).not.toBe("I usually have breakfast at eight");
    expect(shuffledWords(s, "x")).toEqual(w);
    const orig = "I drink coffee every morning".split(" ");
    const moved = shuffledWords("I drink coffee every morning.", "sentence-structure-0").filter((x, i) => x !== orig[i]).length;
    expect(moved).toBeGreaterThanOrEqual(3);
  });
});
