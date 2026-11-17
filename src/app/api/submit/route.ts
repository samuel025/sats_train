import { randomUUID, createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { grade, gradeAudio } from "@/lib/grader";
import { queuePayout, kickRelease, cooldownSecs } from "@/lib/payout";
import { gate } from "@/lib/reputation";
import { hasVoiceConsent } from "@/lib/consent";
import { swapFor } from "@/lib/rank";

export const runtime = "nodejs";
const inflight = new Set<string>();

// Anti-abuse: cheap server-side checks that run BEFORE the LLM (and before any money is queued).
function abuseCheck(pk: string, itemId: string, answer: string, kind: string): { block?: string; fail?: string } {
  const d = db();
  const now = Math.floor(Date.now() / 1000);
  const perMin = Number(process.env.SUBMIT_PER_MIN || 10);
  const recent = (d.prepare("SELECT COUNT(*) c FROM submissions WHERE worker=? AND created_at>?").get(pk, now - 60) as any).c
    + (d.prepare("SELECT COUNT(*) c FROM reviews WHERE reviewer=? AND created_at>?").get(pk, now - 60) as any).c;
  if (recent >= perMin) return { block: `Slow down: max ${perMin} answers per minute.` };
  // Rapid submission: a real person needs a few seconds to read and answer.
  const sv = d.prepare("SELECT served_at FROM served WHERE item_id=? AND worker=?").get(itemId, pk) as any;
  const minSecs = Number(process.env.MIN_ANSWER_SECS ?? 3);
  if (!sv || now - sv.served_at < minSecs) return { fail: "That was too fast. Read the item and answer it yourself." };
  // Copy-paste farming: the same answer pasted into several different items (not for choice-style tasks).
  if (kind !== "classify" && kind !== "rank") {
    const same = (d.prepare("SELECT COUNT(DISTINCT item_id) c FROM submissions WHERE worker=? AND item_id<>? AND lower(trim(answer))=lower(trim(?))").get(pk, itemId, answer) as any).c;
    if (same >= 2) return { fail: "You used this same answer on other items. Write an answer for this one." };
  }
  return {};
}

export async function POST(req: Request) {
  return withAuth(req, async (pk, b) => {
    kickRelease();
    let answer = String(b.answer || "").trim().slice(0, 2000);
    const d = db();
    const it = d.prepare("SELECT * FROM items WHERE id=?").get(b.itemId) as any;
    if (!it) throw new Error("Item not found");
    const t = d.prepare("SELECT * FROM tasks WHERE id=?").get(it.task_id) as any;
    if (!t || t.status === "closed") throw new Error("Task closed");
    if (t.status === "paused") throw new Error("This task is paused while the requester fixes their wallet. Try another task.");
    if (t.requester === pk) throw new Error("Requesters cannot answer their own tasks");
    const blocked = gate(pk, t); if (blocked) throw new Error(blocked);
    if (t.kind === "speak" && !hasVoiceConsent(pk)) throw new Error("Please accept the voice recording consent first.");
    const rank = t.kind === "rank";
    const maxAttempts = rank ? 1 : 3; // a choice between two options can't be retried without guessing

    const key = `${it.id}:${pk}`;
    if (inflight.has(key)) throw new Error("Already grading this answer");
    inflight.add(key);
    try {
      const prev = d.prepare("SELECT verdict,attempt FROM submissions WHERE item_id=? AND worker=? ORDER BY attempt").all(it.id, pk) as any[];
      if (prev.some((p) => p.verdict === "pass")) throw new Error("Already answered");
      if (prev.length >= maxAttempts) throw new Error("No retries left for this item");

      // Voice: the answer is a WAV recording. Fingerprint it so re-used clips are caught like re-used text.
      let wav: Buffer | null = null; const durationMs = Math.round(Number(b.durationMs) || 0);
      if (t.kind === "speak") {
        wav = Buffer.from(String(b.audio || ""), "base64");
        if (wav.length < 4000 || wav.length > 2_500_000 || wav.toString("ascii", 0, 4) !== "RIFF") throw new Error("That recording is empty or too large. Try again.");
        answer = "audio:" + createHash("sha256").update(wav).digest("hex");
      }
      // Ranking: the worker sees the replies in a per-worker order; map the choice back to canonical A/B.
      if (rank) {
        const c = String(b.choice || "");
        if (!["1", "2", "neither"].includes(c)) throw new Error("Pick a reply first");
        answer = c === "neither" ? "neither" : (c === "1") !== swapFor(it.id, pk) ? "A" : "B";
      }
      const ab = abuseCheck(pk, it.id, answer, t.kind);
      if (ab.block) throw new Error(ab.block);
      if (!ab.fail && wav && (durationMs < 1000 || durationMs > 35000)) ab.fail = durationMs < 1000 ? "Recording is too short. Read the whole sentence." : "Recording is too long.";

      // Peer consensus and hidden gold items do the quality work for choices; the LLM only filters free text and audio.
      const v = ab.fail ? { pass: false, score: 0, reason: ab.fail }
        : rank ? (it.known_answer && answer !== it.known_answer
            ? { pass: false, score: 0, reason: "Your choice did not match our quality check." }
            : { pass: true, score: 1, reason: "Choice recorded." })
        : wav ? await gradeAudio(wav.toString("base64"), "audio/wav", { src: t.src_lang, dst: t.dst_lang, prompt: it.prompt, instructions: t.instructions })
        : await grade(answer, { kind: t.kind, src: t.src_lang, dst: t.dst_lang, instructions: t.instructions, prompt: it.prompt,
            knownAnswer: it.known_answer, labels: it.labels ? JSON.parse(it.labels) : null, priorAnswers: [] });

      const subId = randomUUID();
      let audioPath: string | null = null;
      if (wav && v.pass) { // keep only accepted recordings
        const dir = process.env.AUDIO_DIR || "audio_data"; mkdirSync(dir, { recursive: true });
        audioPath = join(dir, `${subId}.wav`); writeFileSync(audioPath, wav);
      }
      d.prepare("INSERT INTO submissions (id,item_id,task_id,worker,answer,verdict,score,reason,attempt,created_at,audio_path,duration_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(subId, it.id, t.id, pk, answer, v.pass ? "pass" : "fail", v.score, v.reason, prev.length + 1, Math.floor(Date.now() / 1000), audioPath, wav ? durationMs : null);

      let payment: any = null;
      if (v.pass) {
        const taken = (d.prepare("SELECT COUNT(*) c FROM payouts WHERE item_id=? AND status IN ('paid','pending')").get(it.id) as any).c;
        payment = taken >= t.answers_per_item ? { status: "full", error: "This item already has enough answers." } : queuePayout(t, it.id, pk);
        if (payment.status === "pending") payment.cooldown = cooldownSecs();
      }
      let peers = 0;
      if (v.pass) peers = (d.prepare("SELECT COUNT(DISTINCT worker) c FROM submissions WHERE item_id=? AND verdict='pass'").get(it.id) as any).c;
      return { pass: v.pass, score: v.score, reason: v.reason, attemptsLeft: maxAttempts - (prev.length + 1), payment, sats: t.reward_sats, peers };
    } finally { inflight.delete(key); }
  });
}
