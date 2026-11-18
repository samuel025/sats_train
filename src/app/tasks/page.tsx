"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Fiat } from "@/components/Fiat";
import { toneFor } from "@/lib/languages";

type T = { min_level: number; require_qual: number; id: string; title: string; src_lang: string; dst_lang: string; reward_sats: number; item_count: number; paid_count: number; kind: string; answers_per_item: number };

export default function Home() {
  const [tasks, setTasks] = useState<T[] | null>(null);
  const [lang, setLang] = useState("");
  useEffect(() => { fetch("/api/tasks").then((r) => r.json()).then(setTasks); }, []);
  const langs = [...new Set((tasks ?? []).flatMap((t) => [t.dst_lang, t.src_lang]))].filter((l) => l !== "English").sort();
  const shown = (tasks ?? []).filter((t) => !lang || t.src_lang === lang || t.dst_lang === lang);
  return (
    <>
      <div className="tag">Marketplace</div>
      <h1>Open tasks</h1>
      <p className="lead">Pick a task, answer one item at a time, and get paid in sats when your answer passes.</p>
      {tasks && tasks.length > 0 && (
        <div className="stats">
          <div className="stat"><b>{tasks.length}</b><span>Open tasks</span></div>
          <div className="stat"><b>{tasks.reduce((n, t) => n + t.reward_sats * t.item_count * t.answers_per_item, 0).toLocaleString()}</b><span>Sats available</span></div>
          <div className="stat"><b>{tasks.reduce((n, t) => n + t.paid_count, 0)}</b><span>Answers paid</span></div>
        </div>
      )}
      {tasks && langs.length > 1 && (
        <div className="row" style={{ marginTop: 16, flexWrap: "wrap", gap: 6 }}>
          {["", ...langs].map((l) => <button key={l || "all"} className={`btn sm ${lang === l ? "" : "secondary"}`} onClick={() => setLang(l)}>{l || "All languages"}</button>)}
        </div>
      )}
      <div style={{ height: 24 }} />
      {tasks === null ? <p className="muted">Loading…</p> : shown.length === 0 ? (
        <section className="card narrow"><h3>No tasks yet</h3><p className="muted">Be the first to fund a language task.</p><Link className="btn inline" href="/post">Post a task</Link></section>
      ) : <div className="grid">{shown.map((t) => (
        <Link key={t.id} href={`/task/${t.id}`} className={`card ${toneFor(t.dst_lang)}`}>
          <h3>{t.title}</h3>
          <div><span className="pill">{t.src_lang} → {t.dst_lang}</span><span className="pill">{t.kind === "speak" ? "🎙 voice" : t.kind === "rank" ? "⚖ ranking" : t.kind}</span>{t.require_qual ? <span className="pill">🔒 qualified</span> : null}{t.min_level > 0 ? <span className="pill">{t.min_level === 1 ? "Regular+" : "Trusted"}</span> : null}</div>
          <div className="amount">⚡ {t.reward_sats} <small>sats per item <Fiat sats={t.reward_sats} /></small></div>
          <progress value={t.paid_count} max={t.item_count * t.answers_per_item} />
          <span className="muted small">{t.paid_count} of {t.item_count * t.answers_per_item} answers paid</span>
        </Link>
      ))}</div>}
    </>
  );
}
