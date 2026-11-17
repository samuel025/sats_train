import { readFileSync } from "node:fs";
import { db } from "@/lib/db";
import { authPubkey } from "@/lib/auth";

export const runtime = "nodejs";

// Only the speaker, the task's requester, or a reviewer who was assigned the clip can download a recording.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const pk = await authPubkey(req, "");
    const r = db().prepare("SELECT s.worker, s.audio_path, t.requester FROM submissions s JOIN tasks t ON t.id=s.task_id WHERE s.id=?").get(id) as any;
    const assigned = !!db().prepare("SELECT 1 FROM served WHERE item_id=? AND worker=?").get("rev:" + id, pk);
    if (!r?.audio_path || (r.worker !== pk && r.requester !== pk && !assigned)) return Response.json({ error: "Not found" }, { status: 404 });
    return new Response(readFileSync(r.audio_path), { headers: { "content-type": "audio/wav" } });
  } catch (e: any) { return Response.json({ error: e.message }, { status: 401 }); }
}
