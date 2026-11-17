"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/client";
import { Naira } from "@/components/Naira";

export default function Wallet() {
  const [w, setW] = useState<any>(null);
  const [resume, setResume] = useState<Record<string, string>>({}); const [rmsg, setRmsg] = useState("");
  const [addr, setAddr] = useState(""); const [msg, setMsg] = useState(""); const [prov, setProv] = useState("");
  const load = () => authedFetch("/api/wallet").then((x) => { setW(x); setAddr(x.address); });
  useEffect(() => { load().catch((e) => setMsg(e.message)); const t = setInterval(() => load().catch(() => {}), 5000); return () => clearInterval(t); }, []);

  async function save() { setMsg("Checking address…"); try { const r = await authedFetch("/api/wallet", { body: { address: addr } }); setMsg(r.retried ? `Saved ✓ ${r.retried} held payment(s) will be retried.` : "Saved ✓"); load(); } catch (e: any) { setMsg(e.message); } }
  async function testAddr() { setMsg("Checking address…"); try { const r = await authedFetch("/api/wallet/test", { body: { address: addr } }); setMsg(r.ok ? `This address works ✓ (accepts ${r.min}–${r.max.toLocaleString()} sats)` : r.error); } catch (e: any) { setMsg(e.message); } }
  async function resumeTask(id: string) { setRmsg("Checking wallet link…"); try { const r = await authedFetch(`/api/tasks/${id}/resume`, { body: { nwc: resume[id] || "" } }); setRmsg(`Task resumed ✓${r.balance !== null ? ` Wallet balance: ${r.balance} sats.` : ""}${r.retried ? ` ${r.retried} failed payment(s) are being retried.` : ""}`); load(); } catch (e: any) { setRmsg(e.message); } }
  async function wipeVoice() { if (!confirm("Delete all your voice recordings? This cannot be undone. Payments you already received stay yours.")) return; try { const r = await authedFetch("/api/consent", { body: { action: "withdraw" } }); setMsg(`Deleted ${r.deleted} recording(s).`); } catch (e: any) { setMsg(e.message); } }
  async function download(id: string, format: string) {
    const r = await authedFetch(`/api/export/${id}?format=${format}&attest=1`, { raw: true }) as Response;
    const ev = r.headers.get("x-nostr-event");
    setProv(`Dataset sha256 ${r.headers.get("x-dataset-sha256")}${ev ? ` · pinned on Nostr in signed event ${ev}` : ""}`);
    const a = document.createElement("a"); a.href = URL.createObjectURL(await r.blob()); a.download = `dataset-${id.slice(0, 8)}.${format === "csv" ? "csv" : format === "zip" ? "zip" : "jsonl"}`; a.click();
  }
  if (!w) return <p className="muted">{msg || "Loading…"}</p>;
  return (
    <div className="narrow">
      <div className="tag">Wallet</div>
      <h1>Your wallet</h1>
      <section className="card float" style={{ background: "var(--indigo)", color: "#fff", boxShadow: "none" }}>
        <div className="label" style={{ color: "#fff", opacity: .8 }}>Total earned</div>
        <div style={{ font: "400 56px/1 var(--font-sans)", letterSpacing: "-.05em", margin: "8px 0" }}>⚡ {w.total.toLocaleString()} sats</div>
        <div style={{ opacity: .85, marginBottom: 4 }}><Naira sats={w.total} className="" /></div>
        <div style={{ fontSize: 14, opacity: .9 }}>{w.today} of {w.cap} sats paid in the last 24 hours (daily limit)</div>
      </section>
      <section className="card">
        <div className="label">Your reputation · tied to your Nostr key</div>
        <div className="row" style={{ marginTop: 12 }}>
          <div className="stat"><b>{w.reputation.score}</b><span>Level: {w.reputation.level}</span></div>
          <div className="stat"><b>{w.reputation.acceptRate}%</b><span>Accepted ({w.reputation.accepted}/{w.reputation.attempts})</span></div>
          {w.reputation.hiddenCheckRate !== null && <div className="stat"><b>{w.reputation.hiddenCheckRate}%</b><span>Quality checks</span></div>}
        </div>
        <p className="hint" style={{ margin: "12px 0 0" }}>{w.reputation.level === "Trusted" ? "Top level reached." : `Next level: ${w.reputation.level === "New" ? "5 accepted answers or verifications with a score of 30+" : "20 accepted with a score of 70+"}.`} {w.reputation.qualified.length ? <>Qualified: {w.reputation.qualified.join(", ")}. </> : <><Link href="/qualify">Take a language test</Link> to unlock verification work. </>}Public at <code>/api/reputation/{w.pubkey.slice(0, 8)}…</code>. It follows your key, not an account.</p>
      </section>
      <section className="card">
      <label>Lightning address (where sats are sent)</label>
      <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="you@walletofsatoshi.com" autoCapitalize="none" />
      <div className="row" style={{ gap: 8 }}><button className="btn inline" onClick={save}>Save address</button><button className="btn inline secondary" onClick={testAddr}>Test address</button></div>{msg && <p className="muted small">{msg}</p>}
      <p className="hint" style={{ marginTop: 8 }}>No Lightning address yet? <Link href="/wallet-help">See how to get one</Link>.</p>
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
      <h2>Privacy</h2>
      <section className="card"><p className="muted small" style={{ marginTop: 0 }}>Voice recordings are linked only to your anonymous key. You can delete all of yours at any time. Payments you already received are not affected.</p>
        <button className="btn secondary inline" onClick={wipeVoice}>Delete my voice recordings</button></section>
    </div>
  );
}
