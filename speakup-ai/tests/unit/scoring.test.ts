import { describe, it, expect } from "vitest";
import { overallBand, listeningBand, readingBand, isCorrectAnswer, evaluateWriting, criteriaAverage, speakingBand } from "@/lib/scoring/ielts";
import { scoreSpeaking } from "@/lib/scoring/speaking";
import { scoreInterviewAnswer } from "@/lib/scoring/interview";

describe("IELTS bands", () => {
  it("rounds the overall band like IELTS", () => {
    expect(overallBand([6.5, 6.5, 5, 7])).toBe(6.5); // 6.25 -> 6.5
    expect(overallBand([4, 3.5, 4, 4])).toBe(4); // 3.875 -> 4
    expect(overallBand([6, 6, 6, 5.5])).toBe(6); // 5.875 -> 6
    expect(overallBand([6.5, 6.5, 6.5, 6])).toBe(6.5); // 6.375
    expect(overallBand([7, 7, 7, 6.5])).toBe(7); // 6.875 -> 7
    expect(overallBand([6, 6, 6, 6.5])).toBe(6); // 6.125 -> 6
  });
  it("converts listening and reading raw scores", () => {
    expect(listeningBand(30)).toBe(7);
    expect(listeningBand(40)).toBe(9);
    expect(listeningBand(20, 40)).toBe(5.5);
    expect(listeningBand(10, 20)).toBe(5.5);
    expect(readingBand(30, 40, "academic")).toBe(7);
    expect(readingBand(30, 40, "general")).toBe(6);
  });
  it("criteria average rounds down to half band", () => {
    expect(criteriaAverage([6, 7, 6, 6])).toBe(6);
    expect(criteriaAverage([6, 7, 7, 6])).toBe(6.5);
  });
  it("checks answers flexibly", () => {
    expect(isCorrectAnswer(" The Library ", "library")).toBe(true);
    expect(isCorrectAnswer("two", "2")).toBe(true);
    expect(isCorrectAnswer("Tuesday", "tuesday|tues")).toBe(true);
    expect(isCorrectAnswer("", "x")).toBe(false);
  });
});

describe("scores", () => {
  it("rewards a better answer", () => {
    const weak = scoreSpeaking({ transcript: "yesterday i go office. it good", durationSec: 10, input: "text", keywords: ["went", "office"] });
    const strong = scoreSpeaking({
      transcript:
        "Yesterday I went to the office early because we had an important client meeting. I presented our quarterly results, answered several questions and, as a result, the client approved the next phase of the project. In the evening, I celebrated with my team.",
      durationSec: 40, input: "text", keywords: ["went", "office", "meeting"],
    });
    expect(strong.scores.overall).toBeGreaterThan(weak.scores.overall);
    expect(weak.scores.pronunciation).toBeNull();
    expect(strong.scores.overall).toBeGreaterThanOrEqual(60);
  });
  it("estimates pronunciation only from voice confidence", () => {
    const r = scoreSpeaking({ transcript: "I work as a support engineer in Pune and I enjoy solving problems for users", durationSec: 6, input: "voice", confidence: 0.9 });
    expect(r.scores.pronunciation).toBe(94);
    expect(r.scores.wpm).toBeGreaterThan(100);
  });
  it("writing evaluation produces bands 1-9 and feedback", () => {
    const essay = `Some people believe that university education should be free for everyone. In my opinion, this is a beneficial policy, although it has some drawbacks.\n\nFirstly, free education gives talented students from poor families an opportunity to study. For example, in many countries, scholarships have helped thousands of young people become doctors and engineers. As a result, society benefits from their skills.\n\nOn the other hand, governments have limited budgets. If universities are free, taxes may increase, which could affect other public services such as healthcare. However, I believe that investment in education is worth this cost.\n\nIn conclusion, although free university education is expensive, I strongly believe that its long-term benefits outweigh the disadvantages.`;
    const e = evaluateWriting(essay, "task2", ["university", "free", "education"]);
    expect(e.band).toBeGreaterThanOrEqual(5);
    expect(e.band).toBeLessThanOrEqual(9);
    expect(e.paragraphs).toBe(4);
    const empty = evaluateWriting("too short", "task2");
    expect(empty.band).toBe(1);
  });
  it("speaking band caps very short answers", () => {
    expect(speakingBand({ fluency: 100, vocabulary: 100, grammar: 100, pronunciation: null, wordCount: 10 }).band).toBe(3);
  });
  it("interview total is out of 100", () => {
    const r = scoreInterviewAnswer({ answer: "I am a hard worker. For example, in my last job I resolved 40 tickets a day and as a result my team met its targets.", input: "text", durationSec: 0, keywords: ["team", "example"], behavioural: false });
    expect(r.scores.total).toBeGreaterThan(30);
    expect(r.scores.total).toBeLessThanOrEqual(100);
    expect(r.scores.pronunciation).toBeNull();
  });
});
