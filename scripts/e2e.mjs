// End-to-end test against a running server in simulated-payment mode (MOCK_PAYMENTS=1).
//   docker compose up --build      (starts the app + Postgres with the right settings)
//   npm run test:e2e               (BASE_URL defaults to http://localhost:3000)
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools";
import { createHash, randomUUID } from "node:crypto";

const B = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, skipped = 0;
const ok = (name, cond, detail = "") => { if (!cond) fails++; console.log(`  ${cond ? "✓" : "✗"} ${name}${cond ? "" : "  → " + detail}`); };
const skip = (name, why) => { skipped++; console.log(`  - ${name} (skipped: ${why})`); };

function signed(sk, path, method, rawBody = "", over = {}) {
  const tags = [["u", B + path], ["method", method]];
  if (rawBody) tags.push(["payload", createHash("sha256").update(rawBody).digest("hex")]);
  return finalizeEvent({ kind: 27235, created_at: Math.floor(Date.now() / 1000), tags: over.tags || tags, content: "", ...over.fields }, sk);
}
async function raw(sk, path, method = "GET", body, over) {
  const rb = body ? JSON.stringify(body) : "";
  const ev = signed(sk, path, method, rb, over);
  return fetch(B + path, { method, body: rb || undefined, headers: { authorization: "Nostr " + Buffer.from(JSON.stringify(ev)).toString("base64"), "content-type": "application/json" } });
}
const call = async (sk, path, method = "GET", body) => { const r = await raw(sk, path, method, body); const t = await r.text(); try { return JSON.parse(t); } catch { return { _text: t, _status: r.status }; } };
const mkTask = async (sk, b, ownerSk = sk) => {
  const id = randomUUID();
  const event = finalizeEvent({ kind: 30078, created_at: Math.floor(Date.now() / 1000), tags: [["d", `sats-for-data:${id}`]], content: "{}" }, ownerSk);
  const r = await call(sk, "/api/tasks", "POST", { id, event, nwc: "demo", ...b });
  return { id, r };
};
const answerAfterServe = async (sk, taskId, payload) => {
  const n = await call(sk, `/api/tasks/${taskId}`);
  if (!n.item) return { n };
  await sleep(1300); // the server rejects answers faster than a person could read the item
  return { n, s: await call(sk, "/api/submit", "POST", { itemId: n.item.id, ...(typeof payload === "function" ? payload(n.item) : payload) }) };
};

try { await fetch(B + "/api/tasks"); } catch { console.error(`\nCannot reach ${B}. Start the app first:  docker compose up --build\n`); process.exit(2); }
console.log(`Testing ${B}\n`);

const R = generateSecretKey(), W1 = generateSecretKey(), W2 = generateSecretKey(), W3 = generateSecretKey();

console.log("Basics");
const tasks = await (await fetch(B + "/api/tasks")).json();
ok("demo tasks are seeded", Array.isArray(tasks) && tasks.length >= 5, `got ${tasks.length}`);
ok("all task types are present", ["translate", "speak", "rank", "classify"].every((k) => tasks.some((t) => t.kind === k)));
const home = await fetch(B + "/");
ok("security headers are set", !!home.headers.get("content-security-policy") && home.headers.get("x-content-type-options") === "nosniff" && home.headers.get("x-frame-options") === "DENY");
const rate = await (await fetch(B + "/api/rate?cur=NGN")).json();
ok("naira rate is available", rate.perBtc > 0, JSON.stringify(rate));

console.log("Authentication");
ok("no credentials are refused", (await fetch(B + "/api/wallet")).status >= 400);
ok("a stale signed request is refused", (await (await raw(W1, "/api/wallet", "GET", null, { fields: { created_at: Math.floor(Date.now() / 1000) - 600 } })).json()).error?.includes("expired"));
ok("a request signed for another URL is refused", (await (await raw(W1, "/api/wallet", "GET", null, { tags: [["u", B + "/api/other"], ["method", "GET"]] })).json()).error?.includes("URL"));
// signed for one body, sent with another: the payload hash in the signature must catch it
const signedForA = signed(W1, "/api/wallet", "POST", JSON.stringify({ address: "a@example.com" }));
const tampered = await fetch(B + "/api/wallet", { method: "POST", body: JSON.stringify({ address: "evil@example.com" }),
  headers: { authorization: "Nostr " + Buffer.from(JSON.stringify(signedForA)).toString("base64"), "content-type": "application/json" } });
ok("a tampered body is refused", (await tampered.json()).error?.includes("Payload"));
ok("a valid request works", (await call(W1, "/api/wallet")).pubkey === getPublicKey(W1));

console.log("Posting tasks");
const forged = await mkTask(R, { title: "Forged", reward: 10, items: [{ prompt: "x" }] }, W3);
ok("a task event signed by someone else is refused", !!forged.r.error, JSON.stringify(forged.r));
ok("over-long titles are refused", !!(await mkTask(R, { title: "t".repeat(200), reward: 10, items: [{ prompt: "x" }] })).r.error);
ok("unsupported languages are refused", !!(await mkTask(R, { title: "L", dst: "Klingon", reward: 10, items: [{ prompt: "x" }] })).r.error);
ok("absurd rewards are refused", !!(await mkTask(R, { title: "R", reward: 99999999, items: [{ prompt: "x" }] })).r.error);

console.log("Translation task: anti-abuse and grading");
await call(W1, "/api/wallet", "POST", { address: "worker1@example.com" });
const tr = await mkTask(R, { title: "E2E translate", kind: "translate", src: "English", dst: "Nigerian Pidgin", reward: 50, answersPerItem: 1,
  items: [{ prompt: "How are you today?" }, { prompt: "Where is the market?" }], checks: [{ prompt: "Good morning", answer: "Good morning" }] });
ok("task is created", !!tr.r.id, JSON.stringify(tr.r));
const t0 = Date.now();
const fast = await call(W1, `/api/tasks/${tr.id}`).then(async (n) => call(W1, "/api/submit", "POST", { itemId: n.item.id, answer: "quick answer" }));
if (/too fast/i.test(fast.reason || "")) ok("answers faster than a person could read are rejected", true);
else if (Date.now() - t0 > 2000) skip("answers faster than a person could read are rejected", "this server is too slow to submit within the minimum answer time");
else ok("answers faster than a person could read are rejected", false, JSON.stringify(fast));
await sleep(1300);
const copy = await call(W1, "/api/submit", "POST", { itemId: (await call(W1, `/api/tasks/${tr.id}`)).item.id, answer: "" });
ok("blank answers are rejected", copy.pass === false || !!copy.error, JSON.stringify(copy));
const own = await call(R, "/api/submit", "POST", { itemId: (await call(R, `/api/tasks/${tr.id}`)).item?.id || "x", answer: "my own task" });
ok("requesters cannot answer their own task", !!own.error);
// The task also contains a hidden check item (shuffled in), so answer every prompt it can serve correctly.
const GOOD = { "How are you today?": "How you dey today?", "Where is the market?": "Where market dey?", "Good morning": "Good morning" };
const real = await answerAfterServe(W2, tr.id, (item) => ({ answer: GOOD[item.prompt] }));
if (real.s && /unavailable/i.test(real.s.reason || "")) skip("a good answer is accepted", "grader unavailable (LLM)");
else ok("a good answer is accepted and a payout is queued", real.s?.pass === true && real.s.payment?.status === "pending", JSON.stringify(real.s));

console.log("Ranking task: votes, hidden checks, payouts");
await call(W2, "/api/wallet", "POST", { address: "worker2@example.com" });
await call(W3, "/api/wallet", "POST", { address: "worker3@example.com" });
const rk = await mkTask(R, { title: "E2E rank", kind: "rank", dst: "Nigerian Pidgin", reward: 20, answersPerItem: 2,
  items: [{ prompt: "Q1", a: "Good reply", b: "Bad reply" }, { prompt: "Q2", a: "Reply A", b: "Reply B" }], checks: [{ prompt: "Gold", a: "Right", b: "Wrong", answer: "A" }] });
// Workers see the two replies in a per-worker order, so pick by the reply's text, not its position.
const A_TEXT = { Q1: "Good reply", Q2: "Reply A", Gold: "Right" }, B_TEXT = { Q1: "Bad reply", Q2: "Reply B", Gold: "Wrong" };
const choose = (item, side) => String(item.options.indexOf((side === "A" ? A_TEXT : B_TEXT)[item.prompt]) + 1);
const run = async (sk, sideFor) => { const out = []; for (let i = 0; i < 4; i++) { const x = await answerAfterServe(sk, rk.id, (item) => ({ choice: choose(item, sideFor(item.prompt)) })); if (!x.s) break; out.push({ q: x.n.item.prompt, pass: x.s.pass }); } return out; };
const w2 = await run(W2, () => "A");                                  // always picks the better reply
const w3 = await run(W3, (q) => (q === "Gold" ? "B" : "A"));          // fails the hidden check
ok("a worker who answers well completes every item", w2.length === 3 && w2.every((x) => x.pass), JSON.stringify(w2));
ok("failing the hidden check item is detected", w3.find((x) => x.q === "Gold")?.pass === false && w3.filter((x) => x.q !== "Gold").every((x) => x.pass), JSON.stringify(w3));
ok("an unknown item is refused", !!(await call(W2, "/api/submit", "POST", { itemId: "does-not-exist", choice: "1" })).error);
await sleep(3500); await call(W2, "/api/wallet"); await call(W3, "/api/wallet"); await sleep(1500);
const wal2 = await call(W2, "/api/wallet"), wal3 = await call(W3, "/api/wallet");
const paid = (w) => w.payouts.filter((p) => p.status === "paid").reduce((n, p) => n + p.sats, 0);
ok("held payouts are released after the cooldown", wal2.payouts.some((p) => p.status === "paid"), JSON.stringify(wal2.payouts.map((p) => p.status)));
ok("earnings total matches paid payouts", wal2.total === paid(wal2));
ok("the worker who failed the hidden check earns less", paid(wal3) < paid(wal2), `${paid(wal3)} vs ${paid(wal2)}`);
ok("reputation is tracked", wal2.reputation.accepted > 0);
ok("reputation is public by key", (await (await fetch(B + "/api/reputation/" + getPublicKey(W2))).json()).accepted > 0);
ok("malformed reputation keys are refused", (await fetch(B + "/api/reputation/nope")).status === 400);

console.log("Exports and provenance");
const exW = await raw(W2, `/api/export/${rk.id}`);
ok("only the requester can export", exW.status === 403);
const ex = await raw(R, `/api/export/${rk.id}?attest=1`);
const body = await ex.text(); const rows = body.split("\n").filter(Boolean).map((l) => JSON.parse(l));
ok("export has one row per real item (no hidden checks)", rows.length === 2 && !rows.some((r) => r.prompt === "Gold"), JSON.stringify(rows.map((r) => r.prompt)));
ok("export labels agreement", rows.every((r) => ["consensus", "disputed", "single"].includes(r.confidence)));
ok("export hash matches the content", ex.headers.get("x-dataset-sha256") === createHash("sha256").update(body).digest("hex"));
ok("export is pinned as a signed Nostr event", /^[0-9a-f]{64}$/.test(ex.headers.get("x-nostr-event") || ""));

console.log("Qualification and gating");
const gated = tasks.find((t) => t.require_qual);
const g1 = await call(W3, `/api/tasks/${gated.id}`);
const lang = gated.dst_lang;
ok("a locked task explains why", !!g1.gate || !!g1.item, JSON.stringify(g1).slice(0, 120));
const qs = await call(W3, `/api/qualify?lang=${encodeURIComponent(lang)}`);
ok("test questions never include the answers", qs.questions?.length === 5 && !JSON.stringify(qs).includes('"answer"'));
const wrong = await call(W3, "/api/qualify", "POST", { language: lang, answers: [3, 3, 3, 3, 3] });
ok("wrong answers do not qualify", wrong.passed === false, JSON.stringify(wrong));
const ANSWERS = { "Nigerian Pidgin": [0, 1, 2, 1, 0], Yoruba: [1, 0, 2, 1, 0], Hausa: [2, 1, 0, 2, 1] };
const right = await call(W3, "/api/qualify", "POST", { language: lang, answers: ANSWERS[lang] });
ok("correct answers qualify", right.passed === true, JSON.stringify(right));
ok("a qualified worker can open the locked task", !!(await call(W3, `/api/tasks/${gated.id}`)).item);

console.log("Voice task: consent and validation");
await call(W1, "/api/wallet", "POST", { address: "worker1@example.com" });
const vt = await mkTask(R, { title: "E2E voice", kind: "speak", dst: "Nigerian Pidgin", reward: 100, answersPerItem: 1, license: "Open (CC BY 4.0)", items: [{ prompt: "Wetin you dey do for there?" }] });
const vn = await call(W1, `/api/tasks/${vt.id}`);
ok("consent is required before recording", vn.consent === false && vn.task.license === "Open (CC BY 4.0)");
const wav = Buffer.alloc(60_000); wav.write("RIFF", 0, "ascii");
await sleep(1300);
ok("recordings without consent are refused", /consent/i.test((await call(W1, "/api/submit", "POST", { itemId: vn.item.id, audio: wav.toString("base64"), durationMs: 3000 })).error || ""));
await call(W1, "/api/consent", "POST", {});
ok("not-a-recording uploads are refused", !!(await call(W1, "/api/submit", "POST", { itemId: vn.item.id, audio: Buffer.from("hello").toString("base64"), durationMs: 3000 })).error);
const tooShort = await call(W1, "/api/submit", "POST", { itemId: vn.item.id, audio: wav.toString("base64"), durationMs: 300 });
ok("recordings that are too short are rejected", tooShort.pass === false && /short/i.test(tooShort.reason || ""), JSON.stringify(tooShort));

console.log("Wallet address");
ok("malformed addresses are refused", !!(await call(W1, "/api/wallet", "POST", { address: "not-an-address" })).error);
ok("a valid address is saved", (await call(W1, "/api/wallet", "POST", { address: "someone@example.com" })).ok === true);

console.log(`\n${fails ? fails + " check(s) FAILED" : "All checks passed"}${skipped ? `, ${skipped} skipped` : ""}`);
process.exit(fails ? 1 : 0);
