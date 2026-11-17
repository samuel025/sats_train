import type { Db } from "./db";
import { createHash, randomUUID } from "node:crypto";
import { encrypt } from "./crypto";

// A fixed "demo requester" so seeded tasks have an owner. Nobody holds its private key.
export const DEMO_REQUESTER = createHash("sha256").update("sats-for-data-demo-requester").digest("hex");

type Seed = { rank?: [string, string, string][]; rankChecks?: [string, string, string, string][]; qual?: boolean; title: string; kind: "translate" | "classify" | "speak" | "rank"; src: string; dst: string; instructions: string; reward: number; perItem: number;
  items: string[]; labels?: string[]; checks: [string, string][] };

const SEEDS: Seed[] = [
  { title: "Everyday greetings to Nigerian Pidgin", kind: "translate", src: "English", dst: "Nigerian Pidgin", reward: 200, perItem: 2,
    instructions: "Write how you would naturally say it in Nigerian Pidgin. Spelling variants are fine.",
    items: ["Good evening, how was your day?", "I am going to the market.", "Please help me carry this bag.", "What is your name?", "I do not understand.",
      "The food is very sweet.", "Where is the bus stop?", "Come and eat with us.", "I will call you tomorrow.", "The children are playing outside."],
    checks: [["How are you?", "How you dey?"], ["I am hungry.", "Hunger dey catch me"]] },
  { title: "Basic phrases to Yoruba", kind: "translate", src: "English", dst: "Yoruba", reward: 300, perItem: 2,
    instructions: "Translate into Yoruba. Tone marks are welcome but not required.",
    items: ["Welcome to our home.", "How is your family?", "I want some water.", "The market is far from here.", "My mother is cooking.",
      "Please speak slowly.", "We are happy to see you.", "Today is a good day."],
    checks: [["Good morning (to elders)", "Ẹ káàárọ̀"], ["Thank you", "Ẹ ṣé"]] },
  { title: "Market phrases to Hausa", kind: "translate", src: "English", dst: "Hausa", reward: 300, perItem: 2,
    instructions: "Translate into Hausa, the way you would say it at a market.",
    items: ["How much is this?", "That is too expensive.", "I would like two oranges.", "Can you reduce the price?", "Where can I find fresh vegetables?",
      "I will come back later.", "Please give me my change.", "The weather is hot today."],
    checks: [["Thank you", "Na gode"], ["Water", "Ruwa"]] },
  { title: "Nigerian Pidgin to English", kind: "translate", src: "Nigerian Pidgin", dst: "English", reward: 150, perItem: 2,
    instructions: "Write clear, natural English with the same meaning.",
    items: ["Wetin you dey do for there?", "Abeg, make you wait small.", "I no sabi where e dey.", "Dis rice sweet well well.", "E don tey wey I see you.",
      "Make we go house.", "No vex, I no mean am.", "Una don chop?"],
    checks: [["How you dey?", "How are you?"], ["I dey go market", "I am going to the market"]] },
  { title: "Label the mood of Pidgin sentences", kind: "classify", src: "Nigerian Pidgin", dst: "Nigerian Pidgin", reward: 100, perItem: 3,
    instructions: "Tap the label that best describes how the speaker feels.", labels: ["Positive", "Negative", "Neutral"],
    items: ["Dis jollof rice sweet pass!", "I don tire for dis wahala.", "The meeting go start by 3pm.", "My team win, I dey so happy!",
      "Dem don cancel my flight again, e pain me.", "I dey go church for Sunday."],
    checks: [["Today na the best day of my life!", "Positive"], ["E bad well well, I no like am at all.", "Negative"]] },
  { title: "Read Yoruba sentences aloud", kind: "speak", src: "Yoruba", dst: "Yoruba", reward: 400, perItem: 2,
    instructions: "Record yourself reading each sentence clearly in a quiet place. Natural speed, no need to be perfect.",
    items: ["Báwo ni ọjọ́ rẹ ṣe lọ?", "Mo ń lọ sí ọjà lónìí.", "Ẹ jọ̀wọ́, ẹ bá mi gbé àpò yìí.", "Oúnjẹ yìí dùn púpọ̀.", "Ilé wa wà ní ẹ̀bá odò."], checks: [] },
  { title: "Read Hausa sentences aloud", kind: "speak", src: "Hausa", dst: "Hausa", reward: 400, perItem: 2,
    instructions: "Record yourself reading each sentence clearly in a quiet place. Natural speed, no need to be perfect.",
    items: ["Ina kwana, yaya iyali?", "Zan je kasuwa yau.", "Don Allah, ka taimaka mini.", "Abincin nan yana da daɗi sosai.", "Yau ranar kirki ce."], checks: [] },
  { title: "Read Nigerian Pidgin sentences aloud", kind: "speak", src: "Nigerian Pidgin", dst: "Nigerian Pidgin", reward: 300, perItem: 2,
    instructions: "Read each sentence the way you would say it. Natural speed, no need to be perfect.",
    items: ["Wetin you dey do for there?", "Abeg, make you wait small.", "Dis rice sweet well well.", "Make we go house.", "I dey come, no go anywhere."], checks: [] },
  { title: "Which Pidgin reply is better?", kind: "rank", src: "Nigerian Pidgin", dst: "Nigerian Pidgin", reward: 120, perItem: 3,
    instructions: "Read the message and both replies. Pick the reply that is more natural Nigerian Pidgin, correct and helpful. Pick “Neither” if both are bad.",
    items: [], checks: [],
    rank: [
      ["Abeg, how I fit start small business?", "Start with wetin you sabi. Buy small small things, sell am, and dey save the profit for new stock.", "Business? Na hard thing. Just do am."],
      ["My pikin no dey eat, wetin I go do?", "No worry, try give am small small food many times for day. If e still no chop for two days, carry am go hospital.", "Give am medicine from any shop sharp sharp."],
      ["Where I fit learn computer for Lagos?", "Plenty places dey: some training centres for Yaba and Ikeja, and online courses too. Check wetin fit your pocket.", "Computer school dey everywhere. Go find one."],
      ["Tell me something about Nigeria.", "Nigeria na big country for West Africa, with over 200 million people and plenty different language and culture.", "Nigeria no dey. E don finish."],
    ],
    rankChecks: [
      ["How far? You don chop?", "I don chop, thank you. Na you I dey wait for.", "I have eaten food, thank you. I am waiting for you.", "A"],
      ["Good morning, how your night?", "Good morning to you. I hope your night was peaceful.", "Good morning o! Night go well, I thank God.", "B"],
    ] },
  { title: "Rank Pidgin replies (qualified workers)", kind: "rank", src: "Nigerian Pidgin", dst: "Nigerian Pidgin", reward: 200, perItem: 3, qual: true,
    instructions: "Only for workers who passed the Pidgin test. Pick the reply a native speaker would find more natural and helpful.",
    items: [], checks: [],
    rank: [
      ["Wetin dey cause headache?", "Plenty things fit cause am: no sleep, hunger, too much sun, or stress. Drink water, rest, and see doctor if e no go.", "Headache na from when brain dey vex."],
      ["How I go say thank you for my oga?", "You fit talk say: “Oga, thank you well well for wetin you do for me.”", "Tell am: “Oga, I am thankful for the thing you did for me.”"],
      ["Wetin be bank account?", "Na place wey bank dey keep your money for you, so you fit save am and collect am when you need am.", "Na where you dey chop food."],
    ],
    rankChecks: [["Abeg help me carry dis load.", "No wahala, I go help you carry am.", "No problem, I will help you carry it.", "A"]] },
];

export async function seedDemo(d: Db & { tx: <T>(fn: (t: Db) => Promise<T>) => Promise<T> }) {
  // Cold starts on serverless re-run this, so the common case (already seeded) is a single query.
  if (((await d.get("SELECT COUNT(*) c FROM tasks WHERE requester=?", DEMO_REQUESTER))?.c ?? 0) >= SEEDS.length) return;
  const now = Math.floor(Date.now() / 1000);
  const T = "INSERT INTO tasks (id,requester,title,kind,src_lang,dst_lang,instructions,reward_sats,nwc_enc,created_at,answers_per_item,require_qual,review_sats) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)";
  const I = "INSERT INTO items (id,task_id,position,prompt,is_check,known_answer,labels,payload) VALUES (?,?,?,?,?,?,?,?)";
  for (const [i, s] of SEEDS.entries()) {
    if (await d.get("SELECT 1 FROM tasks WHERE requester=? AND title=?", DEMO_REQUESTER, s.title)) continue; // idempotent per task
    await d.tx(async (t) => {
      const id = randomUUID();
      await t.run(T, id, DEMO_REQUESTER, s.title, s.kind, s.src, s.dst, s.instructions, s.reward, encrypt("demo"), now - i * 60, s.perItem,
        s.qual ? 1 : 0, s.kind === "speak" ? Math.max(1, Math.round(s.reward * 0.3)) : null);
      if (s.kind === "rank") {
        const rows = [...(s.rank || []).map(([p, a, b]) => ({ p, a, b, c: 0, k: null as string | null })), ...(s.rankChecks || []).map(([p, a, b, k]) => ({ p, a, b, c: 1, k }))];
        const real = rows.filter((r) => !r.c), chk = rows.filter((r) => r.c), ord: typeof rows = [];
        real.forEach((r, n) => { ord.push(r); if (n % 2 === 1 && chk.length) ord.push(chk.shift()!); });
        ord.push(...chk);
        for (const [n, r] of ord.entries()) await t.run(I, randomUUID(), id, n, r.p, r.c, r.k, null, JSON.stringify({ a: r.a, b: r.b }));
        return;
      }
      const labels = s.labels ? JSON.stringify(s.labels) : null;
      const all = [...s.items.map((p) => ({ p, c: 0, a: null as string | null })), ...s.checks.map(([p, a]) => ({ p, c: 1, a }))];
      // Check items are spread through the list, not clustered at the end.
      const step = Math.max(2, Math.floor(all.length / (s.checks.length + 1)));
      const real = all.filter((x) => !x.c), chk = all.filter((x) => x.c);
      const ordered: typeof all = [];
      real.forEach((r, n) => { ordered.push(r); if ((n + 1) % step === 0 && chk.length) ordered.push(chk.shift()!); });
      ordered.push(...chk);
      for (const [n, x] of ordered.entries()) await t.run(I, randomUUID(), id, n, x.p, x.c, x.a, labels, null);
    });
  }
}
