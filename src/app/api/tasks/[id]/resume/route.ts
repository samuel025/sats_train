import { NWCClient } from "@getalby/sdk/nwc";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { withAuth } from "@/lib/auth";
import { releaseDue } from "@/lib/payout";

export const runtime = "nodejs";

// Requester fixes their wallet (new NWC link) and resumes a paused task. Payments that failed for funding reasons are retried.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withAuth(req, async (pk, b) => {
    const d = db();
    const t = d.prepare("SELECT * FROM tasks WHERE id=?").get(id) as any;
    if (!t || t.requester !== pk) throw new Error("Not your task");
    const nwc = String(b.nwc || "").trim();
    let balance: number | null = null;
    if (nwc && nwc !== "demo") {
      try { NWCClient.parseWalletConnectUrl(nwc); } catch { throw new Error("That does not look like a Nostr Wallet Connect link"); }
      // Prove the link works before resuming, so workers are not sent back into a broken task.
      const c = new NWCClient({ nostrWalletConnectUrl: nwc });
      try { balance = Math.floor(((await Promise.race([c.getBalance(), new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 10000))])) as any).balance / 1000); }
      catch { throw new Error("We could not reach that wallet link. Check it allows reading the balance and sending payments."); }
      finally { c.close(); }
      d.prepare("UPDATE tasks SET nwc_enc=? WHERE id=?").run(encrypt(nwc), id);
    } else if (nwc === "demo" && process.env.MOCK_PAYMENTS !== "1") throw new Error("Demo wallet only works in mock mode");
    d.prepare("UPDATE tasks SET status='open', pause_reason=NULL WHERE id=? AND status<>'closed'").run(id);
    const retried = d.prepare("UPDATE payouts SET status='pending', sending=0, error=NULL, release_at=? WHERE task_id=? AND status='failed' AND error LIKE 'funding:%'").run(Math.floor(Date.now() / 1000), id).changes;
    await releaseDue();
    return { resumed: true, balance, retried };
  });
}
