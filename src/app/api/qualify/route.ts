import { all, get, run } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { BANK, PASS_MARK } from "@/lib/qualify";
import { isEnabled } from "@/lib/languages";

export const runtime = "nodejs";
const MAX_PER_DAY = 3;

async function status(pk: string) {
  const rows = await all("SELECT * FROM quals WHERE pubkey=?", pk);
  const now = Math.floor(Date.now() / 1000);
  return Object.keys(BANK).filter(isEnabled).map((language) => {
    const r = rows.find((x) => x.language === language);
    const used = r && now - r.window_start < 86400 ? r.attempts_today : 0;
    return { language, passed: !!r?.passed, bestScore: r?.best_score ?? null, attemptsLeft: MAX_PER_DAY - used, total: BANK[language].length, passMark: PASS_MARK };
  });
}

// GET: status for all languages, or the questions (no answers) for ?lang=
export async function GET(req: Request) {
  return withAuth(req, async (pk) => {
    const lang = new URL(req.url).searchParams.get("lang");
    if (!lang) return { languages: await status(pk) };
    if (!BANK[lang] || !isEnabled(lang)) throw new Error("Unknown language");
    return { questions: BANK[lang].map((q) => ({ q: q.q, options: q.options })), ...(await status(pk)).find((s) => s.language === lang)! };
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (pk, b) => {
    const lang = String(b.language || ""); const bank = isEnabled(lang) ? BANK[lang] : undefined;
    if (!bank) throw new Error("Unknown language");
    const st = (await status(pk)).find((s) => s.language === lang)!;
    if (st.passed) return { passed: true, score: st.bestScore, already: true };
    if (st.attemptsLeft <= 0) throw new Error("No attempts left today. Try again tomorrow.");
    const ans: number[] = Array.isArray(b.answers) ? b.answers : [];
    const score = bank.reduce((n, q, i) => n + (ans[i] === q.answer ? 1 : 0), 0);
    const passed = score >= PASS_MARK;
    const now = Math.floor(Date.now() / 1000);
    const row = await get("SELECT * FROM quals WHERE pubkey=? AND language=?", pk, lang);
    const fresh = !row || now - row.window_start >= 86400;
    await run(`INSERT INTO quals (pubkey,language,best_score,passed,attempts_today,window_start) VALUES (?,?,?,?,1,?)
      ON CONFLICT(pubkey,language) DO UPDATE SET best_score=GREATEST(quals.best_score,EXCLUDED.best_score), passed=EXCLUDED.passed,
      attempts_today=CASE WHEN ?::boolean THEN 1 ELSE quals.attempts_today+1 END, window_start=CASE WHEN ?::boolean THEN ?::bigint ELSE quals.window_start END`,
      pk, lang, score, passed ? 1 : 0, now, fresh, fresh, now);
    return { passed, score, total: bank.length, passMark: PASS_MARK, attemptsLeft: st.attemptsLeft - 1 };
  });
}
