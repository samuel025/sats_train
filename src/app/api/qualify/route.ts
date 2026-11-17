import { db } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { BANK, PASS_MARK } from "@/lib/qualify";

export const runtime = "nodejs";
const MAX_PER_DAY = 3;

function status(pk: string) {
  const rows = db().prepare("SELECT * FROM quals WHERE pubkey=?").all(pk) as any[];
  const now = Math.floor(Date.now() / 1000);
  return Object.keys(BANK).map((language) => {
    const r = rows.find((x) => x.language === language);
    const used = r && now - r.window_start < 86400 ? r.attempts_today : 0;
    return { language, passed: !!r?.passed, bestScore: r?.best_score ?? null, attemptsLeft: MAX_PER_DAY - used, total: BANK[language].length, passMark: PASS_MARK };
  });
}

// GET: status for all languages, or the questions (no answers) for ?lang=
export async function GET(req: Request) {
  return withAuth(req, async (pk) => {
    const lang = new URL(req.url).searchParams.get("lang");
    if (!lang) return { languages: status(pk) };
    if (!BANK[lang]) throw new Error("Unknown language");
    return { questions: BANK[lang].map((q) => ({ q: q.q, options: q.options })), ...status(pk).find((s) => s.language === lang)! };
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (pk, b) => {
    const lang = String(b.language || ""); const bank = BANK[lang];
    if (!bank) throw new Error("Unknown language");
    const st = status(pk).find((s) => s.language === lang)!;
    if (st.passed) return { passed: true, score: st.bestScore, already: true };
    if (st.attemptsLeft <= 0) throw new Error("No attempts left today. Try again tomorrow.");
    const ans: number[] = Array.isArray(b.answers) ? b.answers : [];
    const score = bank.reduce((n, q, i) => n + (ans[i] === q.answer ? 1 : 0), 0);
    const passed = score >= PASS_MARK;
    const now = Math.floor(Date.now() / 1000);
    const row = db().prepare("SELECT * FROM quals WHERE pubkey=? AND language=?").get(pk, lang) as any;
    const fresh = !row || now - row.window_start >= 86400;
    db().prepare(`INSERT INTO quals (pubkey,language,best_score,passed,attempts_today,window_start) VALUES (?,?,?,?,1,?)
      ON CONFLICT(pubkey,language) DO UPDATE SET best_score=MAX(best_score,excluded.best_score), passed=excluded.passed,
      attempts_today=CASE WHEN ? THEN 1 ELSE attempts_today+1 END, window_start=CASE WHEN ? THEN ? ELSE window_start END`)
      .run(pk, lang, score, passed ? 1 : 0, now, fresh ? 1 : 0, fresh ? 1 : 0, now);
    return { passed, score, total: bank.length, passMark: PASS_MARK, attemptsLeft: st.attemptsLeft - 1 };
  });
}
