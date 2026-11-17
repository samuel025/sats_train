import { db } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { todayPaid, kickRelease, checkAddress } from "@/lib/payout";
import { reputation } from "@/lib/reputation";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAuth(req, async (pk) => {
    kickRelease();
    const d = db();
    const w = d.prepare("SELECT lightning_address a FROM workers WHERE pubkey=?").get(pk) as any;
    const payouts = d.prepare(`SELECT p.id,p.sats,p.status,p.error,p.created_at,p.release_at,t.title FROM payouts p JOIN tasks t ON t.id=p.task_id WHERE p.worker=? ORDER BY p.created_at DESC LIMIT 50`).all(pk);
    const total = (d.prepare("SELECT COALESCE(SUM(sats),0) s FROM payouts WHERE worker=? AND status='paid'").get(pk) as any).s;
    const mine = d.prepare(`SELECT t.id,t.title,t.kind,t.status,t.pause_reason,
      (SELECT COUNT(*) FROM items i WHERE i.task_id=t.id AND i.is_check=0) items,
      (SELECT COUNT(*) FROM payouts p WHERE p.task_id=t.id AND p.status='paid') paid FROM tasks t WHERE t.requester=? ORDER BY t.created_at DESC`).all(pk);
    return { address: w?.a || "", pubkey: pk, reputation: reputation(pk), total, today: todayPaid(pk), cap: Number(process.env.DAILY_CAP_SATS || 2000), payouts, myTasks: mine };
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (pk, b) => {
    const a = String(b.address || "").trim().toLowerCase();
    if (!/^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(a)) throw new Error("That is not a valid Lightning address (name@domain)");
    if (process.env.MOCK_PAYMENTS !== "1") { const c = await checkAddress(a); if (!c.ok) throw new Error(c.error); }
    db().prepare("INSERT INTO workers (pubkey,lightning_address) VALUES (?,?) ON CONFLICT(pubkey) DO UPDATE SET lightning_address=excluded.lightning_address").run(pk, a);
    // Payments that failed because the old address was wrong are retried with the new one.
    const retried = db().prepare("UPDATE payouts SET status='pending', sending=0, error=NULL, release_at=? WHERE worker=? AND status='failed' AND error LIKE 'address:%'").run(Math.floor(Date.now() / 1000), pk).changes;
    return { ok: true, retried };
  });
}
