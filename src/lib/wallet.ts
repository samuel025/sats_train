// A worker's own Lightning wallet, connected through Nostr Wallet Connect: live balance, recent transactions, receive invoices.
// Least privilege: by default a link that can SEND money is refused, so this server never holds a key that can spend a worker's funds.
import { NWCClient } from "@getalby/sdk/nwc";
import { get, run } from "./db";
import { encrypt, decrypt } from "./crypto";
import { canSpend, invoiceAmountMsat } from "./safe";

const TIMEOUT_MS = 12000;
const friendly = "We could not reach your wallet. Check that it is online and that the connection has not been revoked.";
const timeout = <X>(p: Promise<X>, ms = TIMEOUT_MS) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

// Each call opens a relay connection, so keep one person from hammering it (per server instance).
const hits = new Map<string, number[]>();
export function throttle(pk: string, max = 20) {
  const now = Date.now(), recent = (hits.get(pk) || []).filter((t) => now - t < 60_000);
  if (recent.length >= max) throw new Error("Too many wallet requests. Wait a minute and try again.");
  recent.push(now); hits.set(pk, recent);
}

export const allowSpendingLinks = () => process.env.ALLOW_SPENDING_WALLET_LINKS === "1"; // sandbox/testing only

export async function connectWallet(pk: string, link: string) {
  throttle(pk, 6);
  try { NWCClient.parseWalletConnectUrl(link); } catch { throw new Error("That does not look like a Nostr Wallet Connect link. It starts with nostr+walletconnect://"); }
  const c = new NWCClient({ nostrWalletConnectUrl: link });
  try {
    let info;
    try { info = await timeout(c.getInfo()); } catch { throw new Error(friendly); }
    const methods = (info.methods || []) as string[];
    if (!methods.includes("get_balance")) throw new Error("This connection does not allow reading the balance. Create a new connection with the \"read balance\" permission.");
    const spends = canSpend(methods);
    if (spends && !allowSpendingLinks())
      throw new Error("This connection can also SEND payments, so we will not store it. For your safety, create a new connection in your wallet that only allows reading your balance, reading transactions and creating invoices.");
    const lud16 = info.lud16 || new URL(link.replace("nostr+walletconnect://", "http://x/")).searchParams.get("lud16") || null;
    await run(`INSERT INTO wallet_links (pubkey,nwc_enc,lud16,alias,methods,can_send,created_at) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(pubkey) DO UPDATE SET nwc_enc=EXCLUDED.nwc_enc, lud16=EXCLUDED.lud16, alias=EXCLUDED.alias, methods=EXCLUDED.methods, can_send=EXCLUDED.can_send, created_at=EXCLUDED.created_at`,
      pk, encrypt(link), lud16, String(info.alias || "").slice(0, 60) || null, methods.join(","), spends ? 1 : 0, Math.floor(Date.now() / 1000));
    await run("UPDATE payouts SET status='pending', sending=0, error=NULL, release_at=? WHERE worker=? AND status='failed' AND error LIKE 'address:%'", Math.floor(Date.now() / 1000), pk);
    return { connected: true, alias: info.alias || null, lud16, canSend: spends, canInvoice: methods.includes("make_invoice"), canList: methods.includes("list_transactions") };
  } finally { c.close(); }
}

export async function walletStatus(pk: string) {
  const r = await get("SELECT lud16, alias, methods, can_send FROM wallet_links WHERE pubkey=?", pk);
  const sandbox = allowSpendingLinks();
  if (!r) return { connected: false, sandbox };
  const m = String(r.methods).split(",");
  return { connected: true, sandbox, alias: r.alias, lud16: r.lud16, canSend: !!r.can_send, canInvoice: m.includes("make_invoice"), canList: m.includes("list_transactions") };
}

export const disconnectWallet = (pk: string) => run("DELETE FROM wallet_links WHERE pubkey=?", pk);

async function withClient<T>(pk: string, fn: (c: NWCClient, methods: string[]) => Promise<T>): Promise<T> {
  throttle(pk);
  const r = await get("SELECT nwc_enc, methods FROM wallet_links WHERE pubkey=?", pk);
  if (!r) throw new Error("No wallet connected yet.");
  const c = new NWCClient({ nostrWalletConnectUrl: decrypt(r.nwc_enc) });
  try { return await fn(c, String(r.methods).split(",")); } finally { c.close(); }
}

export const liveWallet = (pk: string) => withClient(pk, async (c, methods) => {
  let balance: number;
  try { balance = Math.floor((await timeout(c.getBalance())).balance / 1000); } catch { throw new Error(friendly); }
  let transactions: { type: string; state: string; sats: number; description: string; at: number }[] = [];
  if (methods.includes("list_transactions")) {
    try {
      const t = await timeout(c.listTransactions({ limit: 8 }));
      transactions = (t.transactions || []).map((x) => ({ type: x.type, state: x.state, sats: Math.floor(x.amount / 1000), description: String(x.description || "").slice(0, 80), at: x.settled_at || x.created_at || 0 }))
        .sort((a, b) => b.at - a.at).slice(0, 8);
    } catch { /* the balance is still useful without the list */ }
  }
  return { balance, transactions };
});

export const receiveInvoice = (pk: string, sats: number, memo: string) => withClient(pk, async (c, methods) => {
  if (!methods.includes("make_invoice")) throw new Error("This connection does not allow creating invoices.");
  let inv;
  try { inv = await timeout(c.makeInvoice({ amount: sats * 1000, description: memo || "Sats-for-Data", expiry: 3600 })); } catch { throw new Error(friendly); }
  return { invoice: inv.invoice, sats, expiresAt: inv.expires_at || Math.floor(Date.now() / 1000) + 3600 };
});


// Where a worker's payouts go: their connected wallet (it creates the invoice, so no Lightning address is needed) or a Lightning address.
export async function payoutVia(pk: string): Promise<"wallet" | "address" | null> {
  const r = await get("SELECT methods FROM wallet_links WHERE pubkey=?", pk);
  if (r && String(r.methods).split(",").includes("make_invoice")) return "wallet";
  return (await get("SELECT 1 FROM workers WHERE pubkey=? AND lightning_address IS NOT NULL AND lightning_address<>''", pk)) ? "address" : null;
}

// Ask the worker's own wallet for an invoice of exactly `sats`. Returns null if they have no usable connected wallet.
export async function invoiceFromWorkerWallet(worker: string, sats: number, memo: string): Promise<string | null> {
  const r = await get("SELECT nwc_enc, methods FROM wallet_links WHERE pubkey=?", worker);
  if (!r || !String(r.methods).split(",").includes("make_invoice")) return null;
  const c = new NWCClient({ nostrWalletConnectUrl: decrypt(r.nwc_enc) });
  try {
    const inv = await timeout(c.makeInvoice({ amount: sats * 1000, description: memo.slice(0, 120), expiry: 3600 }));
    if (!inv.invoice || invoiceAmountMsat(inv.invoice) !== sats * 1000) throw new Error("The wallet returned an invoice for a different amount, so nothing was paid");
    return inv.invoice;
  } finally { c.close(); }
}
