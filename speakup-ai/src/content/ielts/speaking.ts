/** Original IELTS-style speaking prompts. */

export const PART1: Record<string, string[]> = {
  Work: ["Do you work or are you a student?", "What do you like most about your job?", "Is there anything you would like to change about your work?", "Would you like to do the same job in the future?"],
  Studies: ["What are you studying?", "Why did you choose that subject?", "What is the most difficult part of your studies?", "Do you prefer studying alone or with others?"],
  Family: ["How many people are there in your family?", "Who are you closest to in your family?", "Do you often spend time with your relatives?", "Has your family changed much in recent years?"],
  Hometown: ["Where is your hometown?", "What do you like about it?", "Is it a good place for young people?", "How has your hometown changed since you were a child?"],
  Hobbies: ["What do you enjoy doing in your free time?", "Did you have the same hobbies as a child?", "Is there a hobby you would like to try?", "Do you think hobbies are important?"],
  Technology: ["How often do you use your phone each day?", "What apps do you use most?", "Has technology made your life easier?", "Do you think you spend too much time online?"],
  Education: ["What was your favourite subject at school?", "Did you like your teachers?", "What do you think makes a good teacher?", "Would you like to study further in the future?"],
  "Daily life": ["What is your daily routine like?", "Are you a morning person or an evening person?", "What part of the day do you like best?", "Do you usually do the same things at weekends?"],
};

export interface CueCard {
  id: string;
  topic: string;
  prompt: string;
  bullets: string[];
  part3: string[];
  keywords: string[];
}

export const CUE_CARDS: CueCard[] = [
  { id: "c1", topic: "A skill", prompt: "Describe a skill you learned that you think is useful.", bullets: ["what the skill is", "when and how you learned it", "how often you use it", "and explain why you think it is useful"], part3: ["What skills do young people need today?", "Should schools teach practical skills like cooking or money management?", "Is it easier for children or adults to learn new skills?", "How might the skills people need change in the next twenty years?"], keywords: ["skill", "learned", "learn", "use", "useful", "because", "when", "practice"] },
  { id: "c2", topic: "A journey", prompt: "Describe a memorable journey you have taken.", bullets: ["where you went", "how you travelled", "who you went with", "and explain why it was memorable"], part3: ["Why do people enjoy travelling?", "How has tourism changed in your country?", "Is it better to travel alone or in a group?", "What are the environmental effects of tourism?"], keywords: ["journey", "trip", "went", "travelled", "train", "bus", "with", "memorable", "because"] },
  { id: "c3", topic: "A person", prompt: "Describe a person who has inspired you.", bullets: ["who the person is", "how you know them", "what they have done", "and explain why they inspired you"], part3: ["What qualities make a good role model?", "Do celebrities have a responsibility to be role models?", "Who influences young people more: parents or friends?", "Has the idea of a hero changed over time?"], keywords: ["person", "inspired", "know", "admire", "because", "taught", "example", "qualities"] },
  { id: "c4", topic: "A piece of technology", prompt: "Describe a piece of technology you use every day.", bullets: ["what it is", "when you started using it", "what you use it for", "and explain how your life would be different without it"], part3: ["How has technology changed the way people communicate?", "Do older people find it hard to use new technology?", "Should children have limits on screen time?", "Will technology create more jobs or fewer?"], keywords: ["technology", "phone", "laptop", "use", "every day", "started", "without", "because"] },
  { id: "c5", topic: "A place", prompt: "Describe a quiet place you like to go to.", bullets: ["where it is", "how often you go there", "what you do there", "and explain why you like it"], part3: ["Why do people need quiet places?", "Are cities becoming too noisy?", "How can city planners create more green spaces?", "Do young people value peace and quiet less than older people?"], keywords: ["place", "quiet", "go", "there", "relax", "peaceful", "because", "often"] },
  { id: "c6", topic: "An achievement", prompt: "Describe an achievement you are proud of.", bullets: ["what you achieved", "when it happened", "how you achieved it", "and explain why you are proud of it"], part3: ["Is it important to set goals in life?", "Should people be rewarded for effort or results?", "How do people in your country celebrate success?", "Does social media make people compare their achievements too much?"], keywords: ["achieved", "proud", "achievement", "worked", "hard", "result", "because", "when"] },
  { id: "c7", topic: "A book or film", prompt: "Describe a book or film that made you think.", bullets: ["what it was", "when you read or watched it", "what it was about", "and explain why it made you think"], part3: ["Do people read less than in the past?", "Should films be used in education?", "Are stories important for children?", "Do you think books will disappear one day?"], keywords: ["book", "film", "movie", "story", "about", "watched", "read", "because", "think"] },
  { id: "c8", topic: "A celebration", prompt: "Describe a festival or celebration that is important in your country.", bullets: ["what it is", "when it takes place", "what people do", "and explain why it is important"], part3: ["Are traditional festivals losing their importance?", "Has commercialisation changed festivals?", "Should governments spend money on public celebrations?", "How do festivals bring communities together?"], keywords: ["festival", "celebrate", "people", "family", "food", "tradition", "important", "because"] },
];
