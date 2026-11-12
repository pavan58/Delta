/** Original IELTS-style writing prompts. Chart data is fictional and for practice only. */

export type WritingTaskType = "task1-academic" | "task1-general" | "task2";

export interface ChartSpec {
  kind: "line" | "bar" | "table" | "pie" | "process" | "map";
  title: string;
  unit?: string;
  categories?: string[];
  series?: Array<{ name: string; values: number[] }>;
  rows?: string[][];
  steps?: string[];
  maps?: Array<{ year: string; features: string[] }>;
}

export interface WritingPrompt {
  id: string;
  task: WritingTaskType;
  label: string;
  prompt: string;
  chart?: ChartSpec;
  bullets?: string[];
  keywords: string[];
  model?: string;
  outline: string[];
}

export const WRITING_PROMPTS: WritingPrompt[] = [
  {
    id: "w1-line", task: "task1-academic", label: "Line graph",
    prompt: "The graph below shows the percentage of households with internet access in three countries between 2000 and 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.",
    chart: { kind: "line", title: "Households with internet access (%)", unit: "%", categories: ["2000", "2005", "2010", "2015", "2020"], series: [{ name: "Country A", values: [40, 62, 78, 88, 95] }, { name: "Country B", values: [12, 25, 45, 70, 86] }, { name: "Country C", values: [3, 6, 15, 38, 64] }] },
    keywords: ["internet", "households", "percentage", "increase", "overall", "2000", "2020", "country"],
    outline: ["Paraphrase: The line graph illustrates the proportion of homes with internet access in three nations over two decades.", "Overview: Access rose in all three countries; Country A remained the highest throughout, while Country C grew fastest after 2010.", "Body 1: Country A — 40% → 95%, steady growth. Country B — 12% → 86%, rapid rise after 2005.", "Body 2: Country C — very low (3%) until 2010, then a sharp increase to 64% by 2020; the gap narrowed."],
    model: "The line graph compares the proportion of households with internet access in three countries over a twenty-year period from 2000 to 2020.\n\nOverall, internet access increased considerably in all three nations. Country A had the highest level of access throughout the period, while Country C, despite starting from a very low base, experienced the most dramatic growth in the final decade.\n\nIn 2000, 40% of households in Country A were connected, compared with just 12% in Country B and only 3% in Country C. Country A's figure rose steadily, reaching 78% in 2010 and almost universal access, at 95%, by 2020. Country B showed a similar upward trend but at a faster pace after 2005, climbing from 25% to 70% in ten years and finishing at 86%.\n\nCountry C, by contrast, saw little change in the first decade, with access remaining below 15% until 2010. After that point, however, the figure rose sharply, more than quadrupling to 64% in 2020. As a result, the gap between the three countries narrowed significantly by the end of the period.",
  },
  {
    id: "w1-bar", task: "task1-academic", label: "Bar chart",
    prompt: "The chart below shows how many hours per week students in four age groups spent on different activities in 2023. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.",
    chart: { kind: "bar", title: "Average hours per week, 2023", unit: "hours", categories: ["13–15", "16–18", "19–21", "22–24"], series: [{ name: "Studying", values: [14, 20, 18, 12] }, { name: "Social media", values: [12, 15, 13, 10] }, { name: "Sport", values: [7, 5, 4, 4] }] },
    keywords: ["hours", "studying", "social media", "sport", "age", "overall", "highest", "lowest"],
    outline: ["Paraphrase the chart (what, who, when).", "Overview: studying took the most time in every age group; sport the least; 16–18-year-olds were busiest.", "Body 1: studying and social media across age groups (peak at 16–18).", "Body 2: sport declined with age (7 → 4 hours)."],
  },
  {
    id: "w1-table", task: "task1-academic", label: "Table",
    prompt: "The table below shows the number of visitors (in thousands) to four museums in a city in 2010 and 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.",
    chart: { kind: "table", title: "Museum visitors (thousands)", rows: [["Museum", "2010", "2020"], ["Science Museum", "420", "610"], ["Art Gallery", "380", "300"], ["History Museum", "290", "350"], ["Children's Museum", "110", "240"]] },
    keywords: ["visitors", "museum", "thousand", "increase", "decrease", "2010", "2020", "overall"],
    outline: ["Paraphrase the table.", "Overview: three museums gained visitors, only the Art Gallery declined; the Science Museum was the most popular in both years.", "Body 1: biggest rises (Science +190k; Children's more than doubled).", "Body 2: History Museum's moderate rise vs the Art Gallery's fall (380k → 300k)."],
  },
  {
    id: "w1-process", task: "task1-academic", label: "Process",
    prompt: "The diagram below shows how plastic bottles are recycled. Summarise the information by selecting and reporting the main features. Write at least 150 words.",
    chart: { kind: "process", title: "Recycling plastic bottles", steps: ["Bottles collected from homes", "Transported to recycling plant", "Sorted by type and colour", "Washed and labels removed", "Crushed into small flakes", "Melted and formed into pellets", "Pellets used to make new products"] },
    keywords: ["process", "stages", "first", "then", "next", "finally", "collected", "sorted", "melted", "pellets"],
    outline: ["Paraphrase: the diagram illustrates the stages in recycling plastic bottles.", "Overview: a seven-stage linear process from collection to new products.", "Body 1: collection, transport, sorting, washing (use passive voice: 'are collected').", "Body 2: crushing, melting, pellets, new products (sequence words)."],
  },
  {
    id: "w1-map", task: "task1-academic", label: "Maps",
    prompt: "The maps below show a seaside village in 2000 and today. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.",
    chart: { kind: "map", title: "Seaside village", maps: [{ year: "2000", features: ["Fishing harbour (south)", "Small houses near beach", "Farmland (north)", "One main road", "Forest (east)"] }, { year: "Today", features: ["Marina for leisure boats (south)", "Hotels along the beach", "Housing estate replaces farmland (north)", "Main road + new car park", "Forest reduced; golf course (east)"] }] },
    keywords: ["village", "map", "changed", "replaced", "built", "developed", "overall", "tourism"],
    outline: ["Paraphrase the maps.", "Overview: the village changed from a fishing/farming community to a tourist destination.", "Body 1: coast — harbour → marina; houses → hotels.", "Body 2: inland — farmland → housing; forest partly → golf course; new car park."],
  },
  {
    id: "w1g-formal", task: "task1-general", label: "Formal letter",
    prompt: "You recently bought a washing machine from an online store, but it was delivered damaged. Write a letter to the store's customer service manager. In your letter: describe the problem; explain how this has affected you; say what you would like the store to do. Write at least 150 words. You do NOT need to write any addresses. Begin your letter as follows: Dear Sir or Madam,",
    bullets: ["describe the problem", "explain how this has affected you", "say what you would like the store to do"],
    keywords: ["dear", "washing machine", "damaged", "delivered", "order", "refund", "replacement", "yours faithfully"],
    outline: ["Opening: I am writing to complain about a washing machine (order number) delivered on …", "Problem: dent, door would not close, leaking water.", "Effect: unable to wash clothes for a week; had to use a laundry service; took a day off work.", "Request: replacement within 5 days or full refund + collection; compensation for laundry costs.", "Close: I look forward to your prompt reply. Yours faithfully,"],
    model: "Dear Sir or Madam,\n\nI am writing to complain about a washing machine that I ordered from your website on 3 March (order number WM-48213), which was delivered in a damaged condition.\n\nWhen the machine arrived on 6 March, I noticed a large dent on the side panel. More seriously, the door does not close properly, and when I attempted to run a short wash, water leaked onto the kitchen floor.\n\nThis has caused me considerable inconvenience. As I have two young children, I need to do laundry almost every day, and I have had to pay a local laundry service for the past week. In addition, I had to take a day off work to wait for the delivery, which has now been wasted.\n\nI would therefore like you to deliver a replacement machine within the next five working days and collect the damaged one at the same time. Alternatively, I would accept a full refund. I would also appreciate it if you could reimburse the laundry costs, for which I can provide receipts.\n\nI look forward to your prompt reply.\n\nYours faithfully,\nRahul Mehta",
  },
  {
    id: "w1g-informal", task: "task1-general", label: "Informal letter",
    prompt: "A friend is coming to visit your city for the first time next month. Write a letter to your friend. In your letter: suggest the best time to visit; recommend places to see; give advice about getting around. Write at least 150 words. Begin your letter as follows: Dear …,",
    bullets: ["suggest the best time to visit", "recommend places to see", "give advice about getting around"],
    keywords: ["dear", "visit", "weather", "recommend", "must", "metro", "bus", "best wishes"],
    outline: ["Friendly opening: excited about the visit.", "Best time: early mornings / avoid weekend crowds / weather.", "Places: 2–3 with personal reasons.", "Transport: metro card, avoid rush hour, app-based cabs.", "Close: can't wait to see you! Best wishes,"],
  },
  {
    id: "w1g-semi", task: "task1-general", label: "Semi-formal letter",
    prompt: "Your neighbour has been making a lot of noise late at night. Write a letter to your neighbour. In your letter: describe the problem; explain how it is affecting you; suggest a solution. Write at least 150 words. Begin your letter as follows: Dear …,",
    bullets: ["describe the problem", "explain how it is affecting you", "suggest a solution"],
    keywords: ["dear", "noise", "night", "sleep", "work", "suggest", "appreciate", "regards"],
    outline: ["Polite opening; introduce yourself (flat number).", "Problem: loud music after 11 p.m. several nights a week.", "Effect: can't sleep, tired at work, child's exams.", "Solution: lower volume after 10:30 p.m.; happy to talk.", "Close: Thank you for understanding. Kind regards,"],
  },
  {
    id: "w2-opinion", task: "task2", label: "Opinion essay",
    prompt: "Some people believe that university education should be free for all students. To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.",
    keywords: ["university", "education", "free", "students", "government", "tax", "opportunity", "agree"],
    outline: ["Intro: paraphrase + clear position (e.g. largely agree).", "Body 1: equal opportunity — talented students from low-income families; example.", "Body 2: concession — cost to taxpayers; solution: partial funding / income-based repayment.", "Conclusion: restate position and main reason."],
    model: "In many countries, the cost of higher education has risen sharply, leading some to argue that university should be free for every student. I largely agree with this view, although I believe the policy needs to be designed carefully.\n\nThe main argument for free university education is that it gives equal opportunities to all young people. At present, many talented students from low-income families do not apply to university because they cannot afford the fees or are afraid of large debts. If tuition were free, a student's future would depend on ability and effort rather than family wealth. Countries such as Germany, where tuition is largely free, show that this approach can produce a highly skilled workforce.\n\nAdmittedly, free education is expensive, and the cost must be paid through taxation. Critics also argue that some students may choose courses with few job prospects, wasting public money. However, these problems can be reduced. Governments could limit free places to subjects in which there is a shortage of workers, or require graduates who earn high salaries to contribute through a small additional tax.\n\nIn conclusion, I believe that university education should be free, because it rewards talent and benefits society as a whole. Nevertheless, governments should introduce sensible limits to ensure that public money is used effectively.",
  },
  {
    id: "w2-discussion", task: "task2", label: "Discussion essay",
    prompt: "Some people think that children should start learning a foreign language at primary school, while others believe it is better to start at secondary school. Discuss both views and give your own opinion. Write at least 250 words.",
    keywords: ["children", "foreign language", "primary", "secondary", "school", "learn", "however", "opinion"],
    outline: ["Intro: paraphrase + say you will discuss both views + your opinion.", "Body 1: primary — young children imitate pronunciation, less anxiety.", "Body 2: secondary — strong first-language base, analytical learning, teacher shortages.", "Body 3/Conclusion: your view with reason."],
  },
  {
    id: "w2-advdis", task: "task2", label: "Advantages & disadvantages",
    prompt: "More and more people are choosing to work from home. Do the advantages of this trend outweigh the disadvantages? Write at least 250 words.",
    keywords: ["work from home", "advantages", "disadvantages", "commute", "isolation", "productivity", "outweigh", "employees"],
    outline: ["Intro: paraphrase + position (advantages outweigh / do not).", "Body 1: advantages — no commute, flexibility, cost savings.", "Body 2: disadvantages — isolation, blurred boundaries, weaker teamwork.", "Conclusion: weigh them and restate position."],
  },
  {
    id: "w2-problem", task: "task2", label: "Problem & solution",
    prompt: "In many cities, traffic congestion is becoming a serious problem. What are the causes of this problem, and what measures could be taken to solve it? Write at least 250 words.",
    keywords: ["traffic", "congestion", "cities", "cars", "public transport", "causes", "solutions", "government"],
    outline: ["Intro: paraphrase + mention causes and solutions.", "Body 1: causes — rising car ownership, poor public transport, urban sprawl.", "Body 2: solutions — invest in metro/bus, congestion charges, flexible working.", "Conclusion: summarise."],
  },
  {
    id: "w2-twopart", task: "task2", label: "Two-part question",
    prompt: "Nowadays, many young people spend a lot of time on social media. Why is this the case? Is this a positive or negative development? Write at least 250 words.",
    keywords: ["young people", "social media", "time", "why", "positive", "negative", "friends", "development"],
    outline: ["Intro: paraphrase + answer both questions briefly.", "Body 1: reasons — staying connected, entertainment, peer pressure, smartphones.", "Body 2: positive or negative — your view with examples.", "Conclusion: restate both answers."],
  },
];

export function promptsFor(task: WritingTaskType) {
  return WRITING_PROMPTS.filter((p) => p.task === task);
}
