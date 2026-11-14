import { describe, it, expect } from "vitest";
import { collapseRepeats, joinWithOverlap, mergeSession, type RawResult } from "@/lib/speech/transcript";

const F = (text: string, confidence = 0.9): RawResult => ({ final: true, text, confidence });
const I = (text: string): RawResult => ({ final: false, text, confidence: 0 });

describe("speech transcript merging", () => {
  it("desktop Chrome: separate final phrases are joined once", () => {
    expect(mergeSession([F("Yesterday I went to the office"), F(" and met my manager")]).final).toBe("Yesterday I went to the office and met my manager");
  });

  it("Android Chrome: cumulative final results do not repeat the sentence", () => {
    const r = mergeSession([F("I go"), F("I go to"), F("I go to office"), F("I go to office every day")]);
    expect(r.final).toBe("I go to office every day");
  });

  it("the same final result delivered twice is kept once", () => {
    expect(mergeSession([F("my name is Priya"), F("my name is Priya")]).final).toBe("my name is Priya");
    expect(mergeSession([F("my name is Priya"), F("my name is Priya"), F("I live in Pune")]).final).toBe("my name is Priya I live in Pune");
  });

  it("interim text only shows the new words", () => {
    const r = mergeSession([F("I work in"), I("I work in a bank")]);
    expect(r.final).toBe("I work in");
    expect(r.interim).toBe("a bank");
  });

  it("overlapping phrase boundaries are merged", () => {
    expect(joinWithOverlap("I usually go to the gym", "the gym in the evening")).toBe("I usually go to the gym in the evening");
  });

  it("a session restart that re-sends the last phrase is not duplicated", () => {
    const committed = "I am a support engineer";
    expect(joinWithOverlap(committed, "I am a support engineer")).toBe("I am a support engineer");
    expect(joinWithOverlap(committed, "support engineer at Infosys")).toBe("I am a support engineer at Infosys");
  });

  it("keeps genuinely new speech and natural single-word repeats", () => {
    expect(joinWithOverlap("I like tea", "I like coffee too")).toBe("I like tea I like coffee too");
    expect(joinWithOverlap("very", "very good")).toBe("very good");
    expect(mergeSession([F("it is very very hot")]).final).toBe("it is very very hot");
  });

  it("collapses an accidentally repeated sentence", () => {
    expect(collapseRepeats("I am Rahul from Pune I am Rahul from Pune")).toBe("I am Rahul from Pune");
    expect(collapseRepeats("I go to the office I go to the office every day")).toBe("I go to the office every day");
    expect(collapseRepeats("one two three")).toBe("one two three");
  });

  it("confidence is counted once per unique phrase", () => {
    const r = mergeSession([F("hello there", 0.8), F("hello there", 0.8), F("how are you", 0.6)]);
    expect(r.confidences).toEqual([0.8, 0.6]);
  });
});

import { chunkForSpeech } from "@/lib/speech/useSpeechSynthesis";
import { toSpoken } from "@/components/voice/VoiceCoach";
describe("voice coach speech", () => {
  it("speaks corrections naturally and skips Hindi script", () => {
    const written = 'Good attempt!\nCorrect sentence: "Yesterday I went to the office."\nWhy? Use \'went\' here.\n\'Yesterday\' के साथ past\nWhat did you do next?';
    expect(toSpoken(written)).toBe("Good attempt! The correct sentence is: Yesterday I went to the office. Use 'went' here. What did you do next?");
  });
  it("splits long messages into sentence chunks under ~160 characters", () => {
    const text = Array(12).fill("This is a fairly long sentence for the coach to read aloud.").join(" ");
    const chunks = chunkForSpeech(text);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((c) => c.length <= 200)).toBe(true);
    expect(chunks.join(" ")).toBe(text);
  });
});
