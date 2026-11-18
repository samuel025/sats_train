// Payout destinations and the requester funding check, against Alby's SANDBOX wallets (needs internet).
// Server: MOCK_PAYMENTS=0 ALLOW_SPENDING_WALLET_LINKS=1 PAYOUT_COOLDOWN_SECS=3 MIN_ANSWER_SECS=1
import { finalizeEvent, generateSecretKey } from "nostr-tools";
import { NWCClient } from "@getalby/sdk/nwc";
import { createHash, randomUUID } from "node:crypto";

const B = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0; const ok = (n, c, d = "") => { if (!c) fails++; console.log(`  ${c ? "✓" : "✗"} ${n}${c ? "" : "  → " + d}`); };
async function call(sk, path, method = "GET", body) {
  const rb = body ? JSON.stringify(body) : "", tags = [["u", B + path], ["method", method]]; if (rb) tags.push(["payload", createHash("sha256").update(rb).digest("hex")]);
  const ev = finalizeEvent({ kind: 27235, created_at: Math.floor(Date.now() / 1000), tags, content: "" }, sk);
  return (await fetch(B + path, { method, body: rb || undefined, headers: { authorization: "Nostr " + Buffer.from(JSON.stringify(ev)).toString("base64"), "content-type": "application/json" } })).json();
}
const faucet = async (b) => { for (let i = 0; i < 4; i++) { try { const t = (await (await fetch(`https://faucet.nwc.dev?balance=${b}`, { method: "POST" })).text()).trim(); if (t.startsWith("nostr+")) return t; } catch {} await sleep(3000); } throw new Error("faucet unavailable"); };
const lud = (n) => new URL(n.replace("nostr+walletconnect://", "http://x/")).searchParams.get("lud16");
const withWallet = async (nwc, fn) => { const c = new NWCClient({ nostrWalletConnectUrl: nwc }); try { return await fn(c); } finally { c.close(); } };
const mkTask = async (sk, b) => { const id = randomUUID(); const event = finalizeEvent({ kind: 30078, created_at: Math.floor(Date.now() / 1000), tags: [["d", `sats-for-data:${id}`]], content: "{}" }, sk); const r = await call(sk, "/api/tasks", "POST", { id, event, ...b }); return { id, r }; };
const A = { Q1: "Good reply 1", Q2: "Good reply 2", Gold: "Right" };
const answer = async (sk, taskId) => { const n = await call(sk, `/api/tasks/${taskId}`); if (!n.item) return null; await sleep(1300);
  const s = await call(sk, "/api/submit", "POST", { itemId: n.item.id, choice: String(n.item.options.indexOf(A[n.item.prompt]) + 1) }); return { prompt: n.item.prompt, s }; };
const payouts = async (sk) => (await call(sk, "/api/wallet")).payouts;

const R = generateSecretKey(), W = generateSecretKey(), OTHER = generateSecretKey();
const rNwc = await faucet(2000), wNwc = await faucet(0);
console.log(`Payout destinations and funding (${B})\n`);

const t = await mkTask(R, { title: "Payout test", kind: "rank", dst: "Nigerian Pidgin", reward: 20, answersPerItem: 1, nwc: rNwc,
  items: [{ prompt: "Q1", a: "Good reply 1", b: "Bad 1" }, { prompt: "Q2", a: "Good reply 2", b: "Bad 2" }], checks: [{ prompt: "Gold", a: "Right", b: "Wrong", answer: "A" }] });
ok("the task is created", !!t.r.id, JSON.stringify(t.r));

console.log("A worker with nowhere to be paid");
const s0 = await call(W, "/api/me/setup"); ok("setup says they cannot be paid yet", s0.hasPayout === false);
const first = await answer(W, t.id);
ok("their answer is accepted and the payout is queued", first.s.pass === true && first.s.payment?.status === "pending", JSON.stringify(first.s));
await sleep(6000); const held = (await payouts(W))[0];
ok("the payout stays held (no address, no wallet)", held.status === "pending", held.status);
ok("the wallet reports no payout destination", (await call(W, "/api/wallet")).payoutVia === null);

console.log("Connecting a wallet is enough: no Lightning address needed");
const conn = await call(W, "/api/wallet/link", "POST", { nwc: wNwc }); ok("the wallet connects", conn.connected === true, JSON.stringify(conn));
ok("payouts now go to the connected wallet", (await call(W, "/api/wallet")).payoutVia === "wallet");
ok("setup says they can be paid", (await call(W, "/api/me/setup")).hasPayout === true);
let p; for (let i = 0; i < 14; i++) { p = (await payouts(W))[0]; if (p.status === "paid") break; await sleep(3000); }
ok("the held payout is released and paid", p.status === "paid", JSON.stringify(p));
ok("it was delivered into the wallet (no address)", p.via === "wallet");
await sleep(2500);
const bal = await withWallet(wNwc, async (c) => Math.floor((await c.getBalance()).balance / 1000));
ok("the worker's wallet balance rose by exactly the reward", bal === 20, `balance ${bal}`);
const txs = await withWallet(wNwc, (c) => c.listTransactions({ limit: 5 }));
ok("the wallet shows where it came from", txs.transactions.some((x) => /Sats-for-Data: Payout test/.test(x.description || "")), JSON.stringify(txs.transactions.map((x) => x.description)));

console.log("Falling back to a Lightning address");
await call(W, "/api/wallet/link", "POST", { action: "disconnect" });
ok("after disconnecting there is no destination again", (await call(W, "/api/wallet")).payoutVia === null);
const sv = await call(W, "/api/wallet", "POST", { address: lud(wNwc) }); ok("a Lightning address is saved", sv.ok === true, JSON.stringify(sv));
ok("payouts now go to the address", (await call(W, "/api/wallet")).payoutVia === "address");
const second = await answer(W, t.id); ok("another answer is accepted", second?.s.pass === true, JSON.stringify(second));
let p2; for (let i = 0; i < 14; i++) { p2 = (await payouts(W)).find((x) => x.title === "Payout test" && x.status !== "paid" ? true : false) || (await payouts(W))[0]; if ((await payouts(W)).filter((x) => x.status === "paid").length >= 2) break; await sleep(3000); }
const paid2 = (await payouts(W)).filter((x) => x.status === "paid");
ok("it is paid to the address", paid2.length >= 2 && paid2.some((x) => x.via === "address"), JSON.stringify(paid2.map((x) => x.via)));

console.log("Requester funding check");
const f = await call(R, `/api/tasks/${t.id}/funding`);
ok("it reports what the task may still pay", typeof f.needed === "number" && f.needed >= 0, JSON.stringify(f));
ok("the wallet balance is shown", typeof f.balance === "number" && f.balance <= 2000 - 40 + 1, JSON.stringify(f));
ok("a well-funded task is reported as funded", f.funded === true, JSON.stringify(f));
ok("only the requester can check funding", /Not your task/.test((await call(OTHER, `/api/tasks/${t.id}/funding`)).error || ""));
const big = await mkTask(R, { title: "Too big", kind: "rank", dst: "Yoruba", reward: 10000, answersPerItem: 3, nwc: rNwc, items: [1, 2, 3, 4, 5].map((n) => ({ prompt: "P" + n, a: "A" + n, b: "B" + n })) });
const fb = await call(R, `/api/tasks/${big.id}/funding`);
ok("an underfunded task is flagged", fb.funded === false && fb.short > 0, JSON.stringify(fb));
ok("the shortfall is plausible", fb.needed === 5 * 3 * 10000 && fb.short >= fb.needed - 2000, JSON.stringify(fb));

console.log(`\n${fails ? fails + " check(s) FAILED" : "All checks passed"}`); process.exit(fails ? 1 : 0);
