import { db } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { kickRelease } from "@/lib/payout";
import { reputation } from "@/lib/reputation";

export const runtime = "nodejs";

// Picks a recorded clip this worker can verify: not their own, not their own task, in a language they are qualified in.
export async function GET(req: Request) {
  return withAuth(req, async (pk) => {
    kickRelease();
    const d = db();
    const langs = ["English", ...reputation(pk).qualified];
    const clip = d.prepare(`
      SELECT s.id, s.duration_ms, t.dst_lang, t.title, t.reward_sats, t.review_sats FROM submissions s JOIN tasks t ON t.id=s.task_id
      WHERE t.kind='speak' AND t.status='open' AND s.verdict='pass' AND s.audio_path IS NOT NULL
        AND s.worker<>? AND t.requester<>? AND t.dst_lang IN (${langs.map(() => "?").join(",")})
        AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.submission_id=s.id AND r.reviewer=?)
        AND (SELECT COUNT(*) FROM reviews r WHERE r.submission_id=s.id AND r.match=1)=0
        AND (SELECT COUNT(*) FROM reviews r WHERE r.submission_id=s.id)<3
      ORDER BY RANDOM() LIMIT 1`).get(pk, pk, ...langs, pk) as any;
    if (!clip) {
      const anyClip = d.prepare("SELECT 1 FROM submissions s JOIN tasks t ON t.id=s.task_id WHERE t.kind='speak' AND s.audio_path IS NOT NULL AND s.worker<>? AND t.requester<>?").get(pk, pk);
      return { clip: null, needQual: !!anyClip && langs.length === 1 };
    }
    d.prepare("INSERT OR REPLACE INTO served (item_id,worker,served_at) VALUES (?,?,?)").run("rev:" + clip.id, pk, Math.floor(Date.now() / 1000));
    const sats = clip.review_sats ?? Math.max(1, Math.round(clip.reward_sats * 0.3));
    return { clip: { id: clip.id, language: clip.dst_lang, task: clip.title, sats, seconds: Math.round((clip.duration_ms || 3000) / 1000) } };
  });
}
