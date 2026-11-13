/**
 * SpeakUp AI rule-based grammar engine (FREE MODE).
 *
 * It is a deterministic, pattern-based checker focused on the mistakes that
 * Indian and other South-Asian English learners make most often (tense after
 * time markers, articles, prepositions, subject-verb agreement, stative verbs,
 * uncountable nouns, etc.). It does NOT understand meaning the way a large
 * language model does, so it will miss some errors and very occasionally flag
 * correct English. The UI labels its output as "rule-based".
 */
import { baseOf, forms, isBase, isPastSimple, isThird } from "./verbs";

export type GrammarCategory =
  | "tense"
  | "article"
  | "preposition"
  | "agreement"
  | "structure"
  | "vocabulary"
  | "spelling"
  | "punctuation"
  | "repetition"
  | "filler";

export interface GrammarIssue {
  ruleId: string;
  category: GrammarCategory;
  original: string;
  replacement: string;
  message: string;
  hi: string;
  sentenceIndex: number;
}

export interface SentenceAnalysis {
  original: string;
  corrected: string;
  professional: string;
  issues: GrammarIssue[];
}

export interface GrammarReport {
  input: string;
  sentences: SentenceAnalysis[];
  issues: GrammarIssue[];
  corrected: string;
  professional: string;
  wordCount: number;
  fillerCount: number;
  fillers: Record<string, number>;
  repeatedWords: string[];
  /** 0-100 grammar accuracy estimate. */
  score: number;
  practice: string[];
  categories: Partial<Record<GrammarCategory, number>>;
}

export interface AnalyseOptions {
  /** Voice transcripts have no punctuation/capitals - don't penalise them. */
  source?: "voice" | "text";
}

type FixFn = (m: RegExpExecArray, ctx: RuleContext) => string | null;

interface Rule {
  id: string;
  category: GrammarCategory;
  re: RegExp;
  fix: FixFn;
  message: string | ((orig: string, rep: string) => string);
  hi: string;
}

interface RuleContext {
  sentence: string;
  past: boolean;
  future: boolean;
}

const SUBJECTS = "I|you|we|they|he|she|it";
const MODALS = new Set([
  "did", "didn't", "didnt", "do", "does", "don't", "dont", "doesn't", "doesnt", "will", "would", "can", "could",
  "should", "must", "may", "might", "to", "cannot", "can't", "won't", "shall", "let", "lets", "let's", "make",
  "help", "and", "or", "but",
]);

const PAST_RE =
  /\b(yesterday|last (night|week|month|year|weekend|time|sunday|monday|tuesday|wednesday|thursday|friday|saturday)|\d+ (days?|weeks?|months?|years?) ago|(a|one|two|three|four|five|few|many) (days?|weeks?|months?|years?) ago|in (19|20)\d\d|when i was (a )?(child|kid|young|small|in school|in college))\b/i;
const FUTURE_RE = /\b(tomorrow|next (week|month|year|weekend|sunday|monday|tuesday|wednesday|thursday|friday|saturday)|tonight)\b/i;
const FUTURE_MARKED_RE = /\b(will|'ll|going to|gonna|shall|plan to|planning to|want to|would)\b/i;

const PROFESSIONS =
  "(?:(?:software |support |cloud |network |system |systems |mechanical |civil |electrical |data |business |junior |senior |IT |desktop |technical |test |QA |frontend |backend |full stack |web |hardware |computer science |engineering |team |project |product |HR |sales |customer support |college |school |university )?(?:engineer|developer|teacher|student|doctor|nurse|manager|fresher|graduate|analyst|administrator|accountant|designer|tester|consultant|lawyer|architect|employee|intern|programmer|homemaker|housewife|businessman|farmer|driver|executive|leader|lead|trainer|officer|professional|engineering student))";

function article(word: string) {
  return /^(hour|honest|honou?r|heir)/i.test(word)
    ? "an"
    : /^(uni|use|usu|euro|one|once|ubiq)/i.test(word)
      ? "a"
      : /^[aeiou]/i.test(word)
        ? "an"
        : "a";
}

function matchCase(source: string, rep: string) {
  if (!source || !rep) return rep;
  if (source[0] === source[0].toUpperCase() && source[0] !== source[0].toLowerCase()) {
    return rep[0].toUpperCase() + rep.slice(1);
  }
  return rep;
}

function prevWord(ctx: RuleContext, index: number) {
  const before = ctx.sentence.slice(0, index).trimEnd();
  const m = before.match(/([A-Za-z']+)$/);
  return m ? m[1].toLowerCase() : "";
}

/** Simple literal replacement rules: [id, category, pattern, replacement, message, hindi]. */
const SIMPLE: Array<[string, GrammarCategory, string, string, string, string]> = [
  ["discuss-about", "preposition", "\\bdiscuss(es|ed|ing)? about\\b", "discuss$1", "'Discuss' already means 'talk about', so we don't add 'about'.", "'Discuss' के बाद 'about' नहीं लगता।"],
  ["married-with", "preposition", "\\bmarried with\\b", "married to", "We say 'married to' someone.", "'Married to' सही है, 'married with' नहीं।"],
  ["good-in", "preposition", "\\b(good|bad|weak|strong|excellent|better) in (english|maths?|math|sports|coding|programming|singing|dancing|cooking|communication|speaking|writing)\\b", "$1 at $2", "We are 'good at' or 'bad at' a skill.", "किसी skill के लिए 'good at' बोलते हैं।"],
  ["depend-on", "preposition", "\\bdepend(s|ed|ing)? (of|from)\\b", "depend$1 on", "The correct preposition is 'depend on'.", "'Depend on' सही preposition है।"],
  ["angry-with", "preposition", "\\bangry on\\b", "angry with", "We are 'angry with' a person.", "किसी व्यक्ति से गुस्सा: 'angry with'।"],
  ["return-back", "vocabulary", "\\b(return|returned|returning|returns) back\\b", "$1", "'Return' already means 'come back'. 'Back' is extra.", "'Return' का मतलब ही वापस आना है, 'back' मत लगाइए।"],
  ["revert-back", "vocabulary", "\\brevert(ed)? back\\b", "replied", "In international English, 'revert' means 'go back to a previous state'. Use 'reply'.", "'Revert back' की जगह 'reply' बोलिए।"],
  ["repeat-again", "vocabulary", "\\brepeat again\\b", "repeat", "'Repeat' already means 'do again'.", "'Repeat' में 'again' का अर्थ पहले से है।"],
  ["explain-me", "preposition", "\\bexplain(s|ed)? (me|him|her|us|them)\\b", "explain$1 to $2", "We 'explain something to someone'.", "'Explain to me' बोलते हैं।"],
  ["listen-to", "preposition", "\\b(listen|listens|listened|listening) (music|songs?|news|the news|radio|the radio|podcasts?|me|him|her|them|us|my|your|his|our|their)\\b", "$1 to $2", "We always 'listen to' something.", "'Listen' के बाद 'to' लगता है।"],
  ["wait-for", "preposition", "\\b(wait|waits|waited|waiting) (you|me|him|her|them|us)\\b", "$1 for $2", "We 'wait for' someone.", "किसी का इंतज़ार: 'wait for'।"],
  ["on-day", "preposition", "\\b(at|in) (monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\\b", "on $2", "Use 'on' with days of the week.", "दिनों के साथ 'on' लगता है।"],
  ["in-year", "preposition", "\\b(on|at) ((19|20)\\d\\d)\\b", "in $2", "Use 'in' with years.", "साल के साथ 'in' लगता है।"],
  ["since-for", "preposition", "\\bsince (\\d+|two|three|four|five|six|seven|eight|nine|ten|many|a few|few) (days|weeks|months|years|hours)\\b", "for $1 $2", "Use 'for' with a period of time and 'since' with a starting point (since 2020).", "समय की अवधि के साथ 'for', शुरुआत के समय के साथ 'since'।"],
  ["since-long", "preposition", "\\bsince (a )?long time\\b", "for a long time", "We say 'for a long time'.", "'For a long time' सही है।"],
  ["interested-in", "preposition", "\\binterested (for|on|about|to learn)\\b", "interested in", "We are 'interested in' something.", "'Interested in' सही है।"],
  ["comprise-of", "preposition", "\\bcomprises of\\b", "comprises", "'Comprise' does not take 'of' (use 'consists of' or 'comprises').", "'Comprise' के बाद 'of' नहीं लगता।"],
  ["cope-up", "preposition", "\\bcope up with\\b", "cope with", "The phrase is 'cope with'.", "'Cope with' सही है, 'up' नहीं लगता।"],
  ["belong-from", "vocabulary", "\\bbelong(s)? from\\b", "come$1 from", "Say 'I come from' or 'I am from' a place.", "'I am from' या 'I come from' बोलिए।"],
  ["said-me", "vocabulary", "\\bsaid (me|him|her|us|them)\\b", "told $1", "'Say' does not take a person directly. Use 'told me' or 'said to me'.", "'Said me' गलत है, 'told me' बोलिए।"],
  ["good-name", "vocabulary", "\\b(my|your) good name\\b", "$1 name", "'Good name' is a translation from Hindi. Simply say 'my name'.", "'Good name' हिंदी का अनुवाद है, केवल 'name' बोलें।"],
  ["cousin-brother", "vocabulary", "\\bcousin (brother|sister)\\b", "cousin", "In English, 'cousin' is used for both male and female cousins.", "English में सिर्फ़ 'cousin' बोलते हैं।"],
  ["passed-out", "vocabulary", "\\bpass(ed)? out (from|of)\\b", "graduated from", "'Passed out' means 'fainted' in international English. Use 'graduated from'.", "'Passed out' का मतलब बेहोश होना है; 'graduated from' बोलिए।"],
  ["needful", "vocabulary", "\\bdo the needful\\b", "take the necessary action", "'Do the needful' sounds outdated. Say what you need clearly.", "'Do the needful' पुराना लगता है; साफ़ बताइए क्या चाहिए।"],
  ["prepone", "vocabulary", "\\bprepone(d)?\\b", "bring forward", "'Prepone' is understood mainly in India. Use 'bring forward' or 'move earlier'.", "'Prepone' की जगह 'bring forward' बोलें।"],
  ["today-morning", "vocabulary", "\\btoday (morning|evening|afternoon)\\b", "this $1", "We say 'this morning', not 'today morning'.", "'Today morning' नहीं, 'this morning' बोलते हैं।"],
  ["yesterday-night", "vocabulary", "\\byesterday night\\b", "last night", "We say 'last night'.", "'Yesterday night' नहीं, 'last night'।"],
  ["more-comparative", "structure", "\\bmore (better|worse|easier|bigger|smaller|faster|cheaper|happier|larger|higher|lower|older|younger|stronger|longer|shorter|simpler)\\b", "$1", "'$1' is already a comparative; don't add 'more'.", "Comparative के साथ 'more' नहीं लगता।"],
  ["most-superlative", "structure", "\\bmost (best|worst|easiest|biggest|smallest|fastest|cheapest|happiest|highest|largest|simplest)\\b", "$1", "This is already a superlative; don't add 'most'.", "Superlative के साथ 'most' नहीं लगता।"],
  ["modal-to", "structure", "\\b(must|should|can|could|will|would|may|might) to (\\w+)", "$1 $2", "After modal verbs (can, should, must...) we use the base verb without 'to'.", "Modal verbs के बाद 'to' नहीं लगता।"],
  ["less-people", "vocabulary", "\\bless (people|students|employees|cars|mistakes|questions|options)\\b", "fewer $1", "Use 'fewer' with countable nouns.", "गिनी जा सकने वाली चीज़ों के लिए 'fewer'।"],
  ["experience-of", "structure", "\\b(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)(\\+)? (years?|months?) experience\\b", "$1$2 $3 of experience", "We say 'three years of experience'.", "'Years of experience' बोलते हैं।"],
  ["years-plural", "agreement", "\\b(\\d*[02-9]|\\d{2,}|two|three|four|five|six|seven|eight|nine|ten|many|several) (year|month|week|day|hour|minute) (of|in|ago|back|before)\\b", "$1 $2s $3", "Use the plural form after numbers greater than one.", "एक से ज़्यादा के लिए plural (s) लगाइए।"],
  ["informations", "vocabulary", "\\b(information|advice|furniture|equipment|luggage|baggage|feedback|software|homework|knowledge|jewellery|scenery|staff)s\\b", "$1", "'$1' is uncountable in English, so it has no plural 's'.", "यह uncountable noun है, इसमें 's' नहीं लगता।"],
  ["agree-be", "structure", "\\b(I|we|they|you) (am|are) (not )?agree\\b", "$1 $3agree", "'Agree' is a verb. Say 'I agree' (not 'I am agree').", "'I am agree' नहीं, 'I agree' बोलिए।"],
  ["stative-having", "tense", "\\b(I|you|we|they) (am|are|'m|'re) having (?=(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|many|some|no|good|great|strong|\\w+ years)\\b)", "$1 have ", "'Have' (possession/experience) is not normally used in the continuous form.", "'Have' (रखना) का continuous रूप नहीं बनता: 'I have'।"],
  ["stative-having-3", "tense", "\\b(he|she|it) (is|'s) having (?=(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|many|some|no|good|great|strong|\\w+ years)\\b)", "$1 has ", "'Have' (possession/experience) is not normally used in the continuous form.", "'Have' (रखना) का continuous रूप नहीं बनता: 'he has'।"],
  ["stative", "tense", "\\b(I|you|we|they) (am|are) (knowing|understanding|liking|wanting|needing|believing|owning|belonging|preferring|loving|hating)\\b", "$1 _STATIVE_$3", "Verbs like know, want, like and understand are 'state verbs'. They are not normally used in the -ing form.", "Know, want, like जैसे verbs का -ing रूप सामान्यतः नहीं बनता।"],
  ["stative-3", "tense", "\\b(he|she|it) (is) (knowing|understanding|liking|wanting|needing|believing|owning|belonging|preferring|loving|hating)\\b", "$1 _STATIVE3_$3", "Verbs like know, want, like and understand are 'state verbs'. They are not normally used in the -ing form.", "Know, want, like जैसे verbs का -ing रूप सामान्यतः नहीं बनता।"],
  ["since-perfect", "tense", "\\b(I am|I'm|we are|we're|they are|they're|you are|you're) (working|living|staying|studying|learning|teaching|waiting|preparing)\\b(?=[^.?!]*\\b(since|for (\\d+|two|three|four|five|six|many|a few|the last|the past)))", "_PERF_$1 $2", "With 'since' or 'for + time', use the present perfect continuous: 'I have been working...'.", "'Since/for' के साथ 'have been + ing' का प्रयोग होता है।"],
  ["since-perfect-3", "tense", "\\b(he is|he's|she is|she's) (working|living|staying|studying|learning|teaching|waiting|preparing)\\b(?=[^.?!]*\\b(since|for (\\d+|two|three|four|five|six|many|a few|the last|the past)))", "_PERF3_$1 $2", "With 'since' or 'for + time', use the present perfect continuous: 'She has been working...'.", "'Since/for' के साथ 'has been + ing' का प्रयोग होता है।"],
  ["the-place", "article", "\\b(to|at|from|reached|reach) (office|gym|market|airport|railway station|bus stop|bank|mall|park|cinema|doctor|beach|hospital canteen|canteen|library)\\b", "$1 the $2", "Use 'the' before specific places we all know, like 'the office' or 'the market'.", "जानी-पहचानी जगहों से पहले 'the' लगता है।"],
  ["the-time", "article", "\\bin (morning|evening|afternoon)\\b", "in the $1", "We say 'in the morning / evening / afternoon'.", "'In the morning' बोलते हैं।"],
  ["one-of-plural", "agreement", "\\bone of (my|the|our|his|her|their|your) (best |closest |favourite |favorite |biggest |main )?(friend|colleague|brother|sister|teacher|cousin|student|project|reason|book|movie|film|city|place|skill|member|manager|client|customer|problem|challenge|goal|dream|achievement|strength|memory|hobby|weakness)\\b", "one of _ONEOF_$1 $2$3", "After 'one of the/my', the noun must be plural: 'one of my friends'.", "'One of my' के बाद plural noun आता है।"],
];

const SPELLING: Record<string, string> = {
  recieve: "receive", recieved: "received", definately: "definitely", seperate: "separate", occured: "occurred",
  untill: "until", wich: "which", becuase: "because", becasue: "because", alot: "a lot", tommorow: "tomorrow",
  tomorow: "tomorrow", enviroment: "environment", goverment: "government", beleive: "believe", freind: "friend",
  experiance: "experience", knowlege: "knowledge", intrested: "interested", responsiblity: "responsibility",
  comunication: "communication", oppurtunity: "opportunity", oppertunity: "opportunity", adress: "address",
  begining: "beginning", calender: "calendar", sucess: "success", succesful: "successful", successfull: "successful",
  carrer: "career", proffesional: "professional", profesional: "professional", grammer: "grammar",
  pronounciation: "pronunciation", accomodation: "accommodation", acheive: "achieve", truely: "truly",
  dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", doesnt: "doesn't", isnt: "isn't",
  wasnt: "wasn't", arent: "aren't", couldnt: "couldn't", shouldnt: "shouldn't", wouldnt: "wouldn't",
  im: "I'm", ive: "I've", thats: "that's", whats: "what's", u: "you", ur: "your", pls: "please", plz: "please",
};

const PROPER = ["english", "hindi", "marathi", "tamil", "telugu", "bengali", "india", "indian", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "january", "february", "april", "june", "july", "august", "september", "october", "november", "december", "mumbai", "delhi", "pune", "bangalore", "bengaluru", "chennai", "hyderabad", "kolkata", "linux", "windows", "azure", "aws", "ielts"];

const FILLER_RE = /\b(um+|uh+|er+m?|hmm+|ah+|you know|i mean|basically|actually|like,|sort of|kind of)\b/gi;
const HARD_FILLERS = /\b(um+|uh+|erm|er|hmm+|ah+)\b[,]?\s*/gi;

function buildRules(): Rule[] {
  const rules: Rule[] = [];

  // Remove hesitation sounds from the corrected sentence (counted separately as fillers).
  rules.push({
    id: "filler-sounds",
    category: "filler",
    re: HARD_FILLERS,
    fix: () => "",
    message: "Hesitation sounds like 'um' and 'uh' were removed. Pause silently instead.",
    hi: "'Um', 'uh' की जगह छोटा सा pause लें।",
  });

  // "Myself Rahul" -> "My name is Rahul" (case-sensitive name check).
  rules.push({
    id: "myself-intro",
    category: "structure",
    re: /^\s*(?:myself|Myself) (?:is )?([A-Z][a-z]+)/g,
    fix: (m) => `My name is ${m[1]}`,
    message: "'Myself Rahul' is a direct translation. Say 'My name is ...' or 'I am ...'.",
    hi: "'Myself ...' की जगह 'My name is ...' बोलिए।",
  });

  for (const [id, category, pattern, replacement, message, hi] of SIMPLE) {
    rules.push({
      id,
      category,
      re: new RegExp(pattern, "gi"),
      fix: (m) => {
        let rep = replacement.replace(/\$(\d)/g, (_x, n: string) => m[Number(n)] ?? "");
        rep = rep.replace(/_STATIVE_(\w+)/, (_x, w: string) => w.replace(/ing$/, "").replace(/(understand|know|want|need|own|belong|prefer)$/, "$1").replace(/^(lik|lov|hat|believ)$/, "$1e"));
        rep = rep.replace(/_STATIVE3_(\w+)/, (_x, w: string) => {
          let b = w.replace(/ing$/, "");
          if (/^(lik|lov|hat|believ)$/.test(b)) b += "e";
          return forms(b).third;
        });
        rep = rep.replace(/_PERF_(I am|I'm|we are|we're|they are|they're|you are|you're)/i, (_x, s: string) => {
          const subj = s.split(/ |'/)[0];
          return `${subj} have been`;
        });
        rep = rep.replace(/_PERF3_(he is|he's|she is|she's)/i, (_x, s: string) => `${s.split(/ |'/)[0]} has been`);
        rep = rep.replace(/_ONEOF_(\w+) ((?:\w+ )?)(\w+)$/, (_x, det: string, adj: string, noun: string) => {
          const plural = /y$/.test(noun) && !/(ay|ey|oy)$/.test(noun) ? noun.slice(0, -1) + "ies" : /(s|sh|ch|x)$/.test(noun) ? noun + "es" : noun + "s";
          return `${det} ${adj}${plural}`;
        });
        return matchCase(m[0], rep);
      },
      message: (orig) => message.replace("$1", orig.split(" ").slice(-1)[0]),
      hi,
    });
  }

  // a / an
  rules.push({
    id: "a-an",
    category: "article",
    re: /\b(a|an) ([A-Za-z][\w-]*)/gi,
    fix: (m) => {
      const word = m[2];
      if (/^[A-Z]{2,5}$/.test(word)) return null; // acronyms: depends on letter names
      const correct = article(word);
      if (correct === m[1].toLowerCase()) return null;
      return matchCase(m[1], correct) + " " + word;
    },
    message: (orig, rep) => `Use '${rep.split(" ")[0].toLowerCase()}' before '${orig.split(" ")[1]}' (it depends on the first sound of the next word).`,
    hi: "Vowel sound (a, e, i, o, u) से पहले 'an' और बाकी से पहले 'a'।",
  });

  // Missing article before professions: "I am engineer" -> "I am an engineer"
  rules.push({
    id: "article-profession",
    category: "article",
    re: new RegExp(`\\b(am|is|are|was|as|become|became|be) (${PROFESSIONS})\\b`, "gi"),
    fix: (m) => {
      if (/^(are)$/i.test(m[1])) return null; // plural subject; handled by learner
      return `${m[1]} ${article(m[2])} ${m[2]}`;
    },
    message: "Use 'a' or 'an' before a singular job title: 'I am an engineer'.",
    hi: "एक व्यक्ति के पेशे से पहले 'a/an' लगता है: 'I am an engineer'।",
  });

  // Verb form after modals / auxiliaries: "did went" -> "did go", "can goes" -> "can go".
  rules.push({
    id: "modal-base",
    category: "tense",
    re: /\b(can|could|should|would|will|must|may|might|did|didn't|didnt|does|doesn't|doesnt|do|don't|dont|cannot|can't|won't|shouldn't|couldn't|wouldn't|to) (\w+)\b/gi,
    fix: (m) => {
      const w = m[2];
      if (!(isThird(w) || isPastSimple(w))) return null;
      if (/^to$/i.test(m[1]) && !isPastSimple(w)) return null;
      if (/^to$/i.test(m[1]) && /^(used|supposed)$/i.test(w)) return null;
      const b = baseOf(w);
      if (!b || b === "be") return null;
      return `${m[1]} ${b}`;
    },
    message: "After 'did', 'does', 'can', 'will', 'to' etc. we use the base form of the verb.",
    hi: "Did, can, will, to के बाद verb की पहली form (base form) आती है।",
  });

  // Perfect tense with simple past: "have went" -> "have gone"
  rules.push({
    id: "perfect-pp",
    category: "tense",
    re: /\b(have|has|had|haven't|hasn't|hadn't|I've|we've|you've|they've) (\w+)\b/gi,
    fix: (m) => {
      const b = baseOf(m[2]);
      if (!b) return null;
      const f = forms(b);
      if (m[2].toLowerCase() === f.pp) return null;
      if (m[2].toLowerCase() !== f.past && m[2].toLowerCase() !== f.base) return null;
      if (m[2].toLowerCase() === f.base && /^(have|has|had)$/i.test(m[1])) return null; // "have to", "have work" (noun) - too ambiguous
      return `${m[1]} ${f.pp}`;
    },
    message: "Perfect tenses use the past participle: 'have gone', 'has eaten', 'had written'.",
    hi: "Have/has/had के बाद verb की third form (past participle) आती है।",
  });

  // be-agreement
  const beFix = (subj: string, verb: string, ctx: RuleContext): string | null => {
    const s = subj.toLowerCase();
    const v = verb.toLowerCase();
    let correct: string;
    if (ctx.past && ["am", "is", "are"].includes(v)) {
      correct = s === "i" || s === "he" || s === "she" || s === "it" ? "was" : "were";
    } else if (v === "was" || v === "were") {
      if (v === "were" && /\bif\b/i.test(ctx.sentence)) return null; // subjunctive
      correct = s === "i" || s === "he" || s === "she" || s === "it" ? "was" : "were";
    } else {
      correct = s === "i" ? "am" : s === "he" || s === "she" || s === "it" ? "is" : "are";
    }
    if (correct === v) return null;
    return `${subj} ${correct}`;
  };
  rules.push({
    id: "be-agreement",
    category: "agreement",
    re: new RegExp(`\\b(${SUBJECTS}) (am|is|are|was|were)\\b`, "gi"),
    fix: (m, ctx) => {
      if (/^(it|you)$/i.test(m[1]) && baseOf(prevWord(ctx, m.index)) ) return null;
      // Compound subjects are plural: "Ravi and I are", "my wife and I were".
      if (prevWord(ctx, m.index) === "and" && /^(are|were)$/i.test(m[2])) return null;
      return beFix(m[1], m[2], ctx);
    },
    message: (orig, rep) => `Use '${rep}' instead of '${orig}'.`,
    hi: "I के साथ am, he/she/it के साथ is, और you/we/they के साथ are। Past में was/were।",
  });

  // Past tense after past time markers / present agreement / future markers
  rules.push({
    id: "verb-tense",
    category: "tense",
    re: new RegExp(`\\b(${SUBJECTS}|my (?:friend|brother|sister|father|mother|manager|boss|team|teacher|company|son|daughter|wife|husband)|the (?:customer|client|user|manager|system|server|team)) (\\w+)\\b`, "gi"),
    fix: (m, ctx) => {
      const subj = m[1];
      const verb = m[2];
      const lower = verb.toLowerCase();
      if (["am", "is", "are", "was", "were", "be", "been", "being"].includes(lower)) return null;
      const pw = prevWord(ctx, m.index);
      if (MODALS.has(pw) || (pw && baseOf(pw) && /^(it|you|him|her|them|us|me)$/i.test(subj))) return null;
      if (/^(it|you)$/i.test(subj) && pw && pw !== "and" && pw !== "but" && pw !== "because" && pw !== "so" && pw !== "when" && pw !== "if" && pw !== "then" && !/^(yesterday|today|tomorrow|now|also|later)$/.test(pw)) {
        // "it"/"you" are often objects ("I like it"); only treat as subject at clause start.
        if (ctx.sentence.slice(0, m.index).trim().length > 0) return null;
      }
      const b = baseOf(verb);
      if (!b || b === "be") return null;
      const f = forms(b);
      const singular3 = /^(he|she|it|my |the )/i.test(subj);
      let correct: string;
      if (ctx.past) {
        correct = f.past;
      } else if (ctx.future && !FUTURE_MARKED_RE.test(ctx.sentence)) {
        correct = `will ${f.base}`;
      } else {
        if (isPastSimple(verb)) return null; // past form without context is fine
        correct = singular3 ? f.third : f.base;
      }
      if (correct === lower) return null;
      if (ctx.past && isPastSimple(verb)) return null;
      return `${subj} ${correct}`;
    },
    message: (orig, rep) =>
      / will /.test(rep)
        ? "For a future plan (tomorrow, next week) use 'will' + verb or 'going to' + verb."
        : `Use '${rep.split(" ").slice(-1)[0]}' here (check the tense and the subject: ${orig.split(" ")[0]}).`,
    hi: "समय (past/future) और subject (he/she = verb+s) के अनुसार verb बदलिए।",
  });

  // Coordinated verb in a past-tense sentence: "Yesterday I went there and meet him" -> "and met him".
  rules.push({
    id: "past-and",
    category: "tense",
    re: /\b(and|then) (\w+)\b/gi,
    fix: (m, ctx) => {
      if (!ctx.past) return null;
      const w = m[2].toLowerCase();
      if (!isBase(w) && !isThird(w)) return null;
      // Only when the clause before already has a past-tense verb.
      const before = ctx.sentence.slice(0, m.index).toLowerCase().match(/[a-z']+/g) ?? [];
      if (!before.some((x) => isPastSimple(x))) return null;
      const b = baseOf(w);
      if (!b || b === "be") return null;
      return `${m[1]} ${forms(b).past}`;
    },
    message: (_o, rep) => `Keep the same tense in both parts of the sentence: '${rep}'.`,
    hi: "वाक्य के दोनों हिस्सों में एक ही tense (past) रखें।",
  });

  // Question word order: "Where you are going?" -> "Where are you going?"
  rules.push({
    id: "question-order",
    category: "structure",
    re: /^(\s*)(what|where|why|when|how|who|which)( \w+)? (you|we|they|he|she|it) (are|is|was|were|will|can|have|has)\b(?=[^?]*\?\s*$)/gi,
    fix: (m) => `${m[1]}${m[2]}${m[3] ?? ""} ${m[5]} ${m[4]}`,
    message: "In questions, the helping verb comes before the subject: 'Where are you going?'",
    hi: "प्रश्न में helping verb subject से पहले आता है।",
  });

  // Spelling and SMS-style contractions
  rules.push({
    id: "spelling",
    category: "spelling",
    re: new RegExp(`\\b(${Object.keys(SPELLING).join("|")})\\b`, "gi"),
    fix: (m) => {
      const rep = SPELLING[m[1].toLowerCase()];
      return rep.startsWith("I") ? rep : matchCase(m[1], rep);
    },
    message: (orig, rep) => `Spelling: '${rep}', not '${orig}'.`,
    hi: "Spelling ठीक कीजिए।",
  });

  // Repeated words
  rules.push({
    id: "repeated-word",
    category: "repetition",
    re: /\b(\w+)(\s+\1\b)+/gi,
    fix: (m) => (/^(that|had|very|so|bye|no)$/i.test(m[1]) ? null : m[1]),
    message: (orig) => `The word '${orig.split(/\s+/)[0]}' was repeated.`,
    hi: "एक ही शब्द दोबारा बोला गया।",
  });

  // lowercase i
  rules.push({
    id: "capital-i",
    category: "punctuation",
    re: /(^|[^\w'])(i)(?=$|[^\w]|')/g,
    fix: (m) => `${m[1]}I`,
    message: "The pronoun 'I' is always a capital letter.",
    hi: "'I' हमेशा capital होता है।",
  });

  rules.push({
    id: "proper-noun",
    category: "punctuation",
    re: new RegExp(`\\b(${PROPER.join("|")})\\b`, "g"),
    fix: (m) => (m[1].length <= 4 && /^(aws|ielts)$/.test(m[1]) ? m[1].toUpperCase() : m[1][0].toUpperCase() + m[1].slice(1)),
    message: (orig) => `Names of languages, places, days and products start with a capital letter: '${orig}'.`,
    hi: "भाषा, जगह और दिनों के नाम capital letter से शुरू होते हैं।",
  });

  return rules;
}

const RULES = buildRules();

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Za-z"'(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const PRO_UPGRADES: Array<[RegExp, string]> = [
  [/\bI want to\b/g, "I would like to"],
  [/\bI want\b/g, "I would like"],
  [/\b[Cc]an you\b/g, "could you"],
  [/\bgonna\b/gi, "going to"],
  [/\bwanna\b/gi, "want to"],
  [/\bgotta\b/gi, "have to"],
  [/\bvery good\b/gi, "excellent"],
  [/\bvery bad\b/gi, "poor"],
  [/\bvery big\b/gi, "huge"],
  [/\bvery important\b/gi, "crucial"],
  [/\bvery happy\b/gi, "delighted"],
  [/\bvery tired\b/gi, "exhausted"],
  [/\bvery (difficult|hard)\b/gi, "challenging"],
  [/\bvery easy\b/gi, "straightforward"],
  [/\bvery interesting\b/gi, "fascinating"],
  [/\bvery busy\b/gi, "extremely busy"],
  [/\bvery fast\b/gi, "rapid"],
  [/\ba lot of\b/gi, "plenty of"],
  [/\bI think\b/g, "I believe"],
  [/\bhelp me\b/gi, "assist me"],
  [/\btell me\b/gi, "let me know"],
  [/\bASAP\b/g, "at your earliest convenience"],
  [/\bkids\b/gi, "children"],
  [/\bboss\b/gi, "manager"],
  [/\bfix(ed)? the (issue|problem|error|bug)\b/gi, "resolve$1 the $2"],
  [/\bbig problem\b/gi, "major issue"],
  [/\bthanks\b/gi, "thank you"],
  [/^Sorry\b/g, "I apologise"],
  [/^(Hi|Hey)\b/g, "Hello"],
  [/\bget better\b/gi, "improve"],
  [/\bfind out\b/gi, "identify"],
];

export function professionalise(sentence: string): string {
  let s = sentence;
  for (const [re, rep] of PRO_UPGRADES) s = s.replace(re, rep);
  s = s.replace(/resolveed/g, "resolved");
  if (s) s = s[0].toUpperCase() + s.slice(1);
  return s;
}

const PRACTICE: Record<GrammarCategory, string[]> = {
  tense: [
    "Tell me three things you did last weekend. Use the past tense (went, watched, ate).",
    "Describe what you will do tomorrow using 'will' or 'going to'.",
    "Say two sentences with 'have been working / studying since...'.",
  ],
  article: [
    "Describe your job or studies in one sentence using 'a' or 'an' (I am a / an ...).",
    "Say three sentences about places in your city using 'the' (the market, the station...).",
  ],
  preposition: [
    "Make sentences with: listen to, wait for, good at, interested in.",
    "Say what you do on Monday, in the morning and in 2025 (on / in).",
  ],
  agreement: [
    "Describe your friend's daily routine. Remember: he works, she goes, he has.",
    "Tell me about your family using is / are and has / have correctly.",
  ],
  structure: [
    "Ask me three questions starting with Where, Why and How (Where are you going?).",
    "Use 'one of my friends' and 'I agree' in two sentences.",
  ],
  vocabulary: [
    "Introduce yourself without 'myself' or 'good name'. Start with 'I am...'.",
    "Explain what 'graduated from' means and use it in a sentence about your education.",
  ],
  spelling: ["Type these words carefully: receive, definitely, separate, environment, opportunity."],
  punctuation: ["Write two sentences about yourself. Start each with a capital letter and end with a full stop."],
  repetition: ["Speak for 30 seconds about your favourite food without repeating any word twice in a row."],
  filler: ["Speak for 30 seconds about your weekend. When you need to think, pause silently instead of saying 'um'."],
};

function countFillers(text: string) {
  const fillers: Record<string, number> = {};
  let count = 0;
  for (const m of text.matchAll(FILLER_RE)) {
    const k = m[1].toLowerCase().replace(/,$/, "").replace(/^(u)h+$/, "uh").replace(/^(u)m+$/, "um").replace(/^hm+$/, "hmm");
    fillers[k] = (fillers[k] ?? 0) + 1;
    count++;
  }
  return { fillers, count };
}

export function wordsOf(text: string) {
  return text.toLowerCase().match(/[a-z']+/g) ?? [];
}

function analyseSentence(sentence: string, index: number, source: "voice" | "text"): SentenceAnalysis {
  const issues: GrammarIssue[] = [];
  let text = sentence;
  for (const rule of RULES) {
    if (source === "voice" && rule.category === "punctuation") continue;
    if (source === "voice" && rule.id === "spelling") continue;
    const ctx: RuleContext = { sentence: text, past: PAST_RE.test(text), future: FUTURE_RE.test(text) };
    rule.re.lastIndex = 0;
    let result = "";
    let last = 0;
    let m: RegExpExecArray | null;
    const re = new RegExp(rule.re.source, rule.re.flags.includes("g") ? rule.re.flags : rule.re.flags + "g");
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      const rep = rule.fix(m, ctx);
      result += text.slice(last, m.index);
      if (rep !== null && rep !== m[0]) {
        issues.push({
          ruleId: rule.id,
          category: rule.category,
          original: m[0].trim(),
          replacement: rep.trim(),
          message: typeof rule.message === "function" ? rule.message(m[0].trim(), rep.trim()) : rule.message,
          hi: rule.hi,
          sentenceIndex: index,
        });
        result += rep;
      } else {
        result += m[0];
      }
      last = m.index + m[0].length;
      if (/^\^/.test(rule.re.source)) break;
    }
    text = result + text.slice(last);
  }
  text = text.replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
  if (text && /^[a-z]/.test(text)) {
    if (source === "text") {
      issues.push({
        ruleId: "capital-start",
        category: "punctuation",
        original: text.split(" ")[0],
        replacement: text[0].toUpperCase() + text.split(" ")[0].slice(1),
        message: "Start every sentence with a capital letter.",
        hi: "हर वाक्य capital letter से शुरू होता है।",
        sentenceIndex: index,
      });
    }
    text = text[0].toUpperCase() + text.slice(1);
  }
  if (text && !/[.!?]$/.test(text)) {
    if (source === "text" && text.split(" ").length > 2) {
      issues.push({
        ruleId: "end-punctuation",
        category: "punctuation",
        original: text.split(" ").slice(-1)[0],
        replacement: text.split(" ").slice(-1)[0] + ".",
        message: "End the sentence with a full stop (or ? / !).",
        hi: "वाक्य के अंत में full stop लगाइए।",
        sentenceIndex: index,
      });
    }
    text += /^(what|where|why|when|how|who|which|do|does|did|are|is|can|could|will|would)\b/i.test(text) ? "?" : ".";
  }
  return { original: sentence, corrected: text, professional: professionalise(text), issues };
}

/** Analyse free text (one or more sentences). Works fully offline. */
export function analyse(input: string, opts: AnalyseOptions = {}): GrammarReport {
  const source = opts.source ?? "text";
  const clean = input.replace(/\s+/g, " ").trim();
  const parts = source === "voice" && !/[.!?]/.test(clean) ? chunkTranscript(clean) : splitSentences(clean);
  const sentences = parts.map((s, i) => analyseSentence(s, i, source));
  const issues = sentences.flatMap((s) => s.issues);
  const words = wordsOf(clean);
  const { fillers, count: fillerCount } = countFillers(clean);
  const repeatedWords = issues.filter((i) => i.category === "repetition").map((i) => i.replacement);
  const categories: Partial<Record<GrammarCategory, number>> = {};
  for (const i of issues) categories[i.category] = (categories[i.category] ?? 0) + 1;

  // Score: weighted errors per 100 words. Fillers/punctuation weigh less.
  const weight: Record<GrammarCategory, number> = {
    tense: 1, article: 0.7, preposition: 0.8, agreement: 1, structure: 0.9, vocabulary: 0.5,
    spelling: 0.4, punctuation: 0.25, repetition: 0.3, filler: 0.2,
  };
  const weighted = issues.reduce((sum, i) => sum + weight[i.category], 0);
  const per100 = words.length ? (weighted / words.length) * 100 : 0;
  // Smooth decay: 1 error in 20 words ≈ 85, 2 in 30 ≈ 80, 4 in 10 ≈ 31. Never negative.
  const score = words.length === 0 ? 0 : Math.round(100 * Math.exp(-per100 / 30));

  const practice: string[] = [];
  const ordered = Object.entries(categories).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  for (const [cat] of ordered.slice(0, 3)) practice.push(PRACTICE[cat as GrammarCategory][0]);
  if (practice.length === 0 && words.length > 0) practice.push("Great job! Now say the same idea in a longer sentence using 'because' or 'although'.");

  return {
    input,
    sentences,
    issues,
    corrected: sentences.map((s) => s.corrected).join(" "),
    professional: sentences.map((s) => s.professional).join(" "),
    wordCount: words.length,
    fillerCount,
    fillers,
    repeatedWords,
    score,
    practice,
    categories,
  };
}

/** Voice transcripts arrive without punctuation; split long ones at natural joins. */
function chunkTranscript(text: string): string[] {
  const words = text.split(" ");
  if (words.length <= 25) return [text];
  const chunks: string[] = [];
  let cur: string[] = [];
  for (const w of words) {
    if (cur.length >= 12 && /^(and|but|so|because|then|also|after|actually)$/i.test(w)) {
      chunks.push(cur.join(" "));
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length) chunks.push(cur.join(" "));
  return chunks;
}

export const CATEGORY_LABELS: Record<GrammarCategory, string> = {
  tense: "Tense",
  article: "Articles",
  preposition: "Prepositions",
  agreement: "Subject-verb agreement",
  structure: "Sentence structure",
  vocabulary: "Word choice",
  spelling: "Spelling",
  punctuation: "Capitals & punctuation",
  repetition: "Repeated words",
  filler: "Fillers",
};

export { isBase };
