import { all, get } from "./db";

export const LEVELS = ["New", "Regular", "Trusted"] as const;

// Reputation is derived from activity keyed by Nostr pubkey, so it follows the person, not an email.
// Verification reviews count toward it too.
export async function reputation(pubkey: string) {
  const r = (await get("SELECT COUNT(*) attempts, COUNT(*) FILTER (WHERE verdict='pass') accepted FROM submissions WHERE worker=?", pubkey))!;
  const rv = (await get("SELECT COUNT(*) n, COALESCE(SUM(match),0) ok FROM reviews WHERE reviewer=?", pubkey))!;
  const attempts = r.attempts + rv.n, accepted = r.accepted + rv.ok;
  const checks = (await get("SELECT COUNT(*) n, COUNT(*) FILTER (WHERE s.verdict='pass') ok FROM submissions s JOIN items i ON i.id=s.item_id WHERE s.worker=? AND i.is_check=1", pubkey))!;
  const paid = (await get("SELECT COALESCE(SUM(sats),0) s FROM payouts WHERE worker=? AND status='paid'", pubkey))!;
  const rate = attempts ? accepted / attempts : 0;
  const checkRate = checks.n ? checks.ok / checks.n : null;
  const score = Math.round(100 * (rate * Math.min(1, accepted / 20) * 0.8 + (checkRate ?? rate) * 0.2));
  const levelIdx = accepted >= 20 && score >= 70 ? 2 : accepted >= 5 && score >= 30 ? 1 : 0;
  const qualified = (await all("SELECT language FROM quals WHERE pubkey=? AND passed=1", pubkey)).map((q) => q.language as string);
  return { pubkey, attempts, accepted, reviews: rv.n, acceptRate: Math.round(rate * 100), hiddenCheckRate: checkRate === null ? null : Math.round(checkRate * 100),
    sats: paid.s, score, levelIdx, level: LEVELS[levelIdx], qualified };
}

export const isQualified = async (pk: string, lang: string) =>
  lang === "English" || !!(await get("SELECT 1 FROM quals WHERE pubkey=? AND language=? AND passed=1", pk, lang));

// The language a worker must know for a task (for X -> English tasks that is the source language).
export const taskLang = (t: { kind: string; src_lang: string; dst_lang: string }) => (t.kind === "translate" && t.dst_lang === "English" ? t.src_lang : t.dst_lang);

// Returns a human-readable reason if this worker may not work on this task.
export async function gate(pk: string, t: { min_level?: number; require_qual?: number; kind: string; src_lang: string; dst_lang: string }): Promise<string | null> {
  const rep = await reputation(pk);
  if ((t.min_level || 0) > rep.levelIdx) return `This task needs ${LEVELS[t.min_level!]} level or higher. You are ${rep.level}. Complete more accepted work to level up.`;
  if (t.require_qual && !(await isQualified(pk, taskLang(t)))) return `This task is for workers qualified in ${taskLang(t)}. Take the short qualification test to unlock it.`;
  return null;
}
