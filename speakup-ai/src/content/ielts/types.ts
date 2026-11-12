export type QuestionType = "mcq" | "gap" | "tfng" | "ynng" | "match" | "map";

export interface Question {
  id: number;
  type: QuestionType;
  prompt: string;
  /** For mcq: option texts (answer is the letter). For match/map: allowed letters. */
  options?: string[];
  /** Accepted answers separated by "|". For mcq/match/map: a letter. */
  answer: string;
  explanation?: string;
}

export interface QuestionGroup {
  instructions: string;
  /** Shared option list shown once for the group (e.g. a list of headings or people). */
  optionList?: Array<{ key: string; text: string }>;
  questions: Question[];
  /** Optional diagram id rendered by the UI (e.g. a map). */
  diagram?: string;
}

export interface ListeningSection {
  id: number;
  title: string;
  context: string;
  speakers: Record<string, "female" | "male">;
  script: Array<{ speaker: string; text: string }>;
  groups: QuestionGroup[];
}

export interface ReadingPassage {
  id: string;
  title: string;
  /** Paragraphs; optional label (A, B, C...) for matching tasks. */
  paragraphs: Array<{ label?: string; text: string }>;
  groups: QuestionGroup[];
}

export interface ReadingTest {
  id: string;
  variant: "academic" | "general";
  title: string;
  minutes: number;
  passages: ReadingPassage[];
}

export function countQuestions(groups: QuestionGroup[]) {
  return groups.reduce((n, g) => n + g.questions.length, 0);
}
