import { randomUUID } from "node:crypto";
import { NWCClient } from "@getalby/sdk/nwc";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { withAuth } from "@/lib/auth";
import { publishEvent, checkTaskEvent } from "@/lib/nostr";
import { LICENSES } from "@/lib/consent";

export const runtime = "nodejs";

export async function GET() {
  const rows = db().prepare(`
    SELECT t.id,t.title,t.kind,t.src_lang,t.dst_lang,t.reward_sats,t.created_at,t.nostr_event_id,t.answers_per_item,t.min_level,t.require_qual,t.review_sats,
      (SELECT COUNT(*) FROM items i WHERE i.task_id=t.id AND i.is_check=0) AS item_count,
      (SELECT COUNT(*) FROM payouts p WHERE p.task_id=t.id AND p.status='paid' AND p.item_id NOT LIKE 'rev:%') AS paid_count
    FROM tasks t WHERE t.status='open' ORDER BY t.created_at DESC`).all();
  return Response.json(rows);
}

type In = { prompt?: string; a?: string; b?: string; labels?: string[]; answer?: string };

export async function POST(req: Request) {
  return withAuth(req, async (pk, b) => {
    const kind = ["translate", "classify", "label", "speak", "rank"].includes(b.kind) ? b.kind : "translate";
    const rank = kind === "rank";
    const okItem = (i: In) => i?.prompt?.trim() && (!rank || (i.a?.trim() && i.b?.trim()));
    const items: In[] = (b.items || []).filter(okItem);
    const checks: In[] = (b.checks || []).filter((c: In) => okItem(c) && c.answer?.trim() && (!rank || ["A", "B"].includes(c.answer.trim().toUpperCase())));
    if (!b.title?.trim() || items.length < 1 || items.length > 200) throw new Error("Need a title and 1-200 valid items");
    const reward = Math.floor(Number(b.reward));
    if (!(reward >= 1 && reward <= 10000)) throw new Error("Reward must be 1-10000 sats");
    const nwc = String(b.nwc || "").trim();
    if (nwc !== "demo") {
      try { NWCClient.parseWalletConnectUrl(nwc); } catch { throw new Error("That does not look like a Nostr Wallet Connect link"); }
    } else if (process.env.MOCK_PAYMENTS !== "1") throw new Error("Demo wallet only works when MOCK_PAYMENTS=1");

    const id = String(b.id || "");
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Missing task id");
    checkTaskEvent(b.event, pk, id); // the REQUESTER signs the public task event
    const d = db();
    const minLevel = Math.min(Math.max(Math.floor(Number(b.minLevel) || 0), 0), 2);
    // Voice tasks also pay a peer to verify each clip (30% of the item reward).
    const reviewSats = kind === "speak" ? Math.max(1, Math.round(reward * 0.3)) : null;
    d.prepare(`INSERT INTO tasks (id,requester,title,kind,src_lang,dst_lang,instructions,reward_sats,nwc_enc,created_at,answers_per_item,min_level,require_qual,review_sats,license)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, pk, b.title.trim(), kind, b.src || "English", b.dst || "Nigerian Pidgin",
      (b.instructions || "").trim(), reward, encrypt(nwc), Math.floor(Date.now() / 1000), Math.min(Math.max(Number(b.answersPerItem) || 1, 1), 5),
      minLevel, b.requireQual ? 1 : 0, reviewSats, (LICENSES as readonly string[]).includes(b.license) ? b.license : LICENSES[0]);
    const ins = d.prepare("INSERT INTO items (id,task_id,position,prompt,is_check,known_answer,labels,payload) VALUES (?,?,?,?,?,?,?,?)");
    // Hidden check items are shuffled in with real ones and look identical to workers.
    const all = [
      ...items.map((i) => ({ ...i, check: 0, answer: null as string | null })),
      ...checks.map((c) => ({ ...c, check: 1, answer: rank ? c.answer!.trim().toUpperCase() : c.answer!.trim() })),
    ].sort(() => Math.random() - 0.5);
    all.forEach((i, n) => ins.run(randomUUID(), id, n, i.prompt!.trim(), i.check, i.answer, i.labels ? JSON.stringify(i.labels) : null,
      rank ? JSON.stringify({ a: i.a!.trim(), b: i.b!.trim() }) : null));

    const ev = await publishEvent(b.event);
    d.prepare("UPDATE tasks SET nostr_event_id=? WHERE id=?").run(b.event.id, id);
    return { id, nostrEventId: b.event.id, published: !!ev };
  });
}
