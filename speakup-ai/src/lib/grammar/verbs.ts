/** Verb morphology helpers used by the rule-based grammar engine. */

export interface VerbForms {
  base: string;
  third: string;
  past: string;
  pp: string;
  ing: string;
}

const IRREGULAR: Record<string, [past: string, pp: string]> = {
  be: ["was", "been"], become: ["became", "become"], begin: ["began", "begun"], break: ["broke", "broken"],
  bring: ["brought", "brought"], build: ["built", "built"], buy: ["bought", "bought"], catch: ["caught", "caught"],
  choose: ["chose", "chosen"], come: ["came", "come"], cost: ["cost", "cost"], cut: ["cut", "cut"],
  do: ["did", "done"], draw: ["drew", "drawn"], drink: ["drank", "drunk"], drive: ["drove", "driven"],
  eat: ["ate", "eaten"], fall: ["fell", "fallen"], feel: ["felt", "felt"], fight: ["fought", "fought"],
  find: ["found", "found"], fly: ["flew", "flown"], forget: ["forgot", "forgotten"], get: ["got", "got"],
  give: ["gave", "given"], go: ["went", "gone"], grow: ["grew", "grown"], have: ["had", "had"],
  hear: ["heard", "heard"], hold: ["held", "held"], keep: ["kept", "kept"], know: ["knew", "known"],
  learn: ["learnt", "learnt"], leave: ["left", "left"], lend: ["lent", "lent"], let: ["let", "let"],
  lose: ["lost", "lost"], make: ["made", "made"], meet: ["met", "met"], pay: ["paid", "paid"],
  put: ["put", "put"], read: ["read", "read"], ride: ["rode", "ridden"], ring: ["rang", "rung"],
  run: ["ran", "run"], say: ["said", "said"], see: ["saw", "seen"], sell: ["sold", "sold"],
  send: ["sent", "sent"], set: ["set", "set"], show: ["showed", "shown"], sing: ["sang", "sung"],
  sit: ["sat", "sat"], sleep: ["slept", "slept"], speak: ["spoke", "spoken"], spend: ["spent", "spent"],
  stand: ["stood", "stood"], steal: ["stole", "stolen"], swim: ["swam", "swum"], take: ["took", "taken"],
  teach: ["taught", "taught"], tell: ["told", "told"], think: ["thought", "thought"], throw: ["threw", "thrown"],
  understand: ["understood", "understood"], wake: ["woke", "woken"], wear: ["wore", "worn"], win: ["won", "won"],
  write: ["wrote", "written"],
};

/** Common regular verbs (base forms) the engine recognises. */
const REGULAR = [
  "work", "play", "watch", "call", "visit", "talk", "walk", "start", "finish", "help", "want", "need", "like",
  "love", "live", "move", "join", "complete", "attend", "travel", "study", "try", "cook", "clean", "open",
  "close", "stay", "wait", "ask", "answer", "listen", "learn", "plan", "stop", "use", "change", "decide",
  "enjoy", "explain", "fix", "install", "check", "update", "upgrade", "restart", "solve", "resolve", "submit",
  "prepare", "practise", "practice", "improve", "manage", "handle", "reply", "share", "present", "discuss",
  "deliver", "deploy", "configure", "test", "create", "design", "develop", "support", "train", "follow",
  "arrive", "reach", "return", "receive", "order", "book", "miss", "hope", "look", "remember", "happen",
  "carry", "pass", "graduate", "apply", "reply", "achieve", "celebrate", "dance", "shop", "rest", "relax",
];

export const KNOWN_BASES = new Set<string>([...Object.keys(IRREGULAR), ...REGULAR]);

function regularPast(base: string): string {
  if (base.endsWith("e")) return base + "d";
  if (/[^aeiou]y$/.test(base)) return base.slice(0, -1) + "ied";
  if (/^(stop|plan|shop|drop|chat|admit|prefer)$/.test(base)) return base + base.slice(-1) + "ed";
  return base + "ed";
}

function third(base: string): string {
  if (base === "have") return "has";
  if (base === "be") return "is";
  if (base === "do") return "does";
  if (base === "go") return "goes";
  if (/(s|sh|ch|x|z|o)$/.test(base)) return base + "es";
  if (/[^aeiou]y$/.test(base)) return base.slice(0, -1) + "ies";
  return base + "s";
}

function ing(base: string): string {
  if (base === "be") return "being";
  if (/ie$/.test(base)) return base.slice(0, -2) + "ying";
  if (/[^e]e$/.test(base)) return base.slice(0, -1) + "ing";
  if (/^(stop|plan|shop|run|swim|sit|get|put|begin|win|cut|set)$/.test(base)) return base + base.slice(-1) + "ing";
  return base + "ing";
}

export function forms(base: string): VerbForms {
  const irr = IRREGULAR[base];
  const past = irr ? irr[0] : regularPast(base);
  const pp = irr ? irr[1] : past;
  return { base, third: third(base), past, pp, ing: ing(base) };
}

const BY_THIRD = new Map<string, string>();
const BY_PAST = new Map<string, string>();
for (const b of KNOWN_BASES) {
  const f = forms(b);
  BY_THIRD.set(f.third, b);
  if (f.past !== b) BY_PAST.set(f.past, b);
}

/** Returns the base form if `word` is a known verb in base, third-person or past form. */
export function baseOf(word: string): string | null {
  const w = word.toLowerCase();
  if (KNOWN_BASES.has(w)) return w;
  return BY_THIRD.get(w) ?? BY_PAST.get(w) ?? null;
}

export function isBase(word: string) {
  return KNOWN_BASES.has(word.toLowerCase());
}
export function isThird(word: string) {
  return BY_THIRD.has(word.toLowerCase()) && !KNOWN_BASES.has(word.toLowerCase());
}
export function isPastSimple(word: string) {
  const w = word.toLowerCase();
  return BY_PAST.has(w);
}
