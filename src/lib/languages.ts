// Language registry. Client-safe (no secrets). Tasks store the language NAME as text, so the platform is not
// limited to this list: requesters can type any language (see cleanLang) and the registry only adds suggestions,
// text direction and whether a qualification test exists.
export type Lang = { name: string; native: string; code: string; region: string; rtl?: boolean };

export const REGIONS = ["Pan-African", "West Africa", "East Africa", "Southern Africa", "Central Africa", "North Africa & Indian Ocean"] as const;

export const LANGUAGES: Lang[] = [
  { name: "English", native: "English", code: "en", region: "Pan-African" },
  { name: "French", native: "Français", code: "fr", region: "Pan-African" },
  { name: "Portuguese", native: "Português", code: "pt", region: "Pan-African" },
  { name: "Arabic", native: "العربية", code: "ar", region: "Pan-African", rtl: true },
  { name: "Swahili", native: "Kiswahili", code: "sw", region: "East Africa" },

  { name: "Nigerian Pidgin", native: "Naijá", code: "pcm", region: "West Africa" },
  { name: "Hausa", native: "Hausa", code: "ha", region: "West Africa" },
  { name: "Yoruba", native: "Yorùbá", code: "yo", region: "West Africa" },
  { name: "Igbo", native: "Igbo", code: "ig", region: "West Africa" },
  { name: "Twi", native: "Twi", code: "tw", region: "West Africa" },
  { name: "Ewe", native: "Eʋegbe", code: "ee", region: "West Africa" },
  { name: "Ga", native: "Gã", code: "gaa", region: "West Africa" },
  { name: "Wolof", native: "Wolof", code: "wo", region: "West Africa" },
  { name: "Fula", native: "Pulaar / Fulfulde", code: "ff", region: "West Africa" },
  { name: "Bambara", native: "Bamanankan", code: "bm", region: "West Africa" },
  { name: "Mooré", native: "Mooré", code: "mos", region: "West Africa" },
  { name: "Krio", native: "Krio", code: "kri", region: "West Africa" },
  { name: "Ghanaian Pidgin", native: "Pidgin", code: "gpe", region: "West Africa" },

  { name: "Amharic", native: "አማርኛ", code: "am", region: "East Africa" },
  { name: "Oromo", native: "Afaan Oromoo", code: "om", region: "East Africa" },
  { name: "Somali", native: "Soomaali", code: "so", region: "East Africa" },
  { name: "Tigrinya", native: "ትግርኛ", code: "ti", region: "East Africa" },
  { name: "Kikuyu", native: "Gĩkũyũ", code: "ki", region: "East Africa" },
  { name: "Luganda", native: "Luganda", code: "lg", region: "East Africa" },
  { name: "Kinyarwanda", native: "Ikinyarwanda", code: "rw", region: "East Africa" },
  { name: "Kirundi", native: "Ikirundi", code: "rn", region: "East Africa" },
  { name: "Luo", native: "Dholuo", code: "luo", region: "East Africa" },

  { name: "Zulu", native: "isiZulu", code: "zu", region: "Southern Africa" },
  { name: "Xhosa", native: "isiXhosa", code: "xh", region: "Southern Africa" },
  { name: "Afrikaans", native: "Afrikaans", code: "af", region: "Southern Africa" },
  { name: "Shona", native: "chiShona", code: "sn", region: "Southern Africa" },
  { name: "Sesotho", native: "Sesotho", code: "st", region: "Southern Africa" },
  { name: "Setswana", native: "Setswana", code: "tn", region: "Southern Africa" },
  { name: "Northern Sotho", native: "Sepedi", code: "nso", region: "Southern Africa" },
  { name: "Chichewa", native: "Chichewa", code: "ny", region: "Southern Africa" },

  { name: "Lingala", native: "Lingála", code: "ln", region: "Central Africa" },
  { name: "Kikongo", native: "Kikongo", code: "kg", region: "Central Africa" },
  { name: "Tshiluba", native: "Tshiluba", code: "lua", region: "Central Africa" },
  { name: "Sango", native: "Sängö", code: "sg", region: "Central Africa" },
  { name: "Cameroonian Pidgin", native: "Kamtok", code: "wes", region: "Central Africa" },

  { name: "Egyptian Arabic", native: "مصرى", code: "arz", region: "North Africa & Indian Ocean", rtl: true },
  { name: "Moroccan Arabic", native: "الدارجة", code: "ary", region: "North Africa & Indian Ocean", rtl: true },
  { name: "Tamazight", native: "ⵜⴰⵎⴰⵣⵉⵖⵜ", code: "zgh", region: "North Africa & Indian Ocean" },
  { name: "Malagasy", native: "Malagasy", code: "mg", region: "North Africa & Indian Ocean" },
];

// Which languages are switched ON for training. Default: the Nigerian launch set. Widen it with NEXT_PUBLIC_LANGUAGES
// (comma-separated names from the registry, e.g. "English,Swahili,Zulu") or "*" to allow every registry language plus any typed name.
const RAW = (process.env.NEXT_PUBLIC_LANGUAGES ?? "English,Nigerian Pidgin,Yoruba,Hausa").trim();
export const OPEN_LANGS = RAW === "*";
const ON = new Set(RAW.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
export const isEnabled = (name: string) => OPEN_LANGS || ON.has(String(name).trim().toLowerCase());
export const enabledLanguages = () => LANGUAGES.filter((l) => isEnabled(l.name));
// Validated AND enabled. Use this wherever a requester picks a language.
export const allowedLang = (input: unknown) => { const c = cleanLang(input); return c && isEnabled(c) ? c : null; };

// Languages that have a curated qualification test in src/lib/qualify.ts (kept in sync by a unit test).
export const TEST_LANGS = ["Nigerian Pidgin", "Yoruba", "Hausa", "Swahili", "Igbo", "Zulu", "Amharic"];
export const hasTest = (lang: string) => lang === "English" || TEST_LANGS.includes(lang);

const byName = new Map(LANGUAGES.map((l) => [l.name.toLowerCase(), l]));
export const findLang = (name: string) => byName.get(String(name).trim().toLowerCase());

// Right-to-left scripts (Arabic, Hebrew, Thaana, N'Ko, Adlam, Syriac) so prompts and answer boxes display correctly,
// including for a language the registry has never heard of.
const RTL_SCRIPT = /[֐-ࣿ\u{1E900}-\u{1E95F}יִ-﷿ﹰ-﻿]/u; // Hebrew, Arabic, Syriac, Thaana, N'Ko, Adlam
export const isRtl = (lang: string, sample = "") => !!findLang(lang)?.rtl || RTL_SCRIPT.test(sample);
export const dirFor = (lang: string, sample = ""): "rtl" | "ltr" => (isRtl(lang, sample) ? "rtl" : "ltr");

// Any language is allowed. A known name is normalised to its canonical spelling; anything else must look like a language
// name (letters, spaces and a few punctuation marks), because it is stored and shown to other people.
export function cleanLang(input: unknown): string | null {
  const s = String(input ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (!s) return null;
  const known = findLang(s) ?? LANGUAGES.find((l) => l.native.toLowerCase() === s.toLowerCase() || l.code === s.toLowerCase());
  if (known) return known.name;
  return /^[\p{L}\p{M}][\p{L}\p{M}\p{N} '’().\-\/]{1,39}$/u.test(s) ? s : null;
}

// Stable colour per language for cards (any string works, including custom languages).
export const TONES = ["mint", "yellow", "pink", "violet"] as const;
export const toneFor = (lang: string) => TONES[[...lang].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length];

// ---- Currencies: show a sats amount in the worker's own money ----
export type Cur = { code: string; symbol: string; name: string; countries: string[] };
export const CURRENCIES: Cur[] = [
  { code: "NGN", symbol: "₦", name: "Nigerian naira", countries: ["NG"] },
  { code: "KES", symbol: "KSh ", name: "Kenyan shilling", countries: ["KE"] },
  { code: "GHS", symbol: "GH₵", name: "Ghanaian cedi", countries: ["GH"] },
  { code: "ZAR", symbol: "R", name: "South African rand", countries: ["ZA", "LS", "SZ", "NA"] },
  { code: "UGX", symbol: "USh ", name: "Ugandan shilling", countries: ["UG"] },
  { code: "TZS", symbol: "TSh ", name: "Tanzanian shilling", countries: ["TZ"] },
  { code: "ETB", symbol: "Br ", name: "Ethiopian birr", countries: ["ET"] },
  { code: "RWF", symbol: "FRw ", name: "Rwandan franc", countries: ["RW"] },
  { code: "XOF", symbol: "CFA ", name: "West African CFA franc", countries: ["SN", "CI", "ML", "BF", "BJ", "TG", "NE", "GW"] },
  { code: "XAF", symbol: "FCFA ", name: "Central African CFA franc", countries: ["CM", "GA", "CG", "TD", "CF", "GQ"] },
  { code: "EGP", symbol: "E£", name: "Egyptian pound", countries: ["EG"] },
  { code: "MAD", symbol: "MAD ", name: "Moroccan dirham", countries: ["MA"] },
  { code: "ZMW", symbol: "ZK", name: "Zambian kwacha", countries: ["ZM"] },
  { code: "USD", symbol: "$", name: "US dollar", countries: [] },
];
export const curByCode = (c: string) => CURRENCIES.find((x) => x.code === c);
// Best guess from the browser locale (e.g. "sw-KE" -> KES). The worker can change it.
export function guessCurrency(locale: string): string {
  const region = String(locale).split(/[-_]/)[1]?.toUpperCase();
  return CURRENCIES.find((c) => region && c.countries.includes(region))?.code ?? "USD";
}
