import { describe, it, expect } from "vitest";
import { analyse } from "@/lib/grammar/engine";

const fix = (s: string) => analyse(s).corrected;

describe("grammar engine", () => {
  it.each([
    ["Yesterday I go to office.", "Yesterday I went to the office."],
    ["He go to school every day.", "He goes to school every day."],
    ["She have two cars.", "She has two cars."],
    ["I am engineer.", "I am an engineer."],
    ["I didn't went there.", "I didn't go there."],
    ["I have went to Delhi.", "I have gone to Delhi."],
    ["We discussed about the project.", "We discussed the project."],
    ["I am having 3 years experience in support.", "I have 3 years of experience in support."],
    ["I am working here since 2019.", "I have been working here since 2019."],
    ["Myself Rahul.", "My name is Rahul."],
    ["He said me to come.", "He told me to come."],
    ["Can you give me some informations?", "Can you give me some information?"],
    ["Where you are going?", "Where are you going?"],
    ["This is more better.", "This is better."],
    ["I am agree with you.", "I agree with you."],
    ["One of my friend is a doctor.", "One of my friends is a doctor."],
    ["I listen music in morning.", "I listen to music in the morning."],
    ["i like english.", "I like English."],
    ["I bought an car.", "I bought a car."],
    ["Tomorrow I go to Mumbai.", "Tomorrow I will go to Mumbai."],
    ["They is happy.", "They are happy."],
    ["Yesterday I go to office and discuss about the project.", "Yesterday I went to the office and discussed the project."],
    ["Last week we visited Pune and meet my uncle.", "Last week we visited Pune and met my uncle."],
  ])("%s", (input, expected) => {
    expect(fix(input)).toBe(expected);
  });

  it("leaves correct sentences alone", () => {
    for (const s of [
      "I went to the office yesterday.",
      "She works as a developer.",
      "I like it very much.",
      "Let it go.",
      "I am having lunch with my team.",
      "If I were you, I would apply.",
      "I saw it happen.",
      "He has an HR interview today.",
      "Did they play cricket yesterday?",
      "Yesterday I went home and decided to rest.",
      "I like tea and coffee.",
      "Ravi and I are friends.",
      "My wife and I were in Goa last year.",
    ]) {
      const r = analyse(s);
      expect(r.issues, s + " -> " + r.corrected).toHaveLength(0);
    }
  });

  it("scores accuracy proportionally", () => {
    expect(analyse("Yesterday I go to office and discuss about the project.").score).toBeGreaterThan(20);
    expect(analyse("Yesterday I went to the office and discussed the project.").score).toBe(100);
  });

  it("counts fillers in voice mode", () => {
    const r = analyse("um I basically uh work in support", { source: "voice" });
    expect(r.fillerCount).toBe(3);
    expect(r.corrected).toBe("I basically work in support.");
  });
});
