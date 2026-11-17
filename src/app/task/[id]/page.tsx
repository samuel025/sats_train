"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/client";
import { Naira } from "@/components/Naira";
import { startRecording, blobToBase64, type Rec } from "@/lib/recorder";

export default function Task({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<any>(null);
  const [answer, setAnswer] = useState("");
  const [choice, setChoice] = useState("");
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<Rec | null>(null); const [clip, setClip] = useState<{ blob: Blob; durationMs: number; url: string } | null>(null); const [secs, setSecs] = useState(0);
  useEffect(() => { if (!rec) return; const t = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(t); }, [rec]);
  async function stopRec() { if (!rec) return; const r = await rec.stop(); setRec(null); setClip({ ...r, url: URL.createObjectURL(r.blob) }); }
  useEffect(() => { if (rec && secs >= 30) void stopRec(); }); // hard stop at 30s
  async function begin() { setErr(""); setClip(null); setSecs(0); try { setRec(await startRecording()); } catch { setErr("Microphone blocked. Allow microphone access in your browser and try again."); } }

  const load = useCallback(() => authedFetch(`/api/tasks/${id}`).then((x) => { setD(x); setAnswer(""); setChoice(""); setClip(null); setSecs(0); }).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  async function send() {
    setBusy(true); setErr("");
    try {
      const body = clip ? { itemId: d.item.id, audio: await blobToBase64(clip.blob), durationMs: clip.durationMs }
        : d.task.kind === "rank" ? { itemId: d.item.id, choice } : { itemId: d.item.id, answer };
      setRes(await authedFetch("/api/submit", { body }));
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }
  if (err && !d) return <p className="err">{err}</p>;
  if (!d) return <p className="muted">Loading…</p>;
  const { task, item } = d;
  const speak = task.kind === "speak", rank = task.kind === "rank";

  if (d.status && d.status !== "open") return (
    <div className="narrow">
      <div className="tag">{d.status === "paused" ? "Paused" : "Closed"}</div>
      <h1>{task.title}</h1>
      <section className="card"><h3>{d.status === "paused" ? "This task is paused" : "This task is closed"}</h3>
        <p className="muted">{d.status === "paused" ? (d.isRequester && d.reason ? d.reason : "The requester's wallet needs attention. Work resumes once it is fixed, and you will not lose any earned payments.") : "It is no longer taking answers."}</p>
        {d.isRequester ? <Link className="btn inline" href="/wallet">Fix and resume in Wallet</Link> : <Link className="btn inline" href="/tasks">Other tasks</Link>}</section>
    </div>
  );

  if (speak && !d.consent && !d.isRequester) return (
    <div className="narrow">
      <div className="tag">Before you record</div>
      <h1>Voice recording consent</h1>
      <section className="card">
        <p>Your recordings are your voice, which is personal data. Please read this before recording.</p>
        <ul className="lp-list">
          <li><b>What we collect:</b> the audio you record, linked to your anonymous account key, not your name.</li>
          <li><b>Who hears it:</b> the requester, and qualified listeners who verify clips for pay.</li>
          <li><b>How it is used:</b> to build language and speech datasets. This task's data license is <b>{task.license || "Research use only"}</b>.</li>
          <li><b>Once you submit:</b> an accepted recording is paid for and becomes part of the dataset, so it cannot be taken back. Only record what you are comfortable sharing.</li>
        </ul>
        <button className="btn" onClick={async () => { await authedFetch("/api/consent", { body: { action: "accept" } }); load(); }}>I understand and agree</button>
        <Link className="btn secondary" href="/tasks">No thanks</Link>
      </section>
    </div>
  );

  if (d.gate) return (
    <div className="narrow">
      <div className="tag">Locked task</div>
      <h1>{task.title}</h1>
      <section className="card"><h3>Not unlocked yet</h3><p className="muted">{d.gate}</p>
        <Link className="btn inline" href="/qualify">Take a qualification test</Link>{" "}
        <Link className="btn inline secondary" href="/tasks">Other tasks</Link></section>
    </div>
  );

  if (res) {
    const retry = !res.pass && res.attemptsLeft > 0;
    return (
      <section className="card float narrow">
        <div className="tag">{res.pass ? "Accepted" : "Not accepted"}</div>
        <h1 style={{ fontSize: 22 }}>{res.pass ? (rank ? "Choice recorded" : "Answer accepted") : retry ? "Try again" : "Not accepted"}</h1>
        <p>{res.reason}</p>
        {res.pass && res.payment?.status === "pending" && <div className="pay"><div className="label" style={{ color: "#fff", opacity: .7 }}>Payment queued</div><div className="mono">⚡ {res.sats} sats (<Naira sats={res.sats} className="" />) released in about {res.payment.cooldown}s. Check your Wallet.</div></div>}
        {res.pass && <p className="muted small">{res.peers >= 2 ? `${res.peers} workers have answered this item. Peers cross-check each other.` : "Waiting for another worker to cross-check this item."}</p>}
        {res.pass && res.payment && !["pending", "paid"].includes(res.payment.status) && <p className="err">{res.payment.error || "Payment not sent: " + res.payment.status}</p>}
        {res.pass && <p className="muted small">No wallet address yet? <Link href="/wallet">Add one in your Wallet</Link>. Held payments are sent once you do.</p>}
        {retry && <p className="muted small">{res.attemptsLeft} {res.attemptsLeft === 1 ? "try" : "tries"} left on this item.</p>}
        <button className="btn" onClick={() => { setRes(null); if (retry) setClip(null); else load(); }}>{retry ? "Try again" : "Next item"}</button>
      </section>
    );
  }
  const ready = rank ? !!choice : speak ? !!clip : !!answer.trim();
  return (
    <div className="narrow">
      <div className="tag">Task</div>
      <h1>{task.title}</h1>
      <p><span className="pill">{task.src_lang === task.dst_lang ? task.dst_lang : `${task.src_lang} → ${task.dst_lang}`}</span><span className="pill">⚡ {task.reward_sats} sats per item</span><span className="pill"><Naira sats={task.reward_sats} className="" /></span><span className="pill">{d.done} done</span></p>
      {task.instructions && <p className="muted">{task.instructions}</p>}
      {d.isRequester && <p className="muted">This is your task. <Link href="/wallet">Export data from Wallet</Link>.</p>}
      {!item ? <section className="card"><h3>All done here</h3><p className="muted">No more items for you in this task. Thank you!</p><Link className="btn inline" href="/tasks">See other tasks</Link></section> : (
        <section className="card">
          <div className="label">{speak ? `Read this aloud in ${task.dst_lang}` : rank ? "Which reply is better?" : task.kind === "translate" ? `Translate into ${task.dst_lang}` : "Your answer"}</div>
          <p className="prompt">{item.prompt}</p>
          {rank ? (
            <>
              {item.options.map((o: string, i: number) => (
                <button key={i} className={`opt ${choice === String(i + 1) ? "on" : ""}`} onClick={() => setChoice(String(i + 1))}>
                  <span className="label">Reply {i + 1}</span><span>{o}</span>
                </button>
              ))}
              <button className={`opt neither ${choice === "neither" ? "on" : ""}`} onClick={() => setChoice("neither")}>Neither reply is good</button>
            </>
          ) : speak ? (
            <div className={`rec ${rec ? "live" : ""}`}>
              <span className="dot" />
              {rec ? <><span className="time">0:{String(secs).padStart(2, "0")}</span><span className="muted small" style={{ flex: 1 }}>Recording… read the sentence clearly</span><button className="btn sm" onClick={stopRec}>Stop</button></>
                : clip ? <><audio src={clip.url} controls /><button className="btn sm secondary" onClick={begin}>Re-record</button></>
                : <><span className="muted small" style={{ flex: 1 }}>Find a quiet spot, then tap record. Up to 30 seconds.</span><button className="btn sm rec-btn" onClick={begin} disabled={d.isRequester}>● Record</button></>}
            </div>
          ) : item.labels ? item.labels.map((l: string) => <button key={l} className="btn secondary" onClick={() => setAnswer(l)}>{l}{answer === l ? " ✓" : ""}</button>)
            : <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer" disabled={d.isRequester} />}
          {err && <p className="err">{err}</p>}
          <button className="btn" disabled={busy || d.isRequester || !!rec || !ready} onClick={send}>{busy ? "Checking…" : "Submit"}</button>
        </section>
      )}
    </div>
  );
}
