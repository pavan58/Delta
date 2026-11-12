/** Original IELTS-style reading practice tests (Academic and General Training). */
import type { ReadingTest } from "./types";

const TFNG = ["TRUE", "FALSE", "NOT GIVEN"];
const YNNG = ["YES", "NO", "NOT GIVEN"];

export const READING_TESTS: ReadingTest[] = [
  {
    id: "reading-academic-1",
    variant: "academic",
    title: "Academic Reading — Practice Test 1",
    minutes: 60,
    passages: [
      {
        id: "a1",
        title: "The Return of the Stepwell",
        paragraphs: [
          { label: "A", text: "For more than a thousand years, communities in the dry regions of western India relied on stepwells — deep, stone-lined structures in which flights of steps lead down to the water table. Unlike an ordinary well, from which water is lifted with a rope, a stepwell allowed people to walk down to the water as its level rose and fell with the seasons. Some, such as the elaborate examples in Gujarat, descend seven storeys and are decorated with carved pillars and sculptures." },
          { label: "B", text: "Stepwells were more than sources of water. Because the air near the bottom could be several degrees cooler than at the surface, they became places to rest during the hottest months. They also served as meeting points, especially for women, who were usually responsible for collecting water. Many were funded by wealthy patrons, and inscriptions on their walls record the names of donors who wished to be remembered for their generosity." },
          { label: "C", text: "The decline of the stepwell began in the nineteenth century. Colonial administrators considered them unhygienic and encouraged the construction of piped systems and hand pumps. As groundwater was increasingly extracted by mechanical pumps for agriculture, the water table in many areas fell below the lowest steps. Abandoned stepwells filled with rubbish, and some were demolished to make way for roads." },
          { label: "D", text: "In recent decades, however, interest has revived. Architects and historians have documented hundreds of surviving examples, and several cities have restored stepwells as public spaces. The motivation is not only cultural. As cities face both floods during the monsoon and shortages in the dry season, planners have noticed that stepwells were designed to capture rainwater and recharge underground supplies — a function that modern concrete drainage systems often fail to perform." },
          { label: "E", text: "Restoration is not straightforward. Removing decades of waste can take months, and the original builders' knowledge of local geology was rarely written down. In one well-documented project, engineers discovered that a stepwell had been deliberately sited above a layer of sandy soil that allowed water to soak in quickly; earlier attempts to line it with concrete had actually reduced its capacity. Critics also warn that restored stepwells risk becoming tourist attractions rather than working parts of a city's water system." },
          { label: "F", text: "Supporters argue that both roles can coexist. A stepwell that attracts visitors can raise awareness of water conservation, while its tanks continue to collect rain. What matters, they say, is that restoration is guided by how the structure originally worked, rather than by how it looks in photographs." },
        ],
        groups: [
          {
            instructions: "Questions 1–5. Which paragraph (A–F) contains the following information?",
            optionList: ["A", "B", "C", "D", "E", "F"].map((k) => ({ key: k, text: `Paragraph ${k}` })),
            questions: [
              { id: 1, type: "match", prompt: "a reason why stepwells stopped holding water", options: ["A", "B", "C", "D", "E", "F"], answer: "C" },
              { id: 2, type: "match", prompt: "an example of a modern repair that made a stepwell less effective", options: ["A", "B", "C", "D", "E", "F"], answer: "E" },
              { id: 3, type: "match", prompt: "a difference between stepwells and ordinary wells", options: ["A", "B", "C", "D", "E", "F"], answer: "A" },
              { id: 4, type: "match", prompt: "the social uses of stepwells", options: ["A", "B", "C", "D", "E", "F"], answer: "B" },
              { id: 5, type: "match", prompt: "a practical reason why city planners are interested in stepwells", options: ["A", "B", "C", "D", "E", "F"], answer: "D" },
            ],
          },
          {
            instructions: "Questions 6–10. Do the following statements agree with the information in the passage? Choose TRUE, FALSE or NOT GIVEN.",
            questions: [
              { id: 6, type: "tfng", prompt: "Water in a stepwell stayed at the same level all year.", options: TFNG, answer: "FALSE", explanation: "Paragraph A: the level 'rose and fell with the seasons'." },
              { id: 7, type: "tfng", prompt: "The names of some people who paid for stepwells are carved on them.", options: TFNG, answer: "TRUE" },
              { id: 8, type: "tfng", prompt: "Colonial administrators destroyed most stepwells in Gujarat.", options: TFNG, answer: "NOT GIVEN" },
              { id: 9, type: "tfng", prompt: "Builders of stepwells kept detailed written records of local soil conditions.", options: TFNG, answer: "FALSE" },
              { id: 10, type: "tfng", prompt: "Restored stepwells always attract more tourists than local users.", options: TFNG, answer: "NOT GIVEN" },
            ],
          },
          {
            instructions: "Questions 11–13. Complete the sentences. Choose NO MORE THAN TWO WORDS from the passage.",
            questions: [
              { id: 11, type: "gap", prompt: "Near the bottom of a stepwell, the air was ________ than at the surface.", answer: "cooler|several degrees cooler" },
              { id: 12, type: "gap", prompt: "Stepwells were designed to capture ________ and recharge underground supplies.", answer: "rainwater" },
              { id: 13, type: "gap", prompt: "Supporters say restoration should follow how the structure originally ________.", answer: "worked" },
            ],
          },
        ],
      },
      {
        id: "a2",
        title: "Why We Remember Stories",
        paragraphs: [
          { label: "A", text: "Teachers have long observed that students remember a lesson better when it is presented as a story. Psychologists now have several explanations for this effect. The most widely accepted is that stories provide a structure — a beginning, a problem, and a resolution — that helps the brain organise new information. Facts presented in a list have no such structure and must be memorised individually." },
          { label: "B", text: "A second explanation concerns emotion. Stories usually involve characters who want something and face obstacles. When listeners care about a character, the brain releases chemicals associated with attention and arousal, and these appear to strengthen the formation of memories. Experiments in which participants heard the same facts either as a neutral list or as part of an emotional narrative have consistently found better recall in the narrative group, although the size of the effect varies considerably between studies." },
          { label: "C", text: "Thirdly, stories encourage the listener to form mental images. When we hear that a character 'pushed open the heavy wooden door', we imagine the scene, and that image gives us an additional way to retrieve the information later. This is consistent with the long-established finding that information encoded both verbally and visually is remembered better than information encoded in one form only." },
          { label: "D", text: "Not all researchers are convinced that stories are always beneficial. Some point out that a vivid story can cause people to remember the narrative details while forgetting the key concept it was meant to illustrate. In one study, medical students remembered a dramatic case history in detail but were no better than a control group at applying the underlying principle to a new patient. The researchers concluded that stories help most when the teacher explicitly links the story to the general rule." },
          { label: "E", text: "There is also the question of who tells the story. Studies of workplace training suggest that stories told by colleagues are more persuasive than those told by outside experts, perhaps because listeners identify more closely with the storyteller. However, these studies relied mainly on participants' own reports of what they found useful, rather than on measures of what they actually remembered." },
        ],
        groups: [
          {
            instructions: "Questions 14–18. Choose the correct heading for each paragraph from the list of headings.",
            optionList: [
              { key: "i", text: "The risk of missing the main point" },
              { key: "ii", text: "Feelings and memory" },
              { key: "iii", text: "Why lists are easier to learn" },
              { key: "iv", text: "A framework for organising facts" },
              { key: "v", text: "The influence of the narrator" },
              { key: "vi", text: "Seeing pictures in the mind" },
              { key: "vii", text: "Stories in the history of education" },
            ],
            questions: [
              { id: 14, type: "match", prompt: "Paragraph A", options: ["i", "ii", "iii", "iv", "v", "vi", "vii"], answer: "iv" },
              { id: 15, type: "match", prompt: "Paragraph B", options: ["i", "ii", "iii", "iv", "v", "vi", "vii"], answer: "ii" },
              { id: 16, type: "match", prompt: "Paragraph C", options: ["i", "ii", "iii", "iv", "v", "vi", "vii"], answer: "vi" },
              { id: 17, type: "match", prompt: "Paragraph D", options: ["i", "ii", "iii", "iv", "v", "vi", "vii"], answer: "i" },
              { id: 18, type: "match", prompt: "Paragraph E", options: ["i", "ii", "iii", "iv", "v", "vi", "vii"], answer: "v" },
            ],
          },
          {
            instructions: "Questions 19–22. Do the following statements agree with the views of the writer? Choose YES, NO or NOT GIVEN.",
            questions: [
              { id: 19, type: "ynng", prompt: "Research results on emotional stories and recall are completely uniform.", options: YNNG, answer: "NO" },
              { id: 20, type: "ynng", prompt: "Combining words and images helps memory.", options: YNNG, answer: "YES" },
              { id: 21, type: "ynng", prompt: "Medical schools should stop using case histories.", options: YNNG, answer: "NOT GIVEN" },
              { id: 22, type: "ynng", prompt: "The workplace studies provide strong evidence about memory.", options: YNNG, answer: "NO", explanation: "They relied on self-reports 'rather than on measures of what they actually remembered'." },
            ],
          },
          {
            instructions: "Questions 23–26. Choose the correct letter, A, B, C or D.",
            questions: [
              { id: 23, type: "mcq", prompt: "According to paragraph A, facts in a list are harder to remember because", options: ["they are usually longer.", "they lack an organising structure.", "teachers present them too quickly.", "they do not involve characters."], answer: "B" },
              { id: 24, type: "mcq", prompt: "In the medical study, students who heard the dramatic story", options: ["applied the principle better.", "forgot the story quickly.", "remembered details but not how to use the principle.", "performed worse than the control group."], answer: "C" },
              { id: 25, type: "mcq", prompt: "The researchers in paragraph D recommend that teachers", options: ["avoid emotional stories.", "connect the story clearly to the general rule.", "use only true stories.", "tell shorter stories."], answer: "B" },
              { id: 26, type: "mcq", prompt: "What is the writer's main purpose?", options: ["to prove that stories are the best teaching method", "to explain and evaluate why stories aid memory", "to criticise traditional teaching", "to describe the history of storytelling"], answer: "B" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "reading-general-1",
    variant: "general",
    title: "General Training Reading — Practice Test 1",
    minutes: 60,
    passages: [
      {
        id: "g1",
        title: "Section 1 — Community notices",
        paragraphs: [
          { label: "A", text: "Sunrise Yoga in the Park — Free sessions every Saturday from 7:00 to 8:00 a.m. near the north gate. Bring your own mat. Sessions are cancelled if it rains; check our social media page by 6:30 a.m." },
          { label: "B", text: "Lost and Found — The library front desk holds items found in the building for 30 days. After that, unclaimed items are donated to charity. Mobile phones and wallets are handed to the local police station after 48 hours." },
          { label: "C", text: "Computer Basics for Seniors — A six-week course for residents over 60. Learn to send emails, make video calls and shop safely online. Classes are on Tuesday afternoons. The course is free, but places are limited to 12, so please register at the community office." },
          { label: "D", text: "Repair Café — Bring broken toasters, lamps, clothes and bicycles to be fixed by volunteers. First Sunday of every month, 10 a.m. to 1 p.m., in the school hall. Donations towards spare parts are welcome but not required. We cannot repair mobile phones or laptops." },
          { label: "E", text: "Weekend Farmers' Market — Fresh local produce every Sunday from 8 a.m. Please note: from next month, the market will move from the station car park to Green Street because of construction work." },
        ],
        groups: [
          {
            instructions: "Questions 1–7. Which notice (A–E) mentions the following? You may use any letter more than once.",
            optionList: ["A", "B", "C", "D", "E"].map((k) => ({ key: k, text: `Notice ${k}` })),
            questions: [
              { id: 1, type: "match", prompt: "a change of location", options: ["A", "B", "C", "D", "E"], answer: "E" },
              { id: 2, type: "match", prompt: "an activity that depends on the weather", options: ["A", "B", "C", "D", "E"], answer: "A" },
              { id: 3, type: "match", prompt: "a limit on the number of participants", options: ["A", "B", "C", "D", "E"], answer: "C" },
              { id: 4, type: "match", prompt: "items that will not be accepted", options: ["A", "B", "C", "D", "E"], answer: "D" },
              { id: 5, type: "match", prompt: "what happens to items that nobody collects", options: ["A", "B", "C", "D", "E"], answer: "B" },
              { id: 6, type: "match", prompt: "something participants need to bring", options: ["A", "B", "C", "D", "E"], answer: "A" },
              { id: 7, type: "match", prompt: "a service aimed at an age group", options: ["A", "B", "C", "D", "E"], answer: "C" },
            ],
          },
          {
            instructions: "Questions 8–10. Do the following statements agree with the information? Choose TRUE, FALSE or NOT GIVEN.",
            questions: [
              { id: 8, type: "tfng", prompt: "Lost wallets are kept at the library for 30 days.", options: TFNG, answer: "FALSE" },
              { id: 9, type: "tfng", prompt: "You must pay to have something repaired at the Repair Café.", options: TFNG, answer: "FALSE" },
              { id: 10, type: "tfng", prompt: "The farmers' market sells organic meat.", options: TFNG, answer: "NOT GIVEN" },
            ],
          },
        ],
      },
      {
        id: "g2",
        title: "Section 2 — New starter guide: working at Northwind Logistics",
        paragraphs: [
          { label: "A", text: "Welcome to Northwind Logistics. During your first week you will complete an induction programme covering health and safety, our IT systems and company policies. Your line manager will meet you on your first morning and introduce you to a 'buddy' — an experienced colleague you can ask for help during your first three months." },
          { label: "B", text: "Working hours: Office staff work 37.5 hours per week. Core hours are 10 a.m. to 3 p.m., when all office staff must be available; outside these hours you may choose your start and finish times, with your manager's agreement. Warehouse staff work fixed shifts, which are published two weeks in advance." },
          { label: "C", text: "Leave: Full-time employees receive 25 days of annual leave plus public holidays. Leave requests must be submitted through the HR portal at least two weeks in advance, except in emergencies. Up to five unused days may be carried over to the following year." },
          { label: "D", text: "Sickness: If you are unable to work because of illness, you must call — not email — your line manager before your shift or by 9:30 a.m. For absences of more than seven calendar days, a doctor's note is required." },
          { label: "E", text: "Training: All employees are entitled to five days of paid training per year. Courses directly related to your role are paid for by the company. For other qualifications, you may apply for partial funding, which is decided by the training committee each quarter." },
        ],
        groups: [
          {
            instructions: "Questions 11–17. Complete the sentences. Write NO MORE THAN TWO WORDS AND/OR A NUMBER from the text.",
            questions: [
              { id: 11, type: "gap", prompt: "A new employee's ________ is an experienced colleague who helps them.", answer: "buddy" },
              { id: 12, type: "gap", prompt: "Office staff must be available during ________, between 10 a.m. and 3 p.m.", answer: "core hours" },
              { id: 13, type: "gap", prompt: "Warehouse shifts are published ________ in advance.", answer: "two weeks|2 weeks" },
              { id: 14, type: "gap", prompt: "Employees can carry over up to ________ days of leave.", answer: "five|5" },
              { id: 15, type: "gap", prompt: "Leave must be requested through the ________.", answer: "HR portal" },
              { id: 16, type: "gap", prompt: "To report sickness, staff must ________ their line manager.", answer: "call" },
              { id: 17, type: "gap", prompt: "A ________ is needed for absences longer than seven days.", answer: "doctor's note|doctors note" },
            ],
          },
          {
            instructions: "Questions 18–20. Choose the correct letter, A, B or C.",
            questions: [
              { id: 18, type: "mcq", prompt: "Who decides on funding for courses not related to an employee's role?", options: ["the line manager", "the training committee", "the HR department"], answer: "B" },
              { id: 19, type: "mcq", prompt: "Office staff can change their start time", options: ["whenever they like.", "if their manager agrees.", "only during induction."], answer: "B" },
              { id: 20, type: "mcq", prompt: "How long does the buddy arrangement last?", options: ["one week", "two weeks", "three months"], answer: "C" },
            ],
          },
        ],
      },
      {
        id: "g3",
        title: "Section 3 — The quiet rise of the night train",
        paragraphs: [
          { label: "A", text: "Twenty years ago, many European rail companies were cutting their overnight services. Low-cost airlines offered fares that trains could not match, and sleeper carriages were expensive to maintain. Today, night trains are making a comeback, with new routes linking major cities across several countries." },
          { label: "B", text: "The most obvious reason is environmental. A growing number of travellers want to avoid flying because of its carbon emissions, and a night train allows them to cover long distances without losing a day of their holiday or business trip. Governments have also supported the revival with subsidies, seeing rail as a way to meet climate targets." },
          { label: "C", text: "Convenience is another factor. Trains depart from and arrive in city centres, avoiding the time-consuming journeys to and from airports, as well as security queues. For business travellers, arriving refreshed at 8 a.m. in the centre of another capital can be more attractive than an early-morning flight." },
          { label: "D", text: "Yet challenges remain. Each country has its own rail regulations, safety systems and electricity standards, which makes cross-border services complicated and expensive. Tickets are often sold by different companies, so passengers sometimes find it difficult to book a journey that crosses several networks. And while prices have improved, a private sleeping compartment can still cost more than a flight and a hotel combined." },
          { label: "E", text: "Operators are experimenting with solutions, such as 'pod' beds that offer privacy at a lower price than a full compartment, and booking platforms that combine tickets from several countries. Whether night trains can grow beyond a niche market will depend largely on whether these efforts succeed in making them both simple and affordable." },
        ],
        groups: [
          {
            instructions: "Questions 21–26. Choose the correct letter, A, B, C or D.",
            questions: [
              { id: 21, type: "mcq", prompt: "Why were night trains reduced in the past?", options: ["They were unsafe.", "They could not compete with cheap flights.", "Passengers disliked sleeping on trains.", "Governments banned them."], answer: "B" },
              { id: 22, type: "mcq", prompt: "According to paragraph B, governments support night trains because", options: ["they create jobs.", "they help reach climate goals.", "they are profitable.", "airlines asked them to."], answer: "B" },
              { id: 23, type: "mcq", prompt: "One advantage for business travellers is", options: ["free meals.", "arriving in the city centre in the morning.", "cheaper fares than flights.", "fewer passengers."], answer: "B" },
              { id: 24, type: "mcq", prompt: "Cross-border services are complicated because", options: ["countries use different rail systems and standards.", "there are not enough drivers.", "stations are closed at night.", "trains are too slow."], answer: "A" },
              { id: 25, type: "mcq", prompt: "What are 'pod' beds intended to provide?", options: ["more space", "privacy at a lower cost", "faster journeys", "business facilities"], answer: "B" },
              { id: 26, type: "mcq", prompt: "The writer's view of the future of night trains is", options: ["very positive.", "very negative.", "uncertain.", "not stated."], answer: "C" },
            ],
          },
        ],
      },
    ],
  },
];

export function getReadingTest(variant: "academic" | "general") {
  return READING_TESTS.find((t) => t.variant === variant)!;
}
