import { get } from "@/lib/db";
import { withAuth } from "@/lib/auth";

export const runtime = "nodejs";

// Tiny summary used to nudge a worker toward the next necessary step (e.g. add a payout address).
export async function GET(req: Request) {
  return withAuth(req, async (pk) => {
    const a = await get("SELECT lightning_address a FROM workers WHERE pubkey=?", pk);
    const p = (await get("SELECT COALESCE(SUM(sats),0) s FROM payouts WHERE worker=? AND status='pending'", pk))!;
    const acc = (await get("SELECT COUNT(*) c FROM submissions WHERE worker=? AND verdict='pass'", pk))!;
    return { hasAddress: !!a?.a, pendingSats: p.s as number, accepted: acc.c as number };
  });
}
