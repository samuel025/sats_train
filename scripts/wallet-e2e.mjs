// Worker wallet panel, end to end, against Alby's SANDBOX wallets (needs internet). Run it against two server configs:
//   ALLOW_SPENDING_WALLET_LINKS=1 ...  node --experimental-strip-types --no-warnings scripts/wallet-e2e.mjs allow
//   (unset)                            node --experimental-strip-types --no-warnings scripts/wallet-e2e.mjs refuse
import { finalizeEvent, generateSecretKey } from "nostr-tools";
import { NWCClient } from "@getalby/sdk/nwc";
import { createHash } from "node:crypto";
import { invoiceAmountMsat } from "../src/lib/safe.ts";

const B = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, ""), MODE = process.argv[2] || "allow";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0; const ok = (n, c, d = "") => { if (!c) fails++; console.log(`  ${c ? "✓" : "✗"} ${n}${c ? "" : "  → " + d}`); };
async function call(sk, path, method = "GET", body) {
  const rb = body ? JSON.stringify(body) : "", tags = [["u", B + path], ["method", method]]; if (rb) tags.push(["payload", createHash("sha256").update(rb).digest("hex")]);
  const ev = finalizeEvent({ kind: 27235, created_at: Math.floor(Date.now() / 1000), tags, content: "" }, sk);
  return (await fetch(B + path, { method, body: rb || undefined, headers: { authorization: "Nostr " + Buffer.from(JSON.stringify(ev)).toString("base64"), "content-type": "application/json" } })).json();
}
const faucet = async (balance) => (await (await fetch(`https://faucet.nwc.dev?balance=${balance}`, { method: "POST" })).text()).trim();

const W = generateSecretKey(), OTHER = generateSecretKey();
console.log(`Wallet panel (${MODE} mode) against ${B}\n`);
const A = await faucet(2000);

console.log("Connecting");
ok("not connected at first", (await call(W, "/api/wallet/link")).connected === false);
ok("unauthenticated requests are refused", (await fetch(B + "/api/wallet/live")).status >= 400);
ok("a malformed link is refused", /does not look like/.test((await call(W, "/api/wallet/link", "POST", { nwc: "hello" })).error || ""));
ok("an invalid amount is refused", !!(await call(W, "/api/wallet/invoice", "POST", { sats: 0 })).error);
ok("no wallet means no balance", /No wallet/.test((await call(W, "/api/wallet/live")).error || ""));

const conn = await call(W, "/api/wallet/link", "POST", { nwc: A });
if (MODE === "refuse") {
  ok("a link that can SEND payments is refused (production default)", /SEND payments/.test(conn.error || ""), JSON.stringify(conn));
  ok("and nothing was stored", (await call(W, "/api/wallet/link")).connected === false);
} else {
  ok("a wallet link connects", conn.connected === true, JSON.stringify(conn));
  ok("it is flagged when the link can also send", conn.canSend === true);
  ok("the wallet's Lightning address is picked up", /@/.test(conn.lud16 || ""));
  const st = await call(W, "/api/wallet/link"); ok("status shows connected", st.connected === true && st.sandbox === true);

  console.log("Balance and receiving");
  const live = await call(W, "/api/wallet/live");
  ok("live balance matches the wallet", live.balance === 2000, JSON.stringify(live).slice(0, 120));
  ok("recent transactions are listed", Array.isArray(live.transactions));
  const inv = await call(W, "/api/wallet/invoice", "POST", { sats: 150, memo: "e2e test" });
  ok("an invoice is created", /^ln/i.test(inv.invoice || ""), JSON.stringify(inv));
  ok("the invoice is for exactly the requested amount", invoiceAmountMsat(inv.invoice) === 150_000);
  ok("amounts above the limit are refused", !!(await call(W, "/api/wallet/invoice", "POST", { sats: 2_000_000 })).error);

  const payer = new NWCClient({ nostrWalletConnectUrl: await faucet(500) });   // a DIFFERENT wallet pays the invoice
  try { await payer.payInvoice({ invoice: inv.invoice }); } finally { payer.close(); }
  let after; for (let i = 0; i < 8; i++) { after = await call(W, "/api/wallet/live"); if (after.balance === 2150) break; await sleep(1500); }
  ok("the balance rises when the invoice is paid", after.balance === 2150, `balance ${after.balance}`);
  ok("the payment appears in the transaction list", after.transactions.some((t) => t.type === "incoming" && t.sats === 150), JSON.stringify(after.transactions).slice(0, 160));

  console.log("Privacy and disconnecting");
  ok("another account cannot see this wallet", /No wallet/.test((await call(OTHER, "/api/wallet/live")).error || ""));
  ok("disconnecting works", (await call(W, "/api/wallet/link", "POST", { action: "disconnect" })).connected === false);
  ok("and the balance is no longer readable", /No wallet/.test((await call(W, "/api/wallet/live")).error || ""));
}
console.log(`\n${fails ? fails + " check(s) FAILED" : "All checks passed"}`); process.exit(fails ? 1 : 0);
