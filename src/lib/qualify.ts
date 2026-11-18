// Qualification bank. Answers stay on the server. 5 questions per language, pass with 4.
// Add a language by adding an entry here AND its name to TEST_LANGS in languages.ts (a unit test checks they match).
// Questions use common everyday words so a fluent speaker passes easily. Have a native speaker review before launch.
export type Q = { q: string; options: string[]; answer: number };
export const PASS_MARK = 4;
export const BANK: Record<string, Q[]> = {
  "Nigerian Pidgin": [
    { q: "What does “How you dey?” mean?", options: ["How are you?", "Where are you going?", "What is your name?", "Thank you"], answer: 0 },
    { q: "“I dey go market” means:", options: ["I am coming from the market", "I am going to the market", "I sold at the market", "The market is closed"], answer: 1 },
    { q: "What does “Abeg” mean?", options: ["Goodbye", "Water", "Please", "Tomorrow"], answer: 2 },
    { q: "“E don tey” means:", options: ["It is raining", "It has been a long time", "It is very expensive", "He is sleeping"], answer: 1 },
    { q: "Which means “What is your name?”", options: ["Wetin be your name?", "Where you dey go?", "How much be dis?", "Who send you?"], answer: 0 },
  ],
  Yoruba: [
    { q: "“Ẹ káàárọ̀” means:", options: ["Good night", "Good morning", "Thank you", "Welcome"], answer: 1 },
    { q: "“Ẹ ṣé” means:", options: ["Thank you", "Please", "Sorry", "Goodbye"], answer: 0 },
    { q: "“Omi” means:", options: ["Fire", "Food", "Water", "Road"], answer: 2 },
    { q: "“Báwo ni?” means:", options: ["Where is it?", "How are you?", "What is that?", "Who is there?"], answer: 1 },
    { q: "“Ilé” means:", options: ["House", "Market", "River", "Child"], answer: 0 },
  ],
  Hausa: [
    { q: "“Ina kwana” is a greeting meaning:", options: ["Good night", "Thank you", "Good morning", "Excuse me"], answer: 2 },
    { q: "“Na gode” means:", options: ["I am sorry", "Thank you", "Please", "Welcome"], answer: 1 },
    { q: "“Ruwa” means:", options: ["Water", "Fire", "Rain", "Road"], answer: 0 },
    { q: "“Abinci” means:", options: ["Clothes", "Money", "Food", "House"], answer: 2 },
    { q: "“Gida” means:", options: ["Market", "Home", "School", "Farm"], answer: 1 },
  ],
  Swahili: [
    { q: "“Habari za asubuhi” means:", options: ["Good night", "Good morning", "Thank you", "Goodbye"], answer: 1 },
    { q: "“Asante” means:", options: ["Please", "Sorry", "Thank you", "Welcome"], answer: 2 },
    { q: "“Maji” means:", options: ["Water", "Fire", "Food", "House"], answer: 0 },
    { q: "“Nyumba” means:", options: ["Road", "Market", "House", "River"], answer: 2 },
    { q: "“Karibu” is said to:", options: ["Say goodbye", "Welcome someone", "Ask the price", "Say sorry"], answer: 1 },
  ],
  Igbo: [
    { q: "“Ndewo” is used to say:", options: ["Hello / greetings", "Goodbye", "I am sorry", "How much?"], answer: 0 },
    { q: "“Daalụ” means:", options: ["Please", "Water", "Thank you", "Tomorrow"], answer: 2 },
    { q: "“Mmiri” means:", options: ["Water", "Fire", "Road", "Market"], answer: 0 },
    { q: "“Nri” means:", options: ["Money", "Food", "House", "Clothes"], answer: 1 },
    { q: "“Ụlọ” means:", options: ["Tree", "School", "River", "House"], answer: 3 },
  ],
  Zulu: [
    { q: "“Sawubona” means:", options: ["Goodbye", "Thank you", "Hello", "Sorry"], answer: 2 },
    { q: "“Ngiyabonga” means:", options: ["Thank you", "Please", "Water", "Yes"], answer: 0 },
    { q: "“Amanzi” means:", options: ["Food", "Water", "Fire", "Road"], answer: 1 },
    { q: "“Ikhaya” means:", options: ["Market", "School", "Home", "Farm"], answer: 2 },
    { q: "“Yebo” means:", options: ["No", "Maybe", "Later", "Yes"], answer: 3 },
  ],
  Amharic: [
    { q: "“ሰላም” is a greeting meaning:", options: ["Hello / peace", "Goodbye", "Water", "Sorry"], answer: 0 },
    { q: "“አመሰግናለሁ” means:", options: ["Please", "Thank you", "Welcome", "Excuse me"], answer: 1 },
    { q: "“ውሃ” means:", options: ["Fire", "Food", "Water", "Road"], answer: 2 },
    { q: "“ቤት” means:", options: ["House", "Market", "School", "River"], answer: 0 },
    { q: "“አዎ” means:", options: ["No", "Yes", "Today", "Money"], answer: 1 },
  ],
};
