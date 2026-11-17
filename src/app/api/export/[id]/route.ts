import { createHash } from "node:crypto";
import { zipSync, strToU8 } from "fflate";
import { all, get } from "@/lib/db";
import { authPubkey } from "@/lib/auth";
import { attestDataset } from "@/lib/nostr";

export const runtime = "nodejs";
export const maxDuration = 60; // grading, payouts and Nostr publishing can take a while
const toks = (s: string) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean));
const jaccard = (a: string, b: string) => { const A = toks(a), B = toks(b); const i = [...A].filter((x) => B.has(x)).length; const u = new Set([...A, ...B]).size; return u ? i / u : 1; };

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const pk = await authPubkey(req, "");
    const t = await get("SELECT * FROM tasks WHERE id=?", id);
    if (!t || t.requester !== pk) return Response.json({ error: "Not your task" }, { status: 403 });
    // Only real items, only sanity-passing answers. Hidden check items never leave the server.
    const rows = await all(`SELECT i.id item_id,i.prompt,i.payload,s.id sub_id,s.audio_path,s.duration_ms,s.answer,s.score FROM items i JOIN submissions s ON s.item_id=i.id AND s.verdict='pass'
      WHERE i.task_id=? AND i.is_check=0 ORDER BY i.position,s.created_at`, id);
    const byItem = new Map<string, any[]>();
    rows.forEach((r) => byItem.set(r.item_id, [...(byItem.get(r.item_id) || []), r]));
    const out = rows.map((r) => {
      const group = byItem.get(r.item_id)!;
      const others = group.filter((g) => g !== r);
      const agreement = others.length ? Math.round(100 * Math.max(...others.map((o) => jaccard(o.answer, r.answer)))) / 100 : null;
      // consensus = 2+ independent workers whose answers overlap; disputed = they diverge; single = only one answer
      const confidence = group.length < 2 ? "single" : (agreement ?? 0) >= 0.6 ? "consensus" : "disputed";
      return { source: r.prompt, target: r.answer, src_lang: t.src_lang, dst_lang: t.dst_lang, task_kind: t.kind,
        sanity_score: r.score, workers_passed: group.length, agreement, confidence };
    });
    if (t.kind === "rank") {
      // Preference dataset: one row per item with vote counts and the plurality choice.
      const out = [...byItem.entries()].map(([, group]) => {
        const p = JSON.parse(group[0].payload || "{}");
        const votes = { A: 0, B: 0, neither: 0 } as Record<string, number>;
        group.forEach((g) => { votes[g.answer] = (votes[g.answer] || 0) + 1; });
        const total = group.length, top = Object.entries(votes).sort((x, y) => y[1] - x[1]);
        const tie = top.length > 1 && top[0][1] === top[1][1];
        const share = total ? top[0][1] / total : 0;
        return { prompt: group[0].prompt, response_a: p.a, response_b: p.b, language: t.dst_lang, preferred: tie ? "tie" : top[0][0], votes, voters: total,
          agreement: Math.round(share * 100) / 100, confidence: total < 2 ? "single" : !tie && share >= 0.6 ? "consensus" : "disputed" };
      });
      const body = out.map((o) => JSON.stringify(o)).join("\n");
      const sha = createHash("sha256").update(body).digest("hex");
      const h: Record<string, string> = { "content-type": "application/x-ndjson", "x-dataset-sha256": sha, "x-dataset-rows": String(out.length) };
      if (new URL(req.url).searchParams.get("attest") === "1" && out.length) h["x-nostr-event"] = await attestDataset({ taskId: id, requester: pk, sha256: sha, rows: out.length, format: "jsonl" });
      return new Response(body, { headers: h });
    }
    if (t.kind === "speak") {
      // Voice dataset = zip with dataset.jsonl + audio/*.wav (16 kHz mono PCM)
      const files: Record<string, Uint8Array> = {};
      const vrows = rows.filter((r) => r.audio_path);
      const meta: any[] = [];
      for (const [n, r] of vrows.entries()) {
        const file = `audio/${String(n + 1).padStart(4, "0")}.wav`;
        const a = await get("SELECT data FROM audio WHERE submission_id=?", r.sub_id);
        if (!a) continue;
        files[file] = new Uint8Array(a.data);
        const group = byItem.get(r.item_id)!;
        const rv = (await get("SELECT COUNT(*) n, COALESCE(SUM(match),0) ok FROM reviews WHERE submission_id=?", r.sub_id))!;
        // verified = an independent qualified listener typed what they heard and it matched the prompt sentence
        const verification = rv.ok > 0 ? "verified" : rv.n >= 2 ? "disputed" : "unverified";
        meta.push({ audio: file, text: r.prompt, language: t.dst_lang, license: t.license || "Research use only", duration_ms: r.duration_ms, sanity_score: r.score, speakers_for_item: group.length, verification, verified_by: rv.ok, reviewers: rv.n });
      }
      files["README.txt"] = strToU8(`Sats-for-Data voice dataset\nTask: ${t.title}\nLanguage: ${t.dst_lang}\nLicense set by requester: ${t.license || "Research use only"}\nSpeakers consented to this use when they recorded.\nAudio: 16 kHz mono PCM WAV. See dataset.jsonl for text and verification status.\n`);
      files["dataset.jsonl"] = strToU8(meta.map((m) => JSON.stringify(m)).join("\n"));
      const zip = zipSync(files);
      const shaZ = createHash("sha256").update(zip).digest("hex");
      const hz: Record<string, string> = { "content-type": "application/zip", "x-dataset-sha256": shaZ, "x-dataset-rows": String(meta.length) };
      if (new URL(req.url).searchParams.get("attest") === "1" && meta.length) hz["x-nostr-event"] = await attestDataset({ taskId: id, requester: pk, sha256: shaZ, rows: meta.length, format: "zip" });
      return new Response(Buffer.from(zip), { headers: hz });
    }
    const fmt = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "jsonl";
    let body: string, type: string;
    if (fmt === "csv") {
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const head = Object.keys(out[0] || { source: 1, target: 1 });
      body = [head.join(","), ...out.map((o) => head.map((h) => esc((o as any)[h])).join(","))].join("\n"); type = "text/csv";
    } else { body = out.map((o) => JSON.stringify(o)).join("\n"); type = "application/x-ndjson"; }

    const sha = createHash("sha256").update(body).digest("hex");
    const headers: Record<string, string> = { "content-type": type, "x-dataset-sha256": sha, "x-dataset-rows": String(out.length) };
    if (new URL(req.url).searchParams.get("attest") === "1" && out.length) {
      headers["x-nostr-event"] = await attestDataset({ taskId: id, requester: pk, sha256: sha, rows: out.length, format: fmt });
    }
    return new Response(body, { headers });
  } catch (e: any) { return Response.json({ error: e.message }, { status: 401 }); }
}
