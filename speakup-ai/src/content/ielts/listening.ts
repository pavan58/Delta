/**
 * Original IELTS-style listening practice test. Audio is generated with the
 * browser's speech synthesis, which is NOT the same as official IELTS
 * recordings (accents, pace and audio quality differ).
 */
import type { ListeningSection } from "./types";

export const LISTENING_TEST_ID = "listening-1";

export const LISTENING_SECTIONS: ListeningSection[] = [
  {
    id: 1,
    title: "Section 1 — Joining a sports centre",
    context: "A man phones the Riverside Community Sports Centre to ask about membership.",
    speakers: { Receptionist: "female", Caller: "male" },
    script: [
      { speaker: "Receptionist", text: "Good morning, Riverside Community Sports Centre. Anita speaking. How can I help?" },
      { speaker: "Caller", text: "Hi. I'd like to join the centre, and I have a few questions about membership." },
      { speaker: "Receptionist", text: "Of course. I can take your details now if you like. What's your full name?" },
      { speaker: "Caller", text: "It's Daniel Fernandes. That's F-E-R-N-A-N-D-E-S." },
      { speaker: "Receptionist", text: "Thank you, Daniel. And what's your address?" },
      { speaker: "Caller", text: "Flat 4, 27 Hillcrest Road." },
      { speaker: "Receptionist", text: "Hillcrest Road. Got it. And a contact number?" },
      { speaker: "Caller", text: "Sure, it's 07946 318 552." },
      { speaker: "Receptionist", text: "Lovely. Now, we have three types of membership. Off-peak is twenty-two pounds a month, but you can only come before four p.m. on weekdays. Standard is thirty-five pounds and gives you access at any time. And Family is fifty-eight pounds for two adults and up to three children." },
      { speaker: "Caller", text: "I work during the day, so I think standard is best for me." },
      { speaker: "Receptionist", text: "Standard it is. Is there any particular activity you're interested in?" },
      { speaker: "Caller", text: "Mainly swimming. I used to play badminton, but I've hurt my shoulder, so swimming is easier now." },
      { speaker: "Receptionist", text: "Our pool is open until ten p.m. One thing — new members have to attend an induction session before using the gym, but not the pool. The next induction is on Thursday at six thirty." },
      { speaker: "Caller", text: "Thursday works. Do I need to bring anything?" },
      { speaker: "Receptionist", text: "Just a photo for your membership card. We used to ask for a utility bill as proof of address, but that's no longer necessary. And you'll need a padlock if you want to use a locker." },
      { speaker: "Caller", text: "Great. How do I pay?" },
      { speaker: "Receptionist", text: "Most people pay monthly by direct debit. There's no joining fee this month because of our spring offer, which normally costs fifteen pounds." },
      { speaker: "Caller", text: "Even better. And is there parking?" },
      { speaker: "Receptionist", text: "Yes, there's a free car park behind the building, but it fills up quickly in the evenings. Many members cycle — we have covered bike racks next to the main entrance." },
      { speaker: "Caller", text: "Perfect, I'll probably cycle then. Thanks for your help." },
    ],
    groups: [
      {
        instructions: "Questions 1–6. Complete the form below. Write ONE WORD AND/OR A NUMBER for each answer.",
        questions: [
          { id: 1, type: "gap", prompt: "Surname: ________", answer: "Fernandes" },
          { id: 2, type: "gap", prompt: "Address: Flat 4, 27 ________ Road", answer: "Hillcrest" },
          { id: 3, type: "gap", prompt: "Membership type: ________", answer: "standard" },
          { id: 4, type: "gap", prompt: "Monthly cost: £ ________", answer: "35|thirty-five" },
          { id: 5, type: "gap", prompt: "Main activity: ________", answer: "swimming" },
          { id: 6, type: "gap", prompt: "Induction day: ________", answer: "Thursday" },
        ],
      },
      {
        instructions: "Questions 7–10. Choose the correct letter, A, B or C.",
        questions: [
          { id: 7, type: "mcq", prompt: "What must new members bring?", options: ["a utility bill", "a photograph", "a padlock"], answer: "B", explanation: "A utility bill is 'no longer necessary'; the padlock is only needed for lockers." },
          { id: 8, type: "mcq", prompt: "The induction is required for", options: ["the pool.", "the gym.", "all facilities."], answer: "B" },
          { id: 9, type: "mcq", prompt: "This month, the joining fee is", options: ["free.", "£15.", "£22."], answer: "A" },
          { id: 10, type: "mcq", prompt: "How will Daniel probably travel to the centre?", options: ["by car", "by bus", "by bicycle"], answer: "C" },
        ],
      },
    ],
  },
  {
    id: 2,
    title: "Section 2 — Greenfield Heritage Park",
    context: "A guide welcomes visitors to Greenfield Heritage Park and describes its layout.",
    speakers: { Guide: "male" },
    script: [
      { speaker: "Guide", text: "Good afternoon, everyone, and welcome to Greenfield Heritage Park. My name is Ravi, and I'll give you a quick overview before you explore on your own." },
      { speaker: "Guide", text: "We're standing at the main gate, which is at the bottom of your map. Directly in front of us is the central lawn. On the right side of the lawn, the long building with the green roof is the Visitor Centre, where you can pick up audio guides and buy tickets for special exhibitions." },
      { speaker: "Guide", text: "If you walk straight across the lawn to the far side, you'll reach the old textile mill. It's the largest building in the park and now houses our museum of local industry." },
      { speaker: "Guide", text: "To the left of the mill, beside the river, is the café. It has a lovely terrace overlooking the water, though it can be busy at lunchtime." },
      { speaker: "Guide", text: "Now, go back towards the main gate. On the left side of the lawn, you'll see the children's playground, and just behind it, closer to the river, is the boathouse, where you can hire rowing boats until five o'clock." },
      { speaker: "Guide", text: "Finally, the toilets are next to the Visitor Centre, on the side nearest the main gate." },
      { speaker: "Guide", text: "A few practical points. The park was originally opened in 1962, but the mill museum only opened after a major restoration in 2015. Most of the money for the restoration came from a national lottery grant, although local businesses also donated." },
      { speaker: "Guide", text: "Photography is welcome everywhere except inside the weaving hall of the museum, because flash can damage the old fabrics. Dogs are allowed in the park on a lead, but not inside any buildings." },
      { speaker: "Guide", text: "Today, there's a free demonstration of traditional weaving at three o'clock. Please note it's in the mill courtyard, not inside the museum, as the hall is closed for cleaning." },
      { speaker: "Guide", text: "And if you're interested in volunteering, we're especially looking for people to help in the garden on weekends. You can sign up at the Visitor Centre. Enjoy your visit!" },
    ],
    groups: [
      {
        instructions: "Questions 11–15. Label the map. Write the correct letter, A–H, next to each place.",
        diagram: "park-map",
        questions: [
          { id: 11, type: "map", prompt: "Visitor Centre", options: ["A", "B", "C", "D", "E", "F", "G", "H"], answer: "E" },
          { id: 12, type: "map", prompt: "Textile mill (museum)", options: ["A", "B", "C", "D", "E", "F", "G", "H"], answer: "B" },
          { id: 13, type: "map", prompt: "Café", options: ["A", "B", "C", "D", "E", "F", "G", "H"], answer: "A" },
          { id: 14, type: "map", prompt: "Boathouse", options: ["A", "B", "C", "D", "E", "F", "G", "H"], answer: "C" },
          { id: 15, type: "map", prompt: "Toilets", options: ["A", "B", "C", "D", "E", "F", "G", "H"], answer: "F" },
        ],
      },
      {
        instructions: "Questions 16–20. Choose the correct letter, A, B or C.",
        questions: [
          { id: 16, type: "mcq", prompt: "When did the mill museum open?", options: ["1962", "2015", "2005"], answer: "B" },
          { id: 17, type: "mcq", prompt: "The restoration was mainly paid for by", options: ["local businesses.", "a lottery grant.", "ticket sales."], answer: "B" },
          { id: 18, type: "mcq", prompt: "Photography is NOT allowed", options: ["in the weaving hall.", "in the café.", "anywhere in the museum."], answer: "A" },
          { id: 19, type: "mcq", prompt: "Where is today's weaving demonstration?", options: ["in the weaving hall", "in the Visitor Centre", "in the mill courtyard"], answer: "C" },
          { id: 20, type: "mcq", prompt: "Volunteers are especially needed", options: ["in the garden.", "in the museum shop.", "at the boathouse."], answer: "A" },
        ],
      },
    ],
  },
  {
    id: 3,
    title: "Section 3 — Planning a group project",
    context: "Two students, Meera and Tom, discuss their research project on food waste with their tutor, Dr Collins.",
    speakers: { "Dr Collins": "female", Meera: "female", Tom: "male" },
    script: [
      { speaker: "Dr Collins", text: "So, Meera, Tom, how is your project on food waste in student halls coming along?" },
      { speaker: "Meera", text: "Quite well, I think. We've agreed to divide the work. I'm going to design the questionnaire, because I did something similar in my first year." },
      { speaker: "Tom", text: "And I'll handle the interviews with the catering staff. I've already emailed the kitchen manager." },
      { speaker: "Dr Collins", text: "Good. Who's going to analyse the data?" },
      { speaker: "Meera", text: "We thought we'd both do that together, so we can check each other's work." },
      { speaker: "Dr Collins", text: "Sensible. And the literature review?" },
      { speaker: "Tom", text: "That's mine as well. Meera will write the final recommendations section, because she's better at persuasive writing." },
      { speaker: "Meera", text: "And the presentation slides — we haven't decided yet, but probably Tom, since he's good with design software." },
      { speaker: "Tom", text: "Fine by me." },
      { speaker: "Dr Collins", text: "Now, about your sample. How many students are you planning to survey?" },
      { speaker: "Meera", text: "We first said fifty, but we realised that's too small to compare different halls, so now we're aiming for a hundred and twenty." },
      { speaker: "Dr Collins", text: "That's more realistic. What do you expect the biggest challenge to be?" },
      { speaker: "Tom", text: "Honestly, getting people to respond. Students ignore emails. So we're going to put posters with a QR code in the dining halls." },
      { speaker: "Dr Collins", text: "Good idea, and you could offer a small incentive. What about measuring the waste itself?" },
      { speaker: "Meera", text: "We wanted to weigh the waste every day, but the kitchen said that's not practical. So we'll weigh it on three sample days instead." },
      { speaker: "Dr Collins", text: "That's acceptable if you explain the limitation clearly. And what did you find most surprising so far?" },
      { speaker: "Tom", text: "That most of the waste isn't from plates. It's food that's prepared but never served." },
      { speaker: "Dr Collins", text: "Interesting — that changes your recommendations. When's your draft due?" },
      { speaker: "Meera", text: "The fourteenth of March, but we'd like feedback from you on the questionnaire before we send it, if possible." },
      { speaker: "Dr Collins", text: "Send it by Friday and I'll comment over the weekend." },
    ],
    groups: [
      {
        instructions: "Questions 21–25. Who will do each task? Choose A, B or C.",
        optionList: [{ key: "A", text: "Meera" }, { key: "B", text: "Tom" }, { key: "C", text: "both Meera and Tom" }],
        questions: [
          { id: 21, type: "match", prompt: "designing the questionnaire", options: ["A", "B", "C"], answer: "A" },
          { id: 22, type: "match", prompt: "interviewing catering staff", options: ["A", "B", "C"], answer: "B" },
          { id: 23, type: "match", prompt: "analysing the data", options: ["A", "B", "C"], answer: "C" },
          { id: 24, type: "match", prompt: "the literature review", options: ["A", "B", "C"], answer: "B" },
          { id: 25, type: "match", prompt: "writing the recommendations", options: ["A", "B", "C"], answer: "A" },
        ],
      },
      {
        instructions: "Questions 26–30. Choose the correct letter, A, B or C.",
        questions: [
          { id: 26, type: "mcq", prompt: "How many students do they now plan to survey?", options: ["50", "100", "120"], answer: "C" },
          { id: 27, type: "mcq", prompt: "To increase responses, the students will", options: ["send reminder emails.", "display posters with a QR code.", "offer a cash prize."], answer: "B" },
          { id: 28, type: "mcq", prompt: "The food waste will be weighed", options: ["every day.", "on three days.", "once a week."], answer: "B" },
          { id: 29, type: "mcq", prompt: "What surprised the students?", options: ["Most waste is food that is never served.", "Students waste more than staff.", "Plate waste is increasing."], answer: "A" },
          { id: 30, type: "mcq", prompt: "When will they send the questionnaire to Dr Collins?", options: ["by Friday", "at the weekend", "by 14 March"], answer: "A" },
        ],
      },
    ],
  },
  {
    id: 4,
    title: "Section 4 — Lecture: urban beekeeping",
    context: "A lecturer gives a talk about beekeeping in cities.",
    speakers: { Lecturer: "female" },
    script: [
      { speaker: "Lecturer", text: "Today I want to look at a trend that surprises many people: keeping bees in cities. Over the last fifteen years, the number of hives on rooftops and in community gardens has grown rapidly in many large cities." },
      { speaker: "Lecturer", text: "Why are cities good for bees? First, temperature. Cities are usually a few degrees warmer than the countryside, which means the bees' active season starts earlier and lasts longer." },
      { speaker: "Lecturer", text: "Second, variety. Parks, balconies and street trees offer a wide range of flowers, whereas modern farmland is often dominated by a single crop. This variety gives urban bees a more balanced diet." },
      { speaker: "Lecturer", text: "Third, and perhaps surprisingly, chemicals. Gardeners in cities tend to use fewer pesticides than large farms, so bees are exposed to lower levels of harmful substances." },
      { speaker: "Lecturer", text: "However, there are concerns. The most serious is competition. Honeybees kept in hives can compete with wild bees for the same flowers. If too many hives are placed in one area, wild species may struggle to find enough food." },
      { speaker: "Lecturer", text: "For this reason, some researchers argue that cities should limit the number of hives per square kilometre, and plant more flowers rather than simply adding hives." },
      { speaker: "Lecturer", text: "Another issue is disease. When hives are close together, infections can spread quickly, so regular inspection by trained keepers is essential." },
      { speaker: "Lecturer", text: "What about the honey itself? Studies of urban honey have found it is generally safe to eat. In fact, researchers have used honey as a way to monitor air pollution, because traces of metals from traffic can be detected in it." },
      { speaker: "Lecturer", text: "Finally, urban beekeeping has a strong educational value. Schools that keep bees report that students become more interested in biology and the environment." },
      { speaker: "Lecturer", text: "To conclude, urban beekeeping can benefit both people and pollinators, but only if it is carefully managed, with planting and wild bees given as much attention as hives." },
    ],
    groups: [
      {
        instructions: "Questions 31–40. Complete the notes below. Write ONE WORD ONLY for each answer.",
        questions: [
          { id: 31, type: "gap", prompt: "Hives are found on rooftops and in community ________.", answer: "gardens" },
          { id: 32, type: "gap", prompt: "Advantage 1: Cities are warmer, so the active ________ is longer.", answer: "season" },
          { id: 33, type: "gap", prompt: "Advantage 2: A wide ________ of flowers gives bees a balanced diet.", answer: "range|variety" },
          { id: 34, type: "gap", prompt: "Farmland is often dominated by a single ________.", answer: "crop" },
          { id: 35, type: "gap", prompt: "Advantage 3: City gardeners use fewer ________.", answer: "pesticides|chemicals" },
          { id: 36, type: "gap", prompt: "Main concern: honeybees create ________ with wild bees.", answer: "competition" },
          { id: 37, type: "gap", prompt: "Suggestion: plant more ________ instead of adding hives.", answer: "flowers" },
          { id: 38, type: "gap", prompt: "When hives are close together, ________ can spread quickly.", answer: "disease|infections|diseases" },
          { id: 39, type: "gap", prompt: "Honey can be used to monitor air ________.", answer: "pollution" },
          { id: 40, type: "gap", prompt: "Schools say students become more interested in ________ and the environment.", answer: "biology" },
        ],
      },
    ],
  },
];
