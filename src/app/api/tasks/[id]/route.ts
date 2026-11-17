import { all, get, run } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { kickRelease } from "@/lib/payout";
import { gate } from "@/lib/reputation";
import { swapFor } from "@/lib/rank";
import { hasVoiceConsent } from "@/lib/consent";

export const runtime = "nodejs";
export const maxDuration = 60; // grading, payouts and Nostr publishing can take a while

// Returns the next item this worker can answer. is_check/known_answer are never sent.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withAuth(req, async (pk) => {
    kickRelease();
    const t = await get("SELECT * FROM tasks WHERE id=?", id);
    if (!t) throw new Error("Task not found");
    const { requester, nwc_enc, pause_reason, ...pub } = t; void nwc_enc;
    if (t.status !== "open") return { task: pub, isRequester: requester === pk, item: null, done: 0, status: t.status, reason: requester === pk ? pause_reason : null };
    const blocked = requester === pk ? null : await gate(pk, t);
    if (blocked) return { task: pub, isRequester: false, item: null, done: 0, gate: blocked };
    const maxAttempts = t.kind === "rank" ? 1 : 3;
    const next = await get(`
      SELECT i.id,i.prompt,i.labels,i.payload,i.position FROM items i
      WHERE i.task_id=?
        AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.item_id=i.id AND s.worker=? AND (s.verdict='pass' OR s.attempt>=?))
        AND (SELECT COUNT(*) FROM payouts p WHERE p.item_id=i.id AND p.status='paid') < ?
        AND (i.is_check=1 OR (SELECT COUNT(*) FROM payouts p WHERE p.item_id=i.id AND p.status IN ('paid','pending')) < ?)
      ORDER BY i.position LIMIT 1`, id, pk, maxAttempts, t.answers_per_item, t.answers_per_item);
    if (next) await run("INSERT INTO served (item_id,worker,served_at) VALUES (?,?,?) ON CONFLICT(item_id,worker) DO NOTHING", next.id, pk, Math.floor(Date.now() / 1000));
    const done = (await get("SELECT COUNT(DISTINCT item_id) c FROM submissions WHERE task_id=? AND worker=? AND verdict='pass'", id, pk))!.c;
    const attempts = next ? (await get("SELECT COUNT(*) c FROM submissions WHERE item_id=? AND worker=?", next.id, pk))!.c : 0;
    let options: string[] | null = null;
    if (next && t.kind === "rank") { const p = JSON.parse(next.payload); options = swapFor(next.id, pk) ? [p.b, p.a] : [p.a, p.b]; }
    return { task: pub, isRequester: requester === pk, consent: t.kind === "speak" ? await hasVoiceConsent(pk) : true,
      item: next ? { id: next.id, prompt: next.prompt, options, labels: next.labels ? JSON.parse(next.labels) : null, attemptsLeft: maxAttempts - attempts } : null, done };
  });
}
void all;
