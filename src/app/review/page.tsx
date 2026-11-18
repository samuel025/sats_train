"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/client";
import { Fiat } from "@/components/Fiat";
import { dirFor } from "@/lib/languages";

export default function Review() {
  const [d, setD] = useState<any>(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRes(null); setText(""); setErr(""); setUrl("");
    try {
      const x = await authedFetch("/api/review/next"); setD(x);
      if (x.clip) { // audio is access-controlled, so fetch it with the signed request and play from a blob
        const r = (await authedFetch(`/api/audio/${x.clip.id}`, { raw: true })) as Response;
        if (r.ok) setUrl(URL.createObjectURL(await r.blob()));
      }
    } catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function send() {
    setBusy(true); setErr("");
    try { setRes(await authedFetch("/api/review", { body: { id: d.clip.id, transcript: text } })); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }
  if (!d) return <p className="muted">{err || "Loading…"}</p>;

  if (res) return (
    <section className="card float narrow">
      <div className="tag">{res.match ? "Verified" : "No match"}</div>
      <h1 style={{ fontSize: 22 }}>{res.match ? "Clip verified" : "Not a match"}</h1>
      <p>{res.feedback}</p>
      {res.match && res.payment?.status === "pending" && <div className="pay"><div className="label" style={{ color: "#fff", opacity: .7 }}>Payment queued</div><div className="mono">⚡ {res.sats} sats released in about {res.payment.cooldown}s. Check your Wallet.</div></div>}
      <button className="btn" onClick={load}>Next clip</button>
    </section>
  );

  return (
    <div className="narrow">
      <div className="tag">Peer verification</div>
      <h1>Verify a recording</h1>
      <p className="lead">Listen to a clip and type exactly what you hear. When your words match what the speaker was asked to say, the clip is verified and you get paid.</p>
      {!d.clip ? (
        <section className="card"><h3>{d.needQual ? "Take a language test first" : "Nothing to verify right now"}</h3>
          <p className="muted">{d.needQual ? "You can verify clips in languages you are qualified in. The test takes about a minute." : "All recorded clips have been checked, or none are available in your languages. Check back soon."}</p>
          <Link className="btn inline" href={d.needQual ? "/qualify" : "/tasks"}>{d.needQual ? "Take a qualification test" : "Browse tasks"}</Link></section>
      ) : (
        <section className="card">
          <p><span className="pill">{d.clip.language}</span><span className="pill">⚡ {d.clip.sats} sats <Fiat sats={d.clip.sats} className="" /></span><span className="pill">~{d.clip.seconds}s</span></p>
          {url ? <audio src={url} controls style={{ width: "100%", margin: "8px 0 14px" }} /> : <p className="muted small">Loading audio…</p>}
          <label>What did the speaker say?</label>
          <textarea dir={dirFor(d.clip.language, text)} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Type it in ${d.clip.language}, as you hear it`} />
          <p className="hint">Spelling and tone marks don't need to be perfect. Don't guess: wrong transcripts earn nothing.</p>
          {err && <p className="err">{err}</p>}
          <button className="btn" disabled={busy || text.trim().length < 2} onClick={send}>{busy ? "Checking…" : "Submit transcript"}</button>
        </section>
      )}
    </div>
  );
}
