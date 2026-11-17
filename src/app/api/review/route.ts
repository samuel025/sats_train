import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { queuePayout, kickRelease, cooldownSecs } from "@/lib/payout";
import { similarity } from "@/lib/text";

export const runtime = "nodejs";
const MATCH = 0.7;

// The reviewer types what they HEAR. The speaker was reading a known sentence, so the match is ground truth
// (no LLM needed). The reviewer never sees the sentence.
export async function POST(req: Request) {
  return withAuth(req, async (pk, b) => {
    kickRelease();
    const d = db();
    const transcript = String(b.transcript || "").trim().slice(0, 1000);
    if (transcript.length < 2) throw new Error("Type what you heard.");
    const sub = d.prepare("SELECT s.id,s.worker,s.duration_ms,s.task_id,i.prompt FROM submissions s JOIN items i ON i.id=s.item_id WHERE s.id=? AND s.verdict='pass' AND s.audio_path IS NOT NULL").get(b.id) as any;
    const t = sub && d.prepare("SELECT * FROM tasks WHERE id=?").get(sub.task_id) as any;
    if (!sub || sub.worker === pk || t.requester === pk) throw new Error("Clip not available");
    const sv = d.prepare("SELECT served_at FROM served WHERE item_id=? AND worker=?").get("rev:" + sub.id, pk) as any;
    const now = Math.floor(Date.now() / 1000);
    const need = Math.max(3, Math.round(((sub.duration_ms || 3000) / 1000) * 0.6)); // you can't verify audio you didn't listen to
    if (!sv) throw new Error("Clip not assigned to you");
    if (now - sv.served_at < need) throw new Error("That was too fast. Listen to the whole clip first.");
    if (d.prepare("SELECT 1 FROM reviews WHERE submission_id=? AND reviewer=?").get(sub.id, pk)) throw new Error("Already reviewed");
    const perMin = Number(process.env.SUBMIT_PER_MIN || 10);
    const recent = (d.prepare("SELECT COUNT(*) c FROM reviews WHERE reviewer=? AND created_at>?").get(pk, now - 60) as any).c;
    if (recent >= perMin) throw new Error(`Slow down: max ${perMin} per minute.`);

    const sim = similarity(transcript, sub.prompt);
    const match = sim >= MATCH;
    d.prepare("INSERT INTO reviews (id,submission_id,task_id,reviewer,transcript,similarity,match,created_at) VALUES (?,?,?,?,?,?,?,?)")
      .run(randomUUID(), sub.id, t.id, pk, transcript, sim, match ? 1 : 0, now);
    const sats = t.review_sats ?? Math.max(1, Math.round(t.reward_sats * 0.3));
    const payment: any = match ? queuePayout({ id: t.id, reward_sats: sats }, "rev:" + sub.id, pk) : null;
    if (payment?.status === "pending") payment.cooldown = cooldownSecs();
    return { match, sats, payment,
      feedback: match ? "Your transcript matches the speaker. This clip is now verified." : "That did not match what the speaker was asked to say. No payment for this one." };
  });
}
