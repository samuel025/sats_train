"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/client";

export default function Qualify() {
  const [langs, setLangs] = useState<any[] | null>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [ans, setAns] = useState<number[]>([]);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const load = () => authedFetch("/api/qualify").then((x) => setLangs(x.languages)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  async function start(language: string) { setErr(""); setRes(null); setAns([]); try { setQuiz({ language, ...(await authedFetch(`/api/qualify?lang=${encodeURIComponent(language)}`)) }); } catch (e: any) { setErr(e.message); } }
  async function submit() { setBusy(true); try { setRes(await authedFetch("/api/qualify", { body: { language: quiz.language, answers: ans } })); load(); } catch (e: any) { setErr(e.message); } setBusy(false); }

  if (!langs) return <p className="muted">{err || "Loading…"}</p>;

  if (res) return (
    <section className="card float narrow">
      <div className="tag">{quiz.language}</div>
      <h1 style={{ fontSize: 22 }}>{res.passed ? "You're qualified" : "Not this time"}</h1>
      <p>{res.already ? "You already hold this qualification." : `You scored ${res.score} of ${res.total}. You need ${res.passMark} to pass.`}</p>
      {res.passed ? <p className="muted small">You can now verify {quiz.language} recordings for sats and work on tasks that require this qualification.</p>
        : <p className="muted small">{res.attemptsLeft > 0 ? `${res.attemptsLeft} attempts left today.` : "No attempts left today. Try again tomorrow."}</p>}
      <div className="row"><Link className="btn" href={res.passed ? "/review" : "/qualify"} onClick={() => { setQuiz(null); setRes(null); }}>{res.passed ? "Verify recordings" : "Back"}</Link>
        <button className="btn secondary" onClick={() => { setQuiz(null); setRes(null); }}>All languages</button></div>
    </section>
  );

  if (quiz) return (
    <div className="narrow">
      <div className="tag">{quiz.language} qualification</div>
      <h1>Quick language check</h1>
      <p className="lead">{quiz.questions.length} everyday questions. Score {quiz.passMark} or more to qualify.</p>
      {quiz.questions.map((q: any, i: number) => (
        <section key={i} className="card">
          <div className="label">Question {i + 1} of {quiz.questions.length}</div>
          <p className="prompt" style={{ fontSize: 17, margin: "6px 0 10px" }}>{q.q}</p>
          {q.options.map((o: string, j: number) => <button key={j} className={`opt ${ans[i] === j ? "on" : ""}`} onClick={() => setAns((a) => { const n = [...a]; n[i] = j; return n; })}><span>{o}</span></button>)}
        </section>
      ))}
      {err && <p className="err">{err}</p>}
      <button className="btn" disabled={busy || quiz.questions.some((_: any, i: number) => ans[i] === undefined)} onClick={submit}>{busy ? "Checking…" : "Submit answers"}</button>
    </div>
  );

  return (
    <div className="narrow">
      <div className="tag">Training</div>
      <h1>Language qualification</h1>
      <p className="lead">Pass a short test to unlock verification work and tasks that require a qualified speaker. Qualified workers are trusted with higher-value tasks.</p>
      {err && <p className="err">{err}</p>}
      {langs.map((l) => (
        <section key={l.language} className={`card ${l.passed ? "mint" : ""}`}>
          <div className="row" style={{ alignItems: "center" }}>
            <div><h3 style={{ marginBottom: 2 }}>{l.language}</h3><span className="muted small">{l.passed ? `Qualified · scored ${l.bestScore}/${l.total}` : `${l.total} questions · pass with ${l.passMark} · ${l.attemptsLeft} attempts left today`}</span></div>
            <div style={{ flex: "0 0 auto" }}>{l.passed ? <span className="pill paid">Qualified</span> : <button className="btn sm" disabled={l.attemptsLeft <= 0} onClick={() => start(l.language)}>Start test</button>}</div>
          </div>
        </section>
      ))}
      <h2>What good work looks like</h2>
      <section className="card"><ul className="lp-list" style={{ margin: 0 }}>
        <li><b>Translations:</b> natural everyday wording, not word-for-word. Spelling variants are fine.</li>
        <li><b>Recordings:</b> a quiet room, normal speed, the whole sentence, in your own voice.</li>
        <li><b>Rankings:</b> pick the reply a native speaker would find most natural and helpful.</li>
        <li><b>Verification:</b> type only what you actually hear. Wrong guesses earn nothing.</li>
      </ul></section>
    </div>
  );
}
