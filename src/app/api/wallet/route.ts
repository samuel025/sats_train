import { all, get, run } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { todayPaid, kickRelease, checkAddress } from "@/lib/payout";
import { reputation } from "@/lib/reputation";
import { payoutVia } from "@/lib/wallet";

export const runtime = "nodejs";
export const maxDuration = 60; // grading, payouts and Nostr publishing can take a while

export async function GET(req: Request) {
  return withAuth(req, async (pk) => {
    kickRelease();
    const w = await get("SELECT lightning_address a FROM workers WHERE pubkey=?", pk);
    const payouts = await all("SELECT p.id,p.sats,p.status,p.error,p.created_at,p.release_at,p.sending,p.via,t.title FROM payouts p JOIN tasks t ON t.id=p.task_id WHERE p.worker=? ORDER BY p.created_at DESC LIMIT 50", pk);
    const total = (await get("SELECT COALESCE(SUM(sats),0) s FROM payouts WHERE worker=? AND status='paid'", pk))!.s;
    const mine = await all(`SELECT t.id,t.title,t.kind,t.status,t.pause_reason,
      (SELECT COUNT(*) FROM items i WHERE i.task_id=t.id AND i.is_check=0) items,
      (SELECT COUNT(*) FROM payouts p WHERE p.task_id=t.id AND p.status='paid') paid FROM tasks t WHERE t.requester=? ORDER BY t.created_at DESC`, pk);
    return { address: w?.a || "", payoutVia: await payoutVia(pk), pubkey: pk, reputation: await reputation(pk), total, today: await todayPaid(pk), cap: Number(process.env.DAILY_CAP_SATS || 2000), payouts, myTasks: mine };
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (pk, b) => {
    const a = String(b.address || "").trim().toLowerCase();
    if (!/^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(a)) throw new Error("That is not a valid Lightning address (name@domain)");
    if (process.env.MOCK_PAYMENTS !== "1") { const c = await checkAddress(a); if (!c.ok) throw new Error(c.error); }
    await run("INSERT INTO workers (pubkey,lightning_address) VALUES (?,?) ON CONFLICT(pubkey) DO UPDATE SET lightning_address=EXCLUDED.lightning_address", pk, a);
    // Payments that failed because the old address was wrong are retried with the new one.
    const retried = await run("UPDATE payouts SET status='pending', sending=0, error=NULL, release_at=? WHERE worker=? AND status='failed' AND error LIKE 'address:%'", Math.floor(Date.now() / 1000), pk);
    return { ok: true, retried };
  });
}
