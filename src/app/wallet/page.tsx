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
  const load = () => authedFetch("/api/wallet").then((x) => { setW(x); if (!dirty.current) setAddr(x.address); });
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
    { done: !!w.address, title: "Add your wallet address", why: "Required to receive your sats.", action: <button className="btn sm" onClick={() => document.getElementById("payaddr")?.focus()}>Add address</button> },
    { done: w.reputation.accepted > 0 || w.total > 0, title: "Complete your first task", why: "Answer one item and get paid.", action: <Link className="btn sm secondary" href="/tasks">Find a task</Link> },
    { done: w.reputation.qualified.length > 0, title: "Pass a language test", why: "Unlocks verification work and better-paid tasks (optional).", action: <Link className="btn sm secondary" href="/qualify">Take a test</Link> },
  ];
  const left = steps.filter((x) => !x.done), doneCount = steps.length - left.length;
  return (
    <div className="narrow">
      <div className="tag">Wallet</div>
      <h1>Your wallet</h1>
      {!w.address && waiting > 0 && <div className="banner"><div><b>{waiting.toLocaleString()} sats are waiting for you.</b> Add a wallet address below and they are sent automatically.</div></div>}
      {addressFailed && <div className="banner"><div><b>A payout could not be sent.</b> Check that your wallet address below is correct, then press Save. Held payments are retried.</div></div>}
      <section className="sum">
        <div className="lab">Earned on Sats-for-Data</div>
        <div className="amt">{w.total.toLocaleString()}<small>sats</small></div>
        <div className="ngn"><Naira sats={w.total} className="" /></div>
        <div className="meter" aria-hidden><i style={{ width: `${Math.min(100, (w.today / w.cap) * 100)}%` }} /></div>
        <div className="cap">{w.today.toLocaleString()} of {w.cap.toLocaleString()} sats paid in the last 24 hours (daily limit)</div>
      </section>

      {left.length > 0 && (
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
        <div className="sec-head"><h3>Where your sats go</h3>{w.address && !dirty.current && <span className="pill paid">✓ address saved</span>}</div>
        <label htmlFor="payaddr">Wallet address (a Lightning address)</label>
        <input id="payaddr" value={addr} onChange={(e) => { dirty.current = true; setAddr(e.target.value); }} placeholder="you@walletofsatoshi.com" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <div className="row" style={{ gap: 8 }}><button className="btn inline" onClick={save}>Save address</button><button className="btn inline secondary" onClick={testAddr}>Test address</button></div>
        {msg && <p className="muted small" style={{ margin: "6px 0 0" }}>{msg}</p>}
        <p className="hint" style={{ margin: "8px 0 0" }}>No wallet address yet? <Link href="/wallet-help">See how to get one</Link>.</p>
      </section>

      <WalletPanel savedAddress={w.address} onUseAddress={useWalletAddress} />

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
      {w.payouts.length > 0 && <div className="card list">{w.payouts.map((p: any) => <div key={p.id} className="item"><div><b style={{ color: "var(--navy)", fontWeight: 500 }}>{p.title}</b>{p.error && <div className="err">{p.error}</div>}</div><div style={{ textAlign: "right" }}><span className="mono" style={{ fontSize: 14, color: p.status === "paid" ? "var(--sea7)" : "var(--steel)" }}>{p.status === "paid" ? "+" : ""}{p.sats} sats</span><br /><span className={`pill ${p.status === "paid" ? "paid" : p.status === "pending" ? "" : "bad"}`}>{p.status === "pending" ? (w.address ? `held · releases in ${Math.max(0, p.release_at - Math.floor(Date.now() / 1000))}s` : "held · add address") : p.status}</span></div></div>)}</div>}
      {w.myTasks.length > 0 && <h2>Tasks you posted</h2>}
      {prov && <p className="hint mono" style={{ wordBreak: "break-all" }}>{prov}</p>}
      {rmsg && <p className="hint">{rmsg}</p>}
      {w.myTasks.map((t: any) => (
        <div key={t.id} className="card">
          {t.status === "paused" && <div className="warn"><b>Paused: payments are failing.</b> {t.pause_reason}
            <input placeholder="New nostr+walletconnect:// link (leave empty to retry the current one)" value={resume[t.id] || ""} onChange={(e) => setResume({ ...resume, [t.id]: e.target.value })} />
            <button className="btn sm" onClick={() => resumeTask(t.id)}>Resume task</button></div>}<h3><Link href={`/task/${t.id}`} style={{ textDecoration: "none" }}>{t.title}</Link></h3><div className="muted small">{t.paid} paid answers · {t.items} items</div>
          <div className="row">{t.kind === "speak" ? <button className="btn secondary" onClick={() => download(t.id, "zip")}>Export ZIP (audio + JSONL)</button> : t.kind === "rank" ? <button className="btn secondary" onClick={() => download(t.id, "jsonl")}>Export preferences (JSONL)</button> : <><button className="btn secondary" onClick={() => download(t.id, "jsonl")}>Export JSONL</button><button className="btn secondary" onClick={() => download(t.id, "csv")}>Export CSV</button></>}</div></div>
      ))}
    </div>
  );
}
