import { NWCClient } from "@getalby/sdk/nwc";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { all, get, run, isUniqueViolation } from "./db";
import { DEMO_REQUESTER } from "./seed";
import { publicJson, invoiceAmountMsat } from "./safe";
import { decrypt } from "./crypto";

// Looks the address up (LNURL-pay) without paying, so a typo is caught when it is saved, not after the work is done.
export async function checkAddress(addr: string): Promise<{ ok: boolean; min?: number; max?: number; error?: string }> {
  const m = /^([a-z0-9._+-]+)@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(addr.trim());
  if (!m) return { ok: false, error: "That is not a Lightning address. It looks like name@domain.com." };
  try {
    const j = await publicJson(`https://${m[2]}/.well-known/lnurlp/${encodeURIComponent(m[1])}`);
    if (!j.callback || j.status === "ERROR") return { ok: false, error: j.reason || "That address cannot receive payments." };
    return { ok: true, min: Math.ceil((j.minSendable || 1000) / 1000), max: Math.floor((j.maxSendable || 1e12) / 1000) };
  } catch { return { ok: false, error: "We could not reach that wallet, or it is not a public Lightning address. Check the spelling or try another wallet." }; }
}

export const cooldownSecs = () => Number(process.env.PAYOUT_COOLDOWN_SECS ?? 20);

export async function invoiceFromAddress(addr: string, sats: number): Promise<string> {
  const [name, host] = addr.split("@");
  if (!name || !host) throw new Error("Invalid Lightning address");
  // The address is typed by a worker, so its server is untrusted: public https only, and the invoice must match the amount we meant to pay.
  const meta = await publicJson(`https://${host}/.well-known/lnurlp/${encodeURIComponent(name)}`);
  const msats = sats * 1000;
  if (!meta.callback || msats < meta.minSendable || msats > meta.maxSendable) throw new Error("Amount outside the address's limits");
  const u = new URL(meta.callback);
  u.searchParams.set("amount", String(msats));
  const inv = await publicJson(u.toString());
  if (!inv.pr || typeof inv.pr !== "string") throw new Error("No invoice returned");
  if (invoiceAmountMsat(inv.pr) !== msats) throw new Error("The wallet returned an invoice for a different amount, so nothing was paid");
  return inv.pr;
}

export async function todayPaid(worker: string) {
  const since = Math.floor(Date.now() / 1000) - 86400;
  const r = (await get("SELECT COALESCE(SUM(sats),0) s FROM payouts WHERE worker=? AND status='paid' AND created_at>?", worker, since))!;
  return r.s as number;
}

// Step 1: record an approved answer. The payout is HELD for a cooldown so abuse can be caught
// (check-item failures, requester review) before money moves. UNIQUE(item_id, worker) = no double pay.
export async function queuePayout(task: { id: string; reward_sats: number }, itemId: string, worker: string) {
  const now = Math.floor(Date.now() / 1000);
  try {
    await run("INSERT INTO payouts (id,item_id,task_id,worker,sats,status,created_at,release_at) VALUES (?,?,?,?,?,'pending',?,?)",
      randomUUID(), itemId, task.id, worker, task.reward_sats, now, now + cooldownSecs());
    return { status: "pending" as const, releaseAt: now + cooldownSecs() };
  } catch (e) { if (isUniqueViolation(e)) return { status: "duplicate" as const }; throw e; }
}

const flaggedWorker = async (taskId: string, worker: string) => !!(await get(`SELECT 1 FROM submissions s JOIN items i ON i.id=s.item_id
  WHERE s.task_id=? AND s.worker=? AND i.is_check=1 AND s.verdict='fail'
  AND s.attempt>=CASE WHEN (SELECT kind FROM tasks WHERE id=s.task_id)='rank' THEN 1 ELSE 3 END
  AND NOT EXISTS (SELECT 1 FROM submissions s2 WHERE s2.item_id=s.item_id AND s2.worker=s.worker AND s2.verdict='pass') LIMIT 1`, taskId, worker));

// Step 2: release due payouts. Called lazily from API routes (no cron needed).
let sweeping = false;
export async function releaseDue() {
  if (sweeping) return;
  sweeping = true;
  try {
    const cap = Number(process.env.DAILY_CAP_SATS || 2000);
    const now = Math.floor(Date.now() / 1000);
    const due = await all("SELECT p.* FROM payouts p JOIN tasks t ON t.id=p.task_id WHERE p.status='pending' AND p.sending=0 AND p.release_at<=? AND t.status='open' LIMIT 20", now);
    for (const p of due) {
      if (await flaggedWorker(p.task_id, p.worker)) { await run("UPDATE payouts SET status='withheld', error='Quality check failed on this task' WHERE id=?", p.id); continue; }
      const w = await get("SELECT lightning_address a FROM workers WHERE pubkey=?", p.worker);
      if (!w?.a) continue;                                   // stays held until they add an address
      if ((await todayPaid(p.worker)) + p.sats > cap) continue; // stays held until under the daily cap
      if ((await run("UPDATE payouts SET sending=1 WHERE id=? AND sending=0", p.id)) !== 1) continue;
      const task = (await get("SELECT nwc_enc, requester FROM tasks WHERE id=?", p.task_id))!;
      if (process.env.MOCK_PAYMENTS === "1") { await run("UPDATE payouts SET status='paid', preimage='mock' WHERE id=?", p.id); continue; }
      // Two failure kinds: the worker's address (they can fix it) or the requester's wallet (pauses the task).
      let stage: "address" | "wallet" = "address";
      try {
        const invoice = await invoiceFromAddress(w.a, p.sats);
        stage = "wallet";
        const nwc = new NWCClient({ nostrWalletConnectUrl: decrypt(task.nwc_enc) });
        try {
          const r = await nwc.payInvoice({ invoice });
          await run("UPDATE payouts SET status='paid', preimage=? WHERE id=?", r.preimage, p.id);
        } finally { nwc.close(); }
      } catch (e: any) {
        const msg = String(e?.message || "Payment failed").slice(0, 200);
        await run("UPDATE payouts SET status='failed', error=? WHERE id=?", `${stage === "address" ? "address" : "funding"}: ${msg}`, p.id);
        if (stage === "wallet") {
          const n = (await get("SELECT COUNT(*) c FROM payouts WHERE task_id=? AND status='failed' AND error LIKE 'funding:%'", p.task_id))!.c;
          // Demo tasks have no owner who could resume them, so they stay open; refill with `npm run demo:wallet`.
          if (n >= 2 && task.requester !== DEMO_REQUESTER) await run("UPDATE tasks SET status='paused', pause_reason=? WHERE id=? AND status='open'", `Payments from your wallet are failing (${msg}). Check the balance and spending limit, then resume.`, p.task_id);
        }
      }
    }
  } finally { sweeping = false; }
}

// Background sweep for API routes: a slow or broken requester wallet must never slow down workers.
// after() keeps the serverless function alive until the sweep finishes (a bare promise would be frozen on Vercel).
export const kickRelease = () => {
  const job = () => releaseDue().catch((e) => console.error("[payout] sweep failed:", e));
  try { after(job); } catch { void job(); } // outside a request (scripts/tests) there is nothing to extend
};
