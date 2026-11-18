"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/client";
import { Naira } from "@/components/Naira";
import { WalletPanel } from "@/components/WalletPanel";

export default function Wallet() {
  const [w, setW] = useState<any>(null);
  const [resume, setResume] = useState<Record<string, string>>({}); const [rmsg, setRmsg] = useState("");
  const dirty = useRef(false); // true once the person has typed, so the 5-second refresh never overwrites their input
  const [addr, setAddr] = useState(""); const [msg, setMsg] = useState(""); const [prov, setProv] = useState("");
  const [nowS, setNowS] = useState(Math.floor(Date.now() / 1000)); // ticks every second for the hold countdown
  const [toast, setToast] = useState(""); const seen = useRef<Record<string, string> | null>(null);
  const [fund, setFund] = useState<Record<string, any>>({});
  useEffect(() => { const t = setInterval(() => setNowS(Math.floor(Date.now() / 1000)), 1000); return () => clearInterval(t); }, []);
  const load = () => authedFetch("/api/wallet").then((x) => {
    setW(x); if (!dirty.current) setAddr(x.address);
    // a "+N sats received" toast when a payout flips to paid while the page is open
    const prev = seen.current, next: Record<string, string> = {};
    for (const p of x.payouts) { next[p.id] = p.status; if (prev && prev[p.id] && prev[p.id] !== "paid" && p.status === "paid") { setToast(`+${p.sats.toLocaleString()} sats received · ${p.title}`); setTimeout(() => setToast(""), 6000); } }
    seen.current = next;
  });
  async function checkFunding(id: string) { setFund((f) => ({ ...f, [id]: "loading" })); try { const r = await authedFetch(`/api/tasks/${id}/funding`); setFund((f) => ({ ...f, [id]: r })); } catch (e: any) { setFund((f) => ({ ...f, [id]: { error: e.message } })); } }
  useEffect(() => { load().catch((e) => setMsg(e.message)); const t = setInterval(() => load().catch(() => {}), 5000); return () => clearInterval(t); }, []);

  async function save() { setMsg("Checking address…"); try { const r = await authedFetch("/api/wallet", { body: { address: addr } }); setMsg(r.retried ? `Saved ✓ ${r.retried} held payment(s) will be retried.` : "Saved ✓"); dirty.current = false; load(); } catch (e: any) { setMsg(e.message); } }
  async function useWalletAddress(a: string) { try { await authedFetch("/api/wallet", { body: { address: a } }); setMsg("Payout address set ✓"); dirty.current = false; load(); } catch (e: any) { setMsg(e.message); } }
  async function testAddr() { setMsg("Checking address…"); try { const r = await authedFetch("/api/wallet/test", { body: { address: addr } }); setMsg(r.ok ? `This address works ✓ (accepts ${r.min}–${r.max.toLocaleString()} sats)` : r.error); } catch (e: any) { setMsg(e.message); } }
  async function resumeTask(id: string) { setRmsg("Checking wallet link…"); try { const r = await authedFetch(`/api/tasks/${id}/resume`, { body: { nwc: resume[id] || "" } }); setRmsg(`Task resumed ✓${r.balance !== null ? ` Wallet balance: ${r.balance} sats.` : ""}${r.retried ? ` ${r.retried} failed payment(s) are being retried.` : ""}`); load(); } catch (e: any) { setRmsg(e.message); } }
  async function download(id: string, format: string) {
    const r = await authedFetch(`/api/export/${id}?format=${format}&attest=1`, { raw: true }) as Response;
    const ev = r.headers.get("x-nostr-event");
    setProv(`Dataset sha256 ${r.headers.get("x-dataset-sha256")}${ev ? ` · pinned on Nostr in signed event ${ev}` : ""}`);
    const a = document.createElement("a"); a.href = URL.createObjectURL(await r.blob()); a.download = `dataset-${id.slice(0, 8)}.${format === "csv" ? "csv" : format === "zip" ? "zip" : "jsonl"}`; a.click();
  }
  useEffect(() => { if (w && location.hash === "#payaddr") document.getElementById("payaddr")?.focus(); }, [!!w]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!w) return <p className="muted">{msg || "Loading…"}</p>;
  const waiting = w.payouts.filter((p: any) => p.status === "pending").reduce((n: number, p: any) => n + p.sats, 0);
  const addressFailed = w.payouts.some((p: any) => p.status === "failed" && String(p.error || "").startsWith("address:"));
  const steps = [
    { done: !!w.payoutVia, title: "Choose where to get paid", why: "Connect your wallet below (no address needed), or add a Lightning address.", action: <button className="btn sm" onClick={() => document.getElementById("wallet-panel")?.scrollIntoView({ behavior: "smooth", block: "center" })}>Connect wallet</button> },
    { done: w.reputation.accepted > 0 || w.total > 0, title: "Complete your first task", why: "Answer one item and get paid.", action: <Link className="btn sm secondary" href="/tasks">Find a task</Link> },
    { done: w.reputation.qualified.length > 0, title: "Pass a language test", why: "Unlocks verification work and better-paid tasks (optional).", action: <Link className="btn sm secondary" href="/qualify">Take a test</Link> },
  ];
  const left = steps.filter((x) => !x.done), doneCount = steps.length - left.length;
  return (
    <div className="narrow">
      {toast && <div className="toast-ok" role="status">{toast}</div>}
      <div className="tag">Wallet</div>
      <h1>Your wallet</h1>
      {!w.payoutVia && waiting > 0 && <div className="banner"><div><b>{waiting.toLocaleString()} sats are waiting for you.</b> Connect your wallet or add a wallet address below and they are sent automatically.</div></div>}
      {addressFailed && <div className="banner"><div><b>A payout could not be sent.</b> Check that your wallet address below is correct, then press Save. Held payments are retried.</div></div>}
      <section className="sum">
        <div className="lab">Earned on Sats-for-Data</div>
        <div className="amt">{w.total.toLocaleString()}<small>sats</small></div>
        <div className="ngn"><Naira sats={w.total} className="" /></div>
        <div className="meter" aria-hidden><i style={{ width: `${Math.min(100, (w.today / w.cap) * 100)}%` }} /></div>
        <div className="cap">{w.today.toLocaleString()} of {w.cap.toLocaleString()} sats paid in the last 24 hours (daily limit)</div>
      </section>

      {left.length > 0 && !(w.myTasks.length > 0 && w.reputation.attempts === 0) && ( // requesters who only post tasks do not need the worker checklist
        <section className="card todo">
          <div className="sec-head"><h3>Get started</h3><span className="muted small">{doneCount} of {steps.length} done</span></div>
          {steps.map((x, i) => (
            <div key={i} className={`todo-row ${x.done ? "done" : ""}`}>
              <span className="todo-ic" aria-hidden>{x.done ? "✓" : i + 1}</span>
              <div className="todo-tx"><b>{x.title}</b><span>{x.done ? "Done" : x.why}</span></div>
              {!x.done && left[0] === x ? x.action : null}
            </div>))}
        </section>
      )}

      <section className="card">
        <div className="sec-head"><h3>Where your sats go</h3>{w.payoutVia === "wallet" ? <span className="pill paid">✓ via your wallet</span> : w.address && !dirty.current ? <span className="pill paid">✓ address saved</span> : null}</div>
        <label htmlFor="payaddr">{w.payoutVia === "wallet" ? "Backup wallet address (optional)" : "Wallet address (a Lightning address)"}</label>
        <input id="payaddr" value={addr} onChange={(e) => { dirty.current = true; setAddr(e.target.value); }} placeholder="you@walletofsatoshi.com" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <div className="row" style={{ gap: 8 }}><button className="btn inline" onClick={save}>Save address</button><button className="btn inline secondary" onClick={testAddr}>Test address</button></div>
        {msg && <p className="muted small" style={{ margin: "6px 0 0" }}>{msg}</p>}
        <p className="hint" style={{ margin: "8px 0 0" }}>No wallet address yet? <Link href="/wallet-help">See how to get one</Link>.</p>
      </section>

      <WalletPanel savedAddress={w.address} onUseAddress={useWalletAddress} onChange={() => load().catch(() => {})} />

      <section className="card">
        <div className="sec-head"><h3>Your reputation</h3><span className="pill">{w.reputation.level}</span></div>
        <div className="row" style={{ marginTop: 6 }}>
          <div className="stat sm"><b>{w.reputation.score}</b><span>Score</span></div>
          <div className="stat sm"><b>{w.reputation.acceptRate}%</b><span>Accepted ({w.reputation.accepted}/{w.reputation.attempts})</span></div>
          {w.reputation.hiddenCheckRate !== null && <div className="stat sm"><b>{w.reputation.hiddenCheckRate}%</b><span>Quality checks</span></div>}
        </div>
        <p className="hint" style={{ margin: "10px 0 0" }}>{w.reputation.level === "Trusted" ? "Top level reached." : `Next level: ${w.reputation.level === "New" ? "5 accepted answers or verifications with a score of 30+" : "20 accepted with a score of 70+"}.`} {w.reputation.qualified.length ? <>Qualified: {w.reputation.qualified.join(", ")}.</> : <><Link href="/qualify">Take a language test</Link> to unlock verification work.</>} It follows your account key.</p>
      </section>
      <h2>Payouts</h2>
      {w.payouts.length === 0 && <p className="muted">Nothing yet. <Link href="/tasks">Find a task</Link></p>}
      {w.payouts.length > 0 && <div className="card list">{w.payouts.map((p: any) => {
        const left = (p.release_at || 0) - nowS;
        const st = p.status === "paid" ? { step: 3, label: p.via === "wallet" ? "Paid into your wallet" : "Paid", tone: "paid" }
          : p.status === "pending" ? (left > 0 ? { step: 1, label: `Held for ${left}s (anti-abuse check)`, tone: "" } : !w.payoutVia ? { step: 1, label: "Waiting for you to choose where to get paid", tone: "bad" } : p.sending ? { step: 2, label: "Sending…", tone: "" } : { step: 2, label: "Releasing…", tone: "" })
          : { step: 0, label: p.status === "withheld" ? "Withheld" : "Failed", tone: "bad" };
        return (
          <div key={p.id} className="item" style={{ display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <b style={{ color: "var(--navy)", fontWeight: 500 }}>{p.title}</b>
              <span className="mono" style={{ fontSize: 14, color: p.status === "paid" ? "var(--ink)" : "var(--ash)" }}>{p.status === "paid" ? "+" : ""}{p.sats} sats</span>
            </div>
            <div className={`trk ${st.tone}`}>{[1, 2, 3].map((n) => <i key={n} className={st.step >= n ? "on" : ""} />)}</div>
            <div className="trk-l"><span className={st.tone === "bad" ? "err" : ""}>{st.label}</span>{p.error && <span className="err">{String(p.error).replace(/^(address|funding): /, "")}</span>}</div>
          </div>);
      })}</div>}
      {w.myTasks.length > 0 && <h2>Tasks you posted</h2>}
      {prov && <p className="hint mono" style={{ wordBreak: "break-all" }}>{prov}</p>}
      {rmsg && <p className="hint">{rmsg}</p>}
      {w.myTasks.map((t: any) => (
        <div key={t.id} className="card">
          {t.status === "paused" && <div className="warn"><b>Paused: payments are failing.</b> {t.pause_reason}
            <input placeholder="New nostr+walletconnect:// link (leave empty to retry the current one)" value={resume[t.id] || ""} onChange={(e) => setResume({ ...resume, [t.id]: e.target.value })} />
            <button className="btn sm" onClick={() => resumeTask(t.id)}>Resume task</button></div>}<h3><Link href={`/task/${t.id}`} style={{ textDecoration: "none" }}>{t.title}</Link></h3><div className="muted small">{t.paid} paid answers · {t.items} items</div>
          <div style={{ margin: "10px 0 4px" }}>
            <button className="btn sm secondary" onClick={() => checkFunding(t.id)} disabled={fund[t.id] === "loading"}>{fund[t.id] === "loading" ? "Checking…" : fund[t.id] ? "Check funding again" : "Check funding"}</button>
            {fund[t.id] && fund[t.id] !== "loading" && (fund[t.id].error ? <p className="err" style={{ margin: "8px 0 0" }}>{fund[t.id].error}</p> : (() => { const f = fund[t.id]; return (
              <div className="fund">
                <div className="fund-row"><span>May still pay</span><b>{f.needed.toLocaleString()} sats <Naira sats={f.needed} /></b></div>
                <div className="muted small" style={{ margin: "-2px 0 6px" }}>{f.heldSats.toLocaleString()} held + {f.remainingSats.toLocaleString()} for answers still to come</div>
                {f.simulated ? <div className="muted small">Simulated payments: nothing to fund.</div> : <>
                  {f.balance !== null && <div className="fund-row"><span>Wallet balance</span><b>{f.balance.toLocaleString()} sats</b></div>}
                  {f.budget && <><div className="fund-row"><span>Spending cap left</span><b>{f.budget.left.toLocaleString()} of {f.budget.total.toLocaleString()} sats</b></div>
                    <div className="meter fm" aria-hidden><i style={{ width: `${Math.round(((f.budget.total - f.budget.left) / f.budget.total) * 100)}%` }} /></div></>}
                  {f.funded ? <span className="pill paid">✓ Funded for the whole task</span>
                    : <div className="warn" style={{ margin: "8px 0 0" }}><b>Short by about {f.short.toLocaleString()} sats.</b> {f.limitedBy === "cap" ? "Raise the spending cap on your wallet link" : "Add sats to your wallet"} before workers finish, or this task will pause.</div>}
                </>}
              </div>); })())}
          </div>
          <div className="row">{t.kind === "speak" ? <button className="btn secondary" onClick={() => download(t.id, "zip")}>Export ZIP (audio + JSONL)</button> : t.kind === "rank" ? <button className="btn secondary" onClick={() => download(t.id, "jsonl")}>Export preferences (JSONL)</button> : <><button className="btn secondary" onClick={() => download(t.id, "jsonl")}>Export JSONL</button><button className="btn secondary" onClick={() => download(t.id, "csv")}>Export CSV</button></>}</div></div>
      ))}
    </div>
  );
}
