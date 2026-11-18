// Unit tests for the security-critical pure logic. Run: npm test (Node 22.6+ strips the TypeScript types).
import { isPrivateIp, publicJson, invoiceAmountMsat, canSpend, spendingMethods } from "../src/lib/safe.ts";
import { fold, similarity } from "../src/lib/text.ts";
import { encrypt, decrypt } from "../src/lib/crypto.ts";
import { BANK, PASS_MARK } from "../src/lib/qualify.ts";

let fails = 0;
const ok = (name, cond, detail = "") => { if (!cond) fails++; console.log(`${cond ? "  ✓" : "  ✗"} ${name}${cond ? "" : "  " + detail}`); };
const rejects = async (p) => { try { await p; return null; } catch (e) { return String(e.message); } };

console.log("safe.ts: private address guard");
for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.3.4", "172.31.255.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "224.0.0.1"])
  ok(`blocks ${ip}`, isPrivateIp(ip));
for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "104.18.0.1", "2606:4700:4700::1111"]) ok(`allows ${ip}`, !isPrivateIp(ip));

console.log("safe.ts: publicJson refuses unsafe targets (no network needed)");
for (const [url, why] of [["http://example.com/x", "plain http"], ["https://example.com:8443/x", "custom port"], ["https://user:pw@example.com/x", "credentials"],
  ["https://127.0.0.1/", "loopback IP literal"], ["https://169.254.169.254/latest/meta-data/", "cloud metadata IP"], ["https://[::1]/", "IPv6 loopback literal"], ["https://localhost/", "localhost by name"]])
  ok(`rejects ${why}`, !!(await rejects(publicJson(url, 3000))), url);

console.log("safe.ts: invoice amount parsing");
const amt = (inv, want) => ok(`${inv.slice(0, 12)}… = ${want} msat`, invoiceAmountMsat(inv) === want, `got ${invoiceAmountMsat(inv)}`);
amt("lnbc200n1pabcdef", 20_000);          // 200 nano-BTC = 20 sats
amt("lnbc10u1pabcdef", 1_000_000);        // 1,000 sats
amt("lnbc1m1pabcdef", 100_000_000);       // 100,000 sats
amt("lnbc2500p1pabcdef", 250);            // 0.25 sat
amt("lnbc5000n1pabcdef", 500_000);        // 500 sats
amt("lntb20n1pabcdef", 2_000);            // testnet
ok("zero-amount invoice has no amount", invoiceAmountMsat("lnbc1pabcdefghijk") === null);
ok("garbage has no amount", invoiceAmountMsat("not an invoice") === null && invoiceAmountMsat("") === null);

console.log("safe.ts: wallet-link permissions");
ok("a read-only link is accepted", !canSpend(["get_info", "get_balance", "make_invoice", "lookup_invoice", "list_transactions"]));
for (const m of ["pay_invoice", "pay_keysend", "multi_pay_invoice", "multi_pay_keysend"]) ok(`a link with ${m} is treated as able to spend`, canSpend(["get_balance", m]));
ok("lists exactly the money-moving methods", spendingMethods(["get_balance", "pay_invoice", "make_invoice", "pay_keysend"]).join() === "pay_invoice,pay_keysend");
ok("hold-invoice and budget methods do not move money", !canSpend(["get_balance", "make_hold_invoice", "settle_hold_invoice", "cancel_hold_invoice", "get_budget"]));

console.log("text.ts: tone marks and spelling variants");
ok("folds Yoruba tone marks", fold("Ẹ káàárọ̀") === "e kaaaro", fold("Ẹ káàárọ̀"));
ok("tone-mark variants match", similarity("Ẹ káàárọ̀", "E kaaaro") === 1);
ok("punctuation and case ignored", similarity("Wetin you dey do for there?", "wetin you dey do for there") === 1);
ok("different sentences score low", similarity("How you dey today", "Abeg make we go market") < 0.5);

console.log("crypto.ts: wallet link encryption");
process.env.NODE_ENV = "test"; process.env.APP_SECRET = "unit-test-secret-0123456789";
const blob = encrypt("nostr+walletconnect://abc?secret=xyz");
ok("round trip", decrypt(blob) === "nostr+walletconnect://abc?secret=xyz");
ok("ciphertext hides the secret", !blob.includes("walletconnect") && !blob.includes("xyz"));
ok("random IV: same input encrypts differently", encrypt("a") !== encrypt("a"));
ok("tampering is detected", !!(await rejects((async () => { const [iv, tag, enc] = blob.split("."); decrypt([iv, tag, Buffer.from("tampered").toString("base64")].join(".")); })())));
process.env.NODE_ENV = "production"; delete process.env.APP_SECRET;
ok("production refuses to run without APP_SECRET", !!(await rejects((async () => encrypt("x"))())));
process.env.APP_SECRET = "change-me-to-a-long-random-string";
ok("production refuses the placeholder secret", !!(await rejects((async () => encrypt("x"))())));

console.log("qualify.ts: question bank");
for (const [lang, qs] of Object.entries(BANK)) ok(`${lang}: ${qs.length} questions, valid answers, passable`, qs.length >= PASS_MARK && qs.every((q) => q.options.length >= 3 && q.answer >= 0 && q.answer < q.options.length));

console.log(fails ? `\n${fails} unit test(s) FAILED` : "\nAll unit tests passed");
process.exit(fails ? 1 : 0);
