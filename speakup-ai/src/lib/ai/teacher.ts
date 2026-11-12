/**
 * Free-mode conversational English teacher. It is a transparent, rule-based
 * tutor: it corrects with the grammar engine, explains, praises and asks a
 * relevant follow-up from a topic script. It never pretends to be an LLM.
 */
import { analyse, type GrammarReport } from "@/lib/grammar/engine";
import type { Level } from "@/lib/store/types";

export type TeachingMode = "beginner" | "intermediate" | "advanced";

export interface Topic {
  id: string;
  title: string;
  emoji: string;
  questions: Record<TeachingMode, string[]>;
}

export const TOPICS: Topic[] = [
  {
    id: "daily", title: "Daily life", emoji: "☀️",
    questions: {
      beginner: ["What did you do yesterday?", "What time do you wake up?", "What do you eat for breakfast?", "Where do you live?", "What do you do in the evening?"],
      intermediate: ["Describe a typical weekday for you.", "What's something you do every day that you really enjoy?", "How has your daily routine changed in the last few years?", "What do you usually do on weekends?", "What's the best part of your day, and why?"],
      advanced: ["How do you balance work, learning and personal time?", "What habits have had the biggest impact on your productivity?", "Do you think routines make life boring or more effective?", "How would you redesign your day if you had no obligations?"],
    },
  },
  {
    id: "work", title: "Work & studies", emoji: "💼",
    questions: {
      beginner: ["Do you work or study?", "What is your job?", "What did you study in college?", "Do you like your work?", "How do you go to work?"],
      intermediate: ["What do you enjoy most about your job or studies?", "Describe a challenge you faced at work recently.", "What skills do you use every day?", "Where do you see yourself in five years?"],
      advanced: ["How is technology changing your industry?", "What makes a great manager in your opinion?", "Describe a project you're proud of and what you learned.", "How do you handle disagreements with colleagues?"],
    },
  },
  {
    id: "family", title: "Family & friends", emoji: "👨‍👩‍👧",
    questions: {
      beginner: ["How many people are there in your family?", "What does your father do?", "Who is your best friend?", "What do you do with your family on Sundays?"],
      intermediate: ["Tell me about someone in your family you admire.", "How did you meet your best friend?", "What do you usually do when your family gets together?", "How are families today different from the past?"],
      advanced: ["What are the pros and cons of living in a joint family?", "How should parents balance freedom and discipline?", "How have friendships changed with social media?"],
    },
  },
  {
    id: "food", title: "Food", emoji: "🍛",
    questions: {
      beginner: ["What is your favourite food?", "Can you cook?", "What did you eat for dinner yesterday?", "Do you like spicy food?"],
      intermediate: ["Describe a dish from your hometown and how it's made.", "Do you prefer eating at home or eating out? Why?", "What's the most unusual food you've tried?"],
      advanced: ["How does food reflect a region's culture?", "Should junk food be taxed more heavily?", "How have food delivery apps changed eating habits?"],
    },
  },
  {
    id: "travel", title: "Travel", emoji: "✈️",
    questions: {
      beginner: ["Do you like to travel?", "Where did you go on your last holiday?", "Which city do you want to visit?", "Do you like trains or buses?"],
      intermediate: ["Tell me about the best trip you have taken.", "Do you prefer the mountains or the beach? Why?", "What problems have you faced while travelling?"],
      advanced: ["Does tourism do more harm than good to local communities?", "How would you plan a trip on a very small budget?", "Is travelling alone better than travelling in a group?"],
    },
  },
  {
    id: "tech", title: "Technology", emoji: "📱",
    questions: {
      beginner: ["Do you have a smartphone?", "Which app do you use most?", "Do you use a laptop?", "How many hours do you use your phone every day?"],
      intermediate: ["How does technology help you learn English?", "What's one gadget you couldn't live without?", "Do you think people spend too much time online?"],
      advanced: ["Will AI create more jobs than it replaces?", "How should companies protect user privacy?", "What are the risks of depending too much on technology?"],
    },
  },
  {
    id: "goals", title: "Goals & dreams", emoji: "🎯",
    questions: {
      beginner: ["What do you want to learn this year?", "What is your dream job?", "Why do you want to learn English?"],
      intermediate: ["What's one goal you're working towards right now?", "What would you do if you had a year off?", "Who inspires you, and why?"],
      advanced: ["How do you stay motivated when progress is slow?", "Is it better to have one big goal or many small ones?", "What does success mean to you?"],
    },
  },
];

export function levelToMode(level?: Level): TeachingMode {
  if (!level || level === "beginner" || level === "elementary") return "beginner";
  if (level === "intermediate" || level === "upper-intermediate") return "intermediate";
  return "advanced";
}

const PRAISE: Record<TeachingMode, string[]> = {
  beginner: ["Good attempt!", "Nice try!", "Well done for speaking!", "Good effort!"],
  intermediate: ["Good answer!", "Nice — that was clear.", "Good effort!", "I like that answer."],
  advanced: ["Well put.", "Good point.", "Interesting perspective.", "Clear and well structured."],
};
const PERFECT: Record<TeachingMode, string[]> = {
  beginner: ["Excellent! That sentence is correct. 🎉", "Perfect! No mistakes. 👏"],
  intermediate: ["Great — I didn't spot any common mistakes.", "Excellent, that was accurate."],
  advanced: ["Accurate and natural.", "No errors that I can detect — nicely done."],
};

const pick = <T,>(xs: T[], seed: number) => xs[Math.abs(seed) % xs.length];

/** Builds a follow-up question from what the learner said. */
export function followUp(text: string, mode: TeachingMode, seed = 0): string | null {
  const lower = text.toLowerCase();
  const m = lower.match(/\b(?:i|we) (?:like|love|enjoy|prefer) (\w+(?: \w+)?)/);
  if (m) return mode === "beginner" ? `Why do you like ${m[1]}?` : `What is it about ${m[1]} that you enjoy so much?`;
  const went = lower.match(/\b(?:went|visited|travelled|traveled) to (?:the )?(\w+(?: \w+)?)/);
  if (went) return mode === "beginner" ? `Who did you go to ${went[1]} with?` : `What was the most memorable part of going to ${went[1]}?`;
  const work = lower.match(/\b(?:work|working) (?:as|in|at) (?:an? |the )?(\w+(?: \w+)?)/);
  if (work) return mode === "beginner" ? `What do you do every day in ${work[1]}?` : `What is the most challenging part of working ${lower.includes(" as ") ? "as a" : "in"} ${work[1]}?`;
  const want = lower.match(/\b(?:want|plan|hope|would like) to (\w+(?: \w+)?)/);
  if (want) return `That's a great goal. What is your first step to ${want[1]}?`;
  if (seed % 3 === 0 && text.split(" ").length < 8) return mode === "beginner" ? "Can you tell me a little more? Try to say two or three sentences." : "Could you expand on that with an example?";
  return null;
}

export interface TeacherReply {
  text: string;
  report: GrammarReport;
  nextQuestion: string;
}

export function teacherReply(input: { text: string; source: "voice" | "text"; mode: TeachingMode; topic: Topic; turn: number; hindi?: boolean }): TeacherReply {
  const report = analyse(input.text, { source: input.source });
  const real = report.issues.filter((i) => i.category !== "filler" && i.category !== "punctuation");
  const qs = input.topic.questions[input.mode];
  const nextQuestion = followUp(input.text, input.mode, input.turn) ?? qs[(input.turn + 1) % qs.length];
  const parts: string[] = [];
  if (!real.length) {
    parts.push(pick(PERFECT[input.mode], input.turn));
    if (report.professional !== report.corrected && input.mode !== "beginner") parts.push(`A more professional way to say it: "${report.professional}"`);
  } else {
    parts.push(pick(PRAISE[input.mode], input.turn));
    parts.push(`Correct sentence: "${report.corrected}"`);
    const main = real.slice(0, input.mode === "beginner" ? 1 : 2);
    parts.push("Why? " + main.map((i) => i.message).join(" "));
    if (input.hindi) parts.push(main.map((i) => i.hi).join(" "));
  }
  if (report.fillerCount >= 2) parts.push(`Tip: you said ${report.fillerCount} filler words. A short silent pause sounds more confident.`);
  parts.push(nextQuestion);
  return { text: parts.join("\n"), report, nextQuestion };
}
