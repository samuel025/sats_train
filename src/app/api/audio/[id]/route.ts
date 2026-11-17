import { get } from "@/lib/db";
import { authPubkey } from "@/lib/auth";

export const runtime = "nodejs";

// Only the speaker, the task's requester, or a reviewer who was assigned the clip can download a recording.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const pk = await authPubkey(req, "");
    const r = await get("SELECT s.worker, s.audio_path, t.requester, a.data FROM submissions s JOIN tasks t ON t.id=s.task_id LEFT JOIN audio a ON a.submission_id=s.id WHERE s.id=?", id);
    const assigned = !!(await get("SELECT 1 FROM served WHERE item_id=? AND worker=?", "rev:" + id, pk));
    if (!r?.data || (r.worker !== pk && r.requester !== pk && !assigned)) return Response.json({ error: "Not found" }, { status: 404 });
    return new Response(new Uint8Array(r.data), { headers: { "content-type": "audio/wav" } });
  } catch (e: any) { return Response.json({ error: e.message }, { status: 401 }); }
}
