import { NWCClient } from "@getalby/sdk/nwc";
import { get } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { withAuth } from "@/lib/auth";
import { throttle } from "@/lib/wallet";

export const runtime = "nodejs";
export const maxDuration = 30;
const timeout = <X>(p: Promise<X>, ms = 12000) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

// Can this task's wallet still pay everything it may owe? Compares the wallet balance and spending cap with what is still to be paid.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withAuth(req, async (pk) => {
    throttle(pk, 12);
    const t = await get("SELECT * FROM tasks WHERE id=?", id);
    if (!t || t.requester !== pk) throw new Error("Not your task");

    // What the task may still pay: held payouts, plus every answer slot not yet taken (plus peer verification for voice tasks).
    const items = (await get("SELECT COUNT(*) c FROM items WHERE task_id=?", id))!.c as number;
    const slots = items * t.answers_per_item;
    const taken = (await get("SELECT COUNT(*) c FROM payouts WHERE task_id=? AND item_id NOT LIKE 'rev:%' AND status IN ('paid','pending')", id))!.c as number;
    const revTaken = (await get("SELECT COUNT(*) c FROM payouts WHERE task_id=? AND item_id LIKE 'rev:%' AND status IN ('paid','pending')", id))!.c as number;
    const heldSats = (await get("SELECT COALESCE(SUM(sats),0) s FROM payouts WHERE task_id=? AND status='pending'", id))!.s as number;
    const remainingSats = Math.max(0, slots - taken) * t.reward_sats + (t.review_sats ? Math.max(0, slots - revTaken) * t.review_sats : 0);
    const needed = heldSats + remainingSats;
    const base = { needed, heldSats, remainingSats };

    let link = ""; try { link = decrypt(t.nwc_enc); } catch { throw new Error("This task's wallet link cannot be read."); }
    if (link === "demo") return { ...base, simulated: true };

    const c = new NWCClient({ nostrWalletConnectUrl: link });
    try {
      let methods: string[] = [];
      try { methods = ((await timeout(c.getInfo())).methods || []) as string[]; } catch { throw new Error("We could not reach this task's wallet. Check it is online and the link has not been revoked."); }
      let balance: number | null = null, budget: { left: number; total: number } | null = null;
      if (methods.includes("get_balance")) { try { balance = Math.floor((await timeout(c.getBalance())).balance / 1000); } catch { /* optional */ } }
      if (methods.includes("get_budget")) {
        try { const b: any = await timeout(c.getBudget()); const total = Number(b.total_budget || 0) / 1000, used = Number(b.used_budget || 0) / 1000; if (total > 0) budget = { total: Math.floor(total), left: Math.max(0, Math.floor(total - used)) }; } catch { /* some wallets have no cap */ }
      }
      const available = Math.min(balance ?? Infinity, budget?.left ?? Infinity);
      const short = Number.isFinite(available) ? Math.max(0, needed - available) : 0;
      const limitedBy = !Number.isFinite(available) ? null : (budget && budget.left <= (balance ?? Infinity)) ? "cap" : "balance";
      return { ...base, balance, budget, short, limitedBy, funded: short === 0, status: t.status };
    } finally { c.close(); }
  });
}
