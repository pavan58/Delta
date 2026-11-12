/** Original vocabulary bank. pron = simple stress respelling (CAPS = stressed syllable). */

export type VocabCategory = "daily" | "office" | "interview" | "ielts" | "professional" | "travel" | "business";

export interface Word {
  id: string;
  word: string;
  category: VocabCategory;
  meaning: string;
  pron: string;
  example: string;
  synonyms: string[];
  antonyms: string[];
  usage: string;
  hi: string;
}

export const VOCAB_CATEGORIES: Record<VocabCategory, { label: string; emoji: string }> = {
  daily: { label: "Daily English", emoji: "☀️" },
  office: { label: "Office English", emoji: "🏢" },
  interview: { label: "Interview English", emoji: "💼" },
  ielts: { label: "IELTS Vocabulary", emoji: "🎓" },
  professional: { label: "Professional English", emoji: "👔" },
  travel: { label: "Travel English", emoji: "✈️" },
  business: { label: "Business English", emoji: "📈" },
};

type Raw = [word: string, meaning: string, pron: string, example: string, synonyms: string, antonyms: string, usage: string, hi: string];

const RAW: Record<VocabCategory, Raw[]> = {
  daily: [
    ["commute", "to travel regularly between home and work", "kuh-MYOOT", "My commute takes forty minutes by metro.", "travel, journey", "", "Verb and noun. 'Daily commute' is a common phrase.", "रोज़ घर से काम पर आना-जाना"],
    ["errand", "a short trip to do a task, like shopping or paying a bill", "ER-und", "I need to run a few errands this evening.", "task, chore", "", "Usually 'run an errand'.", "छोटा काम (जैसे सामान लाना)"],
    ["exhausted", "extremely tired", "ig-ZAWS-tid", "I was exhausted after the long trip.", "worn out, drained", "energetic, refreshed", "Stronger than 'tired'; don't say 'very exhausted'.", "बहुत थका हुआ"],
    ["leftovers", "food remaining after a meal", "LEFT-oh-verz", "We had leftovers for lunch.", "remains", "", "Always plural.", "बचा हुआ खाना"],
    ["chilly", "unpleasantly cold", "CHIL-ee", "It's a bit chilly this morning.", "cold, cool", "warm, hot", "Used for weather and rooms.", "ठंडा"],
    ["grab", "to take or get something quickly", "GRAB", "Let's grab a coffee before the meeting.", "take, get", "release", "Informal: 'grab lunch', 'grab a seat'.", "जल्दी से लेना"],
    ["hectic", "very busy and full of activity", "HEK-tik", "Mondays are always hectic.", "busy, frantic", "calm, relaxed", "Describes a day, schedule or week.", "बहुत व्यस्त"],
    ["neighbourhood", "the area around your home", "NAY-ber-hood", "Our neighbourhood is quiet and green.", "locality, area", "", "US spelling: neighborhood.", "मोहल्ला, आस-पास का इलाका"],
    ["routine", "the usual order in which you do things", "roo-TEEN", "Exercise is part of my morning routine.", "schedule, habit", "", "'Daily routine' is very common.", "दिनचर्या"],
    ["affordable", "not too expensive", "uh-FOR-duh-bul", "This phone is good and affordable.", "reasonable, cheap", "expensive, costly", "More polite than 'cheap'.", "किफ़ायती, सस्ता"],
    ["look forward to", "to feel happy about something that will happen", "look FOR-wurd too", "I'm looking forward to the weekend.", "anticipate", "dread", "Followed by noun or -ing: 'look forward to meeting you'.", "किसी चीज़ का इंतज़ार ख़ुशी से करना"],
    ["run out of", "to have no more of something", "run OWT uv", "We've run out of milk.", "use up", "", "'Run out of time / money / ideas'.", "ख़त्म हो जाना"],
    ["catch up", "to talk to someone you haven't seen for a while", "katch UP", "Let's catch up over dinner.", "reconnect", "", "Also: 'catch up on work' = finish pending work.", "मिलकर हाल-चाल जानना"],
    ["handy", "useful and convenient", "HAN-dee", "This app is really handy for learning words.", "useful, convenient", "useless", "Informal.", "काम का, उपयोगी"],
    ["fed up", "annoyed and bored with a situation", "fed UP", "I'm fed up with this traffic.", "tired of, sick of", "content", "'Fed up with' + noun.", "परेशान, ऊब जाना"],
  ],
  office: [
    ["deadline", "the latest time by which something must be done", "DED-line", "The deadline for the report is Friday.", "due date, cut-off", "", "'Meet / miss a deadline'.", "अंतिम तारीख़"],
    ["agenda", "a list of topics for a meeting", "uh-JEN-duh", "Let's go through today's agenda.", "schedule, plan", "", "'On the agenda'.", "बैठक के विषयों की सूची"],
    ["follow up", "to check or continue something later", "FOL-oh up", "I'll follow up with the vendor tomorrow.", "check back, pursue", "", "Verb: follow up. Noun: a follow-up.", "बाद में फिर से संपर्क करना"],
    ["escalate", "to pass a problem to a higher level", "ES-kuh-late", "If the issue isn't fixed in an hour, escalate it to L2.", "raise, refer", "de-escalate", "Common in IT support.", "मामला ऊपर के स्तर पर भेजना"],
    ["workload", "the amount of work to be done", "WURK-lohd", "My workload is heavy this week.", "load, responsibilities", "", "'Heavy / manageable workload'.", "काम का बोझ"],
    ["loop in", "to include someone in a conversation or email", "loop IN", "Please loop in the finance team.", "include, copy", "exclude", "Informal office English.", "किसी को बातचीत में शामिल करना"],
    ["bandwidth", "time or capacity to do more work", "BAND-width", "I don't have the bandwidth for another project.", "capacity, availability", "", "Informal; originally a technical term.", "समय या क्षमता"],
    ["handover", "passing work and information to another person", "HAND-oh-ver", "I'll prepare a handover note before my leave.", "transfer, transition", "", "Noun. Verb: hand over.", "काम सौंपना"],
    ["prioritise", "to decide which tasks are most important", "pry-OR-i-tize", "Prioritise the client tickets first.", "rank, focus on", "postpone", "US: prioritize.", "प्राथमिकता देना"],
    ["stakeholder", "a person with an interest in a project", "STAKE-hohl-der", "We shared the plan with all stakeholders.", "interested party", "", "Business and project management.", "हितधारक"],
    ["minutes", "a written record of a meeting", "MIN-its", "Could you take the minutes today?", "notes, record", "", "Always plural in this meaning.", "बैठक का लिखित विवरण"],
    ["reschedule", "to change the time of a planned event", "ree-SHED-yool", "Can we reschedule the call to 4 p.m.?", "postpone, move", "", "Use instead of 'prepone/postpone' when unsure.", "समय बदलना"],
    ["sync", "a short meeting to align on work", "SINK", "Let's have a quick sync after lunch.", "check-in, catch-up", "", "Short for 'synchronise'.", "छोटी बैठक"],
    ["approval", "official permission", "uh-PROO-vul", "We're waiting for the manager's approval.", "permission, consent", "rejection", "'Get / give approval for'.", "स्वीकृति, मंज़ूरी"],
    ["swamped", "extremely busy", "SWOMPT", "I'm swamped with tickets today.", "overloaded, snowed under", "free", "Informal.", "काम में डूबा हुआ"],
  ],
  interview: [
    ["strength", "a good quality or skill", "STRENGTH", "My greatest strength is problem-solving.", "asset, advantage", "weakness", "Always support with an example.", "ख़ूबी, ताक़त"],
    ["adaptable", "able to adjust to new conditions", "uh-DAP-tuh-bul", "I'm adaptable and learn new tools quickly.", "flexible, versatile", "rigid", "Valued in fast-changing roles.", "हालात के अनुसार ढलने वाला"],
    ["initiative", "the ability to act without being told", "i-NISH-uh-tiv", "I took the initiative to automate the report.", "drive, enterprise", "passivity", "'Take the initiative'.", "पहल"],
    ["accomplishment", "something achieved successfully", "uh-KOM-plish-ment", "My biggest accomplishment was reducing ticket backlog by 40%.", "achievement", "failure", "Quantify it with numbers.", "उपलब्धि"],
    ["collaborate", "to work together", "kuh-LAB-uh-rate", "I collaborated with the network team to fix the outage.", "cooperate, team up", "", "'Collaborate with someone on something'.", "मिलकर काम करना"],
    ["proactive", "acting early to prevent problems", "proh-AK-tiv", "I'm proactive about monitoring alerts.", "forward-thinking", "reactive", "Strong interview word.", "पहले से सक्रिय"],
    ["eager", "wanting very much to do something", "EE-ger", "I'm eager to learn cloud technologies.", "keen, enthusiastic", "reluctant", "'Eager to + verb'.", "उत्सुक"],
    ["relevant", "closely connected to the subject", "REL-uh-vunt", "I have relevant experience in desktop support.", "related, applicable", "irrelevant", "'Relevant to the role'.", "संबंधित"],
    ["meticulous", "very careful about details", "muh-TIK-yuh-lus", "I'm meticulous when documenting changes.", "thorough, careful", "careless", "More impressive than 'careful'.", "बारीकी से काम करने वाला"],
    ["resilient", "able to recover quickly from difficulties", "ri-ZIL-yunt", "The project taught me to be resilient under pressure.", "tough, strong", "fragile", "Good for 'challenge' questions.", "मुश्किलों से जल्दी उबरने वाला"],
    ["fit", "how suitable someone is for a role or team", "FIT", "I believe I'm a good fit for this role.", "match, suitability", "", "'A good fit for'.", "उपयुक्त होना"],
    ["notice period", "time you must work after resigning", "NOH-tis peer-ee-ud", "My notice period is 30 days.", "", "", "Very common HR question in India.", "नौकरी छोड़ने से पहले की अवधि"],
    ["expectation", "what you hope to receive", "ek-spek-TAY-shun", "My salary expectation is in line with industry standards.", "requirement", "", "'Salary expectations' is plural.", "अपेक्षा"],
    ["growth", "development and progress", "GROHTH", "I'm looking for a role with opportunities for growth.", "development, progress", "decline", "'Career growth'.", "विकास, तरक़्क़ी"],
    ["self-motivated", "able to work hard without being pushed", "self-MOH-tuh-vay-tid", "I'm self-motivated and set my own learning goals.", "driven", "", "Pair it with proof.", "ख़ुद से प्रेरित"],
  ],
  ielts: [
    ["significant", "large or important enough to notice", "sig-NIF-i-kunt", "There was a significant increase in sales.", "considerable, substantial", "minor, negligible", "Writing Task 1 essential.", "महत्वपूर्ण, काफ़ी बड़ा"],
    ["fluctuate", "to rise and fall irregularly", "FLUK-choo-ate", "Prices fluctuated throughout the year.", "vary, oscillate", "stabilise", "Describing trends.", "ऊपर-नीचे होना"],
    ["consequently", "as a result", "KON-si-kwent-lee", "Costs rose; consequently, profits fell.", "therefore, as a result", "", "Linker for cause and effect.", "परिणामस्वरूप"],
    ["detrimental", "causing harm", "det-ri-MEN-tul", "Too much screen time is detrimental to children's health.", "harmful, damaging", "beneficial", "'Detrimental to'.", "हानिकारक"],
    ["mitigate", "to make something less harmful", "MIT-i-gate", "Governments should mitigate the effects of pollution.", "reduce, lessen", "worsen", "Task 2 solution essays.", "कम करना"],
    ["inevitable", "certain to happen", "in-EV-i-tuh-bul", "Some job losses are inevitable with automation.", "unavoidable", "avoidable", "", "अनिवार्य, टल न सकने वाला"],
    ["advocate", "to publicly support", "AD-vuh-kate", "Many experts advocate free public transport.", "support, promote", "oppose", "Verb (AD-vuh-kate) vs noun (AD-vuh-kut).", "समर्थन करना"],
    ["predominantly", "mainly", "pri-DOM-i-nunt-lee", "The workforce is predominantly young.", "mainly, mostly", "", "Formal.", "मुख्य रूप से"],
    ["proportion", "a part of a whole", "pruh-POR-shun", "A large proportion of students live in hostels.", "share, percentage", "", "Task 1 pie charts.", "अनुपात, हिस्सा"],
    ["plummet", "to fall very quickly", "PLUM-it", "Temperatures plummeted overnight.", "plunge, drop sharply", "soar", "Trend vocabulary.", "तेज़ी से गिरना"],
    ["sustainable", "able to continue without harming the environment", "suh-STAY-nuh-bul", "We need sustainable sources of energy.", "eco-friendly, renewable", "unsustainable", "Environment topics.", "टिकाऊ"],
    ["urbanisation", "the growth of towns and cities", "ur-buh-ny-ZAY-shun", "Rapid urbanisation has increased traffic.", "city growth", "", "Common Task 2 topic.", "शहरीकरण"],
    ["whereas", "while on the other hand (contrast)", "wair-AZ", "Men preferred football, whereas women chose tennis.", "while, but", "", "Comparison linker.", "जबकि"],
    ["compelling", "very convincing", "kum-PEL-ing", "There is compelling evidence for this view.", "convincing, persuasive", "weak", "'A compelling argument'.", "ठोस, विश्वसनीय"],
    ["exacerbate", "to make a problem worse", "ig-ZAS-er-bate", "Poor planning exacerbates traffic congestion.", "worsen, aggravate", "alleviate", "High-band Task 2 word.", "और बिगाड़ना"],
  ],
  professional: [
    ["articulate", "able to express ideas clearly", "ar-TIK-yuh-lut", "She is articulate in client meetings.", "eloquent, clear", "inarticulate", "Adjective (ar-TIK-yuh-lut); verb (ar-TIK-yuh-late).", "स्पष्ट बोलने वाला"],
    ["concise", "short and clear", "kun-SISE", "Keep your emails concise.", "brief, to the point", "wordy", "", "संक्षिप्त"],
    ["clarify", "to make something clear", "KLAR-i-fy", "Could you clarify what you mean by 'urgent'?", "explain, explain clearly", "confuse", "Polite way to ask questions.", "स्पष्ट करना"],
    ["acknowledge", "to accept or recognise", "uk-NOL-ij", "I acknowledge the delay and apologise.", "recognise, admit", "deny", "Also: acknowledge an email = confirm receipt.", "स्वीकार करना"],
    ["feasible", "possible and practical", "FEE-zuh-bul", "Is it feasible to finish by Monday?", "possible, workable", "impractical", "", "संभव, व्यावहारिक"],
    ["constructive", "helpful, aimed at improvement", "kun-STRUK-tiv", "Thank you for the constructive feedback.", "helpful, positive", "destructive", "'Constructive criticism'.", "रचनात्मक"],
    ["diplomatic", "careful not to upset people", "dip-luh-MAT-ik", "Give a diplomatic reply to the angry client.", "tactful", "blunt", "", "कूटनीतिक, संवेदनशील"],
    ["accountable", "responsible for results", "uh-KOWN-tuh-bul", "I'm accountable for the server uptime.", "responsible, answerable", "", "'Accountable for'.", "जवाबदेह"],
    ["streamline", "to make a process simpler and faster", "STREEM-line", "We streamlined the onboarding process.", "simplify, optimise", "complicate", "Great for CVs.", "सरल और तेज़ बनाना"],
    ["insight", "a deep understanding", "IN-site", "The survey gave us useful insights.", "understanding, perception", "", "'Insight into'.", "गहरी समझ"],
    ["courteous", "polite and respectful", "KUR-tee-us", "Always be courteous on calls.", "polite, respectful", "rude", "", "विनम्र"],
    ["delegate", "to give a task to someone else", "DEL-i-gate", "Good leaders delegate effectively.", "assign, entrust", "", "", "काम सौंपना"],
    ["transparent", "open and honest", "trans-PAIR-unt", "We keep clients informed and transparent about risks.", "open, honest", "secretive", "", "पारदर्शी"],
    ["leverage", "to use something to maximum advantage", "LEV-er-ij", "We can leverage automation to reduce errors.", "use, exploit", "", "Business buzzword — don't overuse.", "लाभ उठाना"],
    ["punctual", "on time", "PUNK-choo-ul", "He is always punctual for meetings.", "on time, prompt", "late", "", "समय का पाबंद"],
  ],
  travel: [
    ["itinerary", "a plan of a journey", "eye-TIN-uh-rer-ee", "Please share the itinerary for the trip.", "schedule, plan", "", "", "यात्रा की योजना"],
    ["boarding pass", "a document that allows you to get on a plane", "BOR-ding pass", "Keep your boarding pass ready.", "", "", "", "विमान में चढ़ने का पास"],
    ["layover", "a short stop between flights", "LAY-oh-ver", "We had a three-hour layover in Dubai.", "stopover, connection", "", "", "बीच का ठहराव"],
    ["check in", "to register at a hotel or airport", "check IN", "We checked in at the hotel at 2 p.m.", "register", "check out", "Verb: check in; noun: check-in.", "पंजीकरण करना"],
    ["luggage", "bags and suitcases", "LUG-ij", "How much luggage can I carry?", "baggage", "", "Uncountable: no 'luggages'.", "सामान"],
    ["destination", "the place you are travelling to", "des-ti-NAY-shun", "Goa is a popular destination.", "end point", "origin", "", "मंज़िल"],
    ["fare", "the price of a journey", "FAIR", "The taxi fare was ₹350.", "ticket price", "", "Different from 'fair'.", "किराया"],
    ["reservation", "an arrangement to keep a seat or room", "rez-er-VAY-shun", "I have a reservation under the name Mehta.", "booking", "", "", "आरक्षण"],
    ["sightseeing", "visiting famous places", "SITE-see-ing", "We spent the day sightseeing in Jaipur.", "touring", "", "'Go sightseeing'.", "घूमना-फिरना"],
    ["delayed", "later than planned", "di-LAYD", "Our flight is delayed by two hours.", "late, held up", "on time", "", "देर से"],
    ["currency", "the money used in a country", "KUR-un-see", "I need to exchange some currency.", "money", "", "", "मुद्रा"],
    ["souvenir", "something you buy to remember a place", "soo-vuh-NEER", "I bought a souvenir for my sister.", "keepsake, memento", "", "", "यादगार वस्तु"],
    ["accommodation", "a place to stay", "uh-kom-uh-DAY-shun", "Accommodation is included in the package.", "lodging", "", "Note the double 'c' and double 'm'.", "रहने की जगह"],
    ["round trip", "a journey to a place and back", "rownd TRIP", "A round trip ticket is cheaper.", "return journey", "one-way", "", "आने-जाने की यात्रा"],
    ["jet lag", "tiredness after a long flight", "JET lag", "I had terrible jet lag after flying to Canada.", "", "", "", "लंबी उड़ान के बाद की थकान"],
  ],
  business: [
    ["revenue", "income from business activities", "REV-uh-nyoo", "Our revenue grew by 15% this year.", "income, turnover", "expenditure", "", "राजस्व, आय"],
    ["profit margin", "the percentage of revenue that is profit", "PROF-it MAR-jin", "The profit margin is around 20%.", "", "", "", "मुनाफ़े का प्रतिशत"],
    ["negotiate", "to discuss to reach an agreement", "ni-GOH-shee-ate", "We negotiated a better price with the supplier.", "bargain, discuss", "", "", "मोलभाव करना"],
    ["invoice", "a bill for goods or services", "IN-voys", "Please send the invoice by email.", "bill", "", "", "बिल"],
    ["quarter", "a three-month period of the financial year", "KWOR-ter", "Sales were strong in the third quarter.", "Q1/Q2/Q3/Q4", "", "", "तिमाही"],
    ["forecast", "a prediction of future results", "FOR-kast", "The forecast shows steady growth.", "projection, prediction", "", "", "पूर्वानुमान"],
    ["competitor", "a company selling similar products", "kum-PET-i-ter", "Our main competitor launched a new app.", "rival", "partner", "", "प्रतियोगी"],
    ["launch", "to introduce a new product", "LAWNCH", "We will launch the product in March.", "release, introduce", "withdraw", "", "शुरू करना, लॉन्च करना"],
    ["budget", "a plan for spending money", "BUJ-it", "The project is over budget.", "allocation", "", "'On / over / under budget'.", "बजट"],
    ["client", "a customer of a professional service", "KLY-unt", "We have clients in the UK and the US.", "customer", "", "", "ग्राहक"],
    ["deal", "a business agreement", "DEEL", "We closed a big deal yesterday.", "agreement, contract", "", "'Close / seal a deal'.", "सौदा"],
    ["scalable", "able to grow easily", "SKAY-luh-bul", "Cloud services are highly scalable.", "expandable", "", "", "आसानी से बढ़ाया जा सकने वाला"],
    ["ROI", "return on investment", "ar-oh-EYE", "The training had a strong ROI.", "payback", "", "Pronounce each letter.", "निवेश पर लाभ"],
    ["outsource", "to pay another company to do work", "OWT-sorce", "Many firms outsource their IT support.", "subcontract", "insource", "", "बाहरी कंपनी से काम करवाना"],
    ["deliverable", "something to be produced as part of a project", "di-LIV-er-uh-bul", "The first deliverable is due next week.", "output", "", "Usually plural: deliverables.", "परियोजना का परिणाम"],
  ],
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const WORDS: Word[] = (Object.entries(RAW) as Array<[VocabCategory, Raw[]]>).flatMap(([category, rows]) =>
  rows.map(([word, meaning, pron, example, syn, ant, usage, hi]) => ({
    id: `${category}-${slug(word)}`,
    word,
    category,
    meaning,
    pron,
    example,
    synonyms: syn ? syn.split(/,\s*/) : [],
    antonyms: ant ? ant.split(/,\s*/) : [],
    usage,
    hi,
  })),
);

export const WORDS_BY_ID = new Map(WORDS.map((w) => [w.id, w]));
