import { NWCClient } from "@getalby/sdk/nwc";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { decrypt } from "./crypto";

// Looks the address up (LNURL-pay) without paying, so a typo is caught when it is saved, not after the work is done.
export async function checkAddress(addr: string): Promise<{ ok: boolean; min?: number; max?: number; error?: string }> {
  const m = /^([a-z0-9._+-]+)@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(addr.trim());
  if (!m) return { ok: false, error: "That is not a Lightning address. It looks like name@domain.com." };
  try {
    const res = await fetch(`https://${m[2]}/.well-known/lnurlp/${encodeURIComponent(m[1])}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, error: "That address was not found. Check the spelling or try another wallet." };
    const j = await res.json();
    if (!j.callback || j.status === "ERROR") return { ok: false, error: j.reason || "That address cannot receive payments." };
    return { ok: true, min: Math.ceil((j.minSendable || 1000) / 1000), max: Math.floor((j.maxSendable || 1e12) / 1000) };
  } catch { return { ok: false, error: "We could not reach that wallet. Check the address or your connection." }; }
}

export const cooldownSecs = () => Number(process.env.PAYOUT_COOLDOWN_SECS ?? 20);

export async function invoiceFromAddress(addr: string, sats: number): Promise<string> {
  const [name, host] = addr.split("@");
  if (!name || !host) throw new Error("Invalid Lightning address");
  const meta = await (await fetch(`https://${host}/.well-known/lnurlp/${encodeURIComponent(name)}`)).json();
  const msats = sats * 1000;
  if (!meta.callback || msats < meta.minSendable || msats > meta.maxSendable) throw new Error("Amount outside the address's limits");
  const u = new URL(meta.callback);
  u.searchParams.set("amount", String(msats));
  const inv = await (await fetch(u)).json();
  if (!inv.pr) throw new Error("No invoice returned");
  return inv.pr;
}

export function todayPaid(worker: string) {
  const since = Math.floor(Date.now() / 1000) - 86400;
  const r = db().prepare("SELECT COALESCE(SUM(sats),0) s FROM payouts WHERE worker=? AND status='paid' AND created_at>?").get(worker, since) as { s: number };
  return r.s;
}

// Step 1: record an approved answer. The payout is HELD for a cooldown so abuse can be caught
// (check-item failures, requester review) before money moves. UNIQUE(item_id, worker) = no double pay.
export function queuePayout(task: { id: string; reward_sats: number }, itemId: string, worker: string) {
  const now = Math.floor(Date.now() / 1000);
  try {
    db().prepare("INSERT INTO payouts (id,item_id,task_id,worker,sats,status,created_at,release_at) VALUES (?,?,?,?,?,'pending',?,?)")
      .run(randomUUID(), itemId, task.id, worker, task.reward_sats, now, now + cooldownSecs());
    return { status: "pending" as const, releaseAt: now + cooldownSecs() };
  } catch { return { status: "duplicate" as const }; }
}

const flaggedWorker = (taskId: string, worker: string) => !!db().prepare(`SELECT 1 FROM submissions s JOIN items i ON i.id=s.item_id
  WHERE s.task_id=? AND s.worker=? AND i.is_check=1 AND s.verdict='fail' AND s.attempt>=CASE WHEN (SELECT kind FROM tasks WHERE id=s.task_id)='rank' THEN 1 ELSE 3 END
  AND NOT EXISTS (SELECT 1 FROM submissions s2 WHERE s2.item_id=s.item_id AND s2.worker=s.worker AND s2.verdict='pass')`).get(taskId, worker);

// Step 2: release due payouts. Called lazily from API routes (no cron needed).
let sweeping = false;
export async function releaseDue() {
  if (sweeping) return;
  sweeping = true;
  try {
    const d = db();
    const cap = Number(process.env.DAILY_CAP_SATS || 2000);
    const now = Math.floor(Date.now() / 1000);
    const due = d.prepare("SELECT p.* FROM payouts p JOIN tasks t ON t.id=p.task_id WHERE p.status='pending' AND p.sending=0 AND p.release_at<=? AND t.status='open' LIMIT 20").all(now) as any[];
    for (const p of due) {
      if (flaggedWorker(p.task_id, p.worker)) { d.prepare("UPDATE payouts SET status='withheld', error='Quality check failed on this task' WHERE id=?").run(p.id); continue; }
      const w = d.prepare("SELECT lightning_address a FROM workers WHERE pubkey=?").get(p.worker) as { a?: string } | undefined;
      if (!w?.a) continue;                                   // stays held until they add an address
      if (todayPaid(p.worker) + p.sats > cap) continue;      // stays held until under the daily cap
      if (d.prepare("UPDATE payouts SET sending=1 WHERE id=? AND sending=0").run(p.id).changes !== 1) continue;
      const task = d.prepare("SELECT nwc_enc FROM tasks WHERE id=?").get(p.task_id) as { nwc_enc: string };
      if (process.env.MOCK_PAYMENTS === "1") { d.prepare("UPDATE payouts SET status='paid', preimage='mock' WHERE id=?").run(p.id); continue; }
      // Two failure kinds: the worker's address (they can fix it) or the requester's wallet (pauses the task).
      let stage: "address" | "wallet" = "address";
      try {
        const invoice = await invoiceFromAddress(w.a, p.sats);
        stage = "wallet";
        const nwc = new NWCClient({ nostrWalletConnectUrl: decrypt(task.nwc_enc) });
        try {
          const r = await nwc.payInvoice({ invoice });
          d.prepare("UPDATE payouts SET status='paid', preimage=? WHERE id=?").run(r.preimage, p.id);
        } finally { nwc.close(); }
      } catch (e: any) {
        const msg = String(e?.message || "Payment failed").slice(0, 200);
        d.prepare("UPDATE payouts SET status='failed', error=? WHERE id=?").run(`${stage === "address" ? "address" : "funding"}: ${msg}`, p.id);
        if (stage === "wallet") {
          const n = (d.prepare("SELECT COUNT(*) c FROM payouts WHERE task_id=? AND status='failed' AND error LIKE 'funding:%'").get(p.task_id) as any).c;
          if (n >= 2) d.prepare("UPDATE tasks SET status='paused', pause_reason=? WHERE id=? AND status='open'").run(`Payments from your wallet are failing (${msg}). Check the balance and spending limit, then resume.`, p.task_id);
        }
      }
    }
  } finally { sweeping = false; }
}

// Fire-and-forget sweep for API routes: a slow or broken requester wallet must never slow down workers.
export const kickRelease = () => { releaseDue().catch((e) => console.error("[payout] sweep failed:", e)); };
