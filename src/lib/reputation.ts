import { db } from "./db";

export const LEVELS = ["New", "Regular", "Trusted"] as const;
export const QUAL_LANGS = ["Nigerian Pidgin", "Yoruba", "Hausa"] as const;

// Reputation is derived from activity keyed by Nostr pubkey, so it follows the person, not an email.
// Verification reviews count toward it too.
export function reputation(pubkey: string) {
  const d = db();
  const r = d.prepare("SELECT COUNT(*) attempts, SUM(verdict='pass') accepted FROM submissions WHERE worker=?").get(pubkey) as any;
  const rv = d.prepare("SELECT COUNT(*) n, COALESCE(SUM(match),0) ok FROM reviews WHERE reviewer=?").get(pubkey) as any;
  const attempts = (r.attempts || 0) + rv.n, accepted = (r.accepted || 0) + rv.ok;
  const checks = d.prepare("SELECT COUNT(*) n, SUM(s.verdict='pass') ok FROM submissions s JOIN items i ON i.id=s.item_id WHERE s.worker=? AND i.is_check=1").get(pubkey) as any;
  const paid = d.prepare("SELECT COALESCE(SUM(sats),0) s FROM payouts WHERE worker=? AND status='paid'").get(pubkey) as any;
  const rate = attempts ? accepted / attempts : 0;
  const checkRate = checks.n ? checks.ok / checks.n : null;
  const score = Math.round(100 * (rate * Math.min(1, accepted / 20) * 0.8 + (checkRate ?? rate) * 0.2));
  const levelIdx = accepted >= 20 && score >= 70 ? 2 : accepted >= 5 && score >= 30 ? 1 : 0;
  const qualified = (d.prepare("SELECT language FROM quals WHERE pubkey=? AND passed=1").all(pubkey) as any[]).map((q) => q.language);
  return { pubkey, attempts, accepted, reviews: rv.n, acceptRate: Math.round(rate * 100), hiddenCheckRate: checkRate === null ? null : Math.round(checkRate * 100),
    sats: paid.s, score, levelIdx, level: LEVELS[levelIdx], qualified };
}

export const isQualified = (pk: string, lang: string) =>
  lang === "English" || !!db().prepare("SELECT 1 FROM quals WHERE pubkey=? AND language=? AND passed=1").get(pk, lang);

// The language a worker must know for a task (for X -> English tasks that is the source language).
export const taskLang = (t: { kind: string; src_lang: string; dst_lang: string }) => (t.kind === "translate" && t.dst_lang === "English" ? t.src_lang : t.dst_lang);

// Returns a human-readable reason if this worker may not work on this task.
export function gate(pk: string, t: { min_level?: number; require_qual?: number; kind: string; src_lang: string; dst_lang: string }): string | null {
  const rep = reputation(pk);
  if ((t.min_level || 0) > rep.levelIdx) return `This task needs ${LEVELS[t.min_level!]} level or higher. You are ${rep.level}. Complete more accepted work to level up.`;
  if (t.require_qual && !isQualified(pk, taskLang(t))) return `This task is for workers qualified in ${taskLang(t)}. Take the short qualification test to unlock it.`;
  return null;
}
