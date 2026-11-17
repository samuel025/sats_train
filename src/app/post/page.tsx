"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch, signNostrEvent } from "@/lib/client";

const LANGS = ["English", "Nigerian Pidgin", "Yoruba", "Hausa"];
const KINDS: [string, string][] = [
  ["translate", "Translation (worker types an answer)"],
  ["speak", "Voice recording (worker reads sentences aloud)"],
  ["rank", "Preference ranking (worker picks the better reply)"],
];
type Row = { prompt: string; a: string; b: string; answer: string };
const blank = (answer = ""): Row => ({ prompt: "", a: "", b: "", answer });

export default function Post() {
  const r = useRouter();
  const [f, setF] = useState({ title: "", kind: "translate", src: "English", dst: "Nigerian Pidgin", instructions: "", reward: 200, nwc: "", answersPerItem: 2, minLevel: 0, requireQual: false, license: "Research use only" });
  const [items, setItems] = useState<Row[]>([blank(), blank(), blank()]);
  const [checks, setChecks] = useState<Row[]>([]);
  const [paste, setPaste] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((o) => ({ ...o, [k]: v }));
  const speak = f.kind === "speak", rank = f.kind === "rank";

  const upd = (list: Row[], setList: (r: Row[]) => void, i: number, k: keyof Row, v: string) => setList(list.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const del = (list: Row[], setList: (r: Row[]) => void, i: number, min = 0) => list.length > min && setList(list.filter((_, j) => j !== i));
  const filled = (x: Row) => x.prompt.trim() && (!rank || (x.a.trim() && x.b.trim()));
  const good = items.filter(filled), goodChecks = checks.filter((c) => filled(c) && (rank ? ["A", "B"].includes(c.answer) : c.answer.trim()));

  function addPasted() {
    const rows = paste.split("\n").map((s) => s.trim()).filter(Boolean).map((p) => ({ ...blank(), prompt: p }));
    if (!rows.length) return;
    setItems([...items.filter((x) => x.prompt.trim() || x.a.trim()), ...rows]); setPaste("");
  }

  async function submit() {
    setBusy(true); setErr("");
    try {
      // The requester signs the public task announcement with their own Nostr key (provenance).
      const taskId = crypto.randomUUID();
      const event = await signNostrEvent({
        kind: 30078, created_at: Math.floor(Date.now() / 1000), content: JSON.stringify({ title: f.title }),
        tags: [["d", `sats-for-data:${taskId}`], ["t", "sats-for-data"], ["lang", f.src, f.dst], ["reward", String(f.reward)], ["items", String(good.length)]],
      });
      const strip = (x: Row) => (rank ? { prompt: x.prompt, a: x.a, b: x.b } : { prompt: x.prompt });
      const res = await authedFetch("/api/tasks", { body: { ...f, src: speak || rank ? f.dst : f.src, id: taskId, event,
        items: good.map(strip), checks: speak ? [] : goodChecks.map((c) => ({ ...strip(c), answer: c.answer })) } });
      r.push(`/task/${res.id}`);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }
  const n = good.length;
  const per = Number(f.reward || 0) * Number(f.answersPerItem || 1);
  const reviewCost = speak ? Math.max(1, Math.round(Number(f.reward || 0) * 0.3)) : 0;
  const budget = n * (per + reviewCost);

  const editor = (list: Row[], setList: (r: Row[]) => void, gold: boolean) => list.map((x, i) => (
    <div key={i} className="irow">
      <div className="irow-head"><span className="label">{gold ? "Check" : "Item"} {i + 1}</span>
        <button type="button" className="x" aria-label="Remove" onClick={() => del(list, setList, i, gold ? 0 : 1)}>×</button></div>
      <input value={x.prompt} onChange={(e) => upd(list, setList, i, "prompt", e.target.value)}
        placeholder={rank ? "The user's message, e.g. “How far? You don chop?”" : speak ? "Sentence to read aloud" : `Sentence in ${f.src}`} />
      {rank && <div className="row">
        <div><input value={x.a} onChange={(e) => upd(list, setList, i, "a", e.target.value)} placeholder="Reply A" /></div>
        <div><input value={x.b} onChange={(e) => upd(list, setList, i, "b", e.target.value)} placeholder="Reply B" /></div>
      </div>}
      {gold && (rank
        ? <select value={x.answer} onChange={(e) => upd(list, setList, i, "answer", e.target.value)}><option value="">Which reply is clearly better?</option><option value="A">Reply A is better</option><option value="B">Reply B is better</option></select>
        : <input value={x.answer} onChange={(e) => upd(list, setList, i, "answer", e.target.value)} placeholder={`Known good answer in ${f.dst}`} />)}
    </div>
  ));

  return (
    <div className="narrow">
      <div className="tag">Requester</div>
      <h1>Post a task</h1>
      <p className="lead">Fund paid language work from your own wallet. You set the cap; we never hold your money.</p>

      <section className="card">
        <h3>Basics</h3>
        <label>Task type</label>
        <select value={f.kind} onChange={(e) => set("kind", e.target.value)}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <label>Title</label><input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder={rank ? "Which Pidgin reply is better?" : "Translate greetings to Pidgin"} />
        <div className="row">
          {f.kind === "translate" && <div><label>From</label><select value={f.src} onChange={(e) => set("src", e.target.value)}>{LANGS.map((l) => <option key={l}>{l}</option>)}</select></div>}
          <div><label>{f.kind === "translate" ? "To" : "Language"}</label><select value={f.dst} onChange={(e) => set("dst", e.target.value)}>{LANGS.map((l) => <option key={l}>{l}</option>)}</select></div>
        </div>
        <label>Instructions for workers (optional)</label>
        <textarea value={f.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder={rank ? "Pick the reply that is more natural, correct and helpful." : "Anything workers should know"} />
      </section>

      <section className="card">
        <div className="sec-head"><h3>{speak ? "Sentences to read aloud" : rank ? "Prompts and replies" : "Items to translate"} <span className="muted small">({n})</span></h3></div>
        {editor(items, setItems, false)}
        <div className="row" style={{ marginTop: 4 }}>
          <button type="button" className="btn secondary" onClick={() => setItems([...items, blank()])}>+ Add item</button>
        </div>
        {!rank && <details><summary>Paste a list instead</summary>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="One per line" />
          <button type="button" className="btn secondary" onClick={addPasted} disabled={!paste.trim()}>Add these as items</button>
        </details>}
      </section>

      {!speak && (
        <section className="card">
          <div className="sec-head"><h3>Quality checks <span className="muted small">(optional, {goodChecks.length})</span></h3></div>
          <p className="hint" style={{ margin: "0 0 12px" }}>Items where you already know the right answer. They are mixed in and look identical to workers. Anyone who fails them is not paid.</p>
          {editor(checks, setChecks, true)}
          <button type="button" className="btn secondary" onClick={() => setChecks([...checks, blank()])}>+ Add check item</button>
        </section>
      )}

      <section className="card">
        <h3>Payment and access</h3>
        <div className="row">
          <div><label>Sats per item</label><input type="number" min={1} value={f.reward} onChange={(e) => set("reward", e.target.value)} /></div>
          <div><label>Workers per item</label><input type="number" min={1} max={5} value={f.answersPerItem} onChange={(e) => set("answersPerItem", e.target.value)} /></div>
        </div>
        {speak && <><label>Data license (shown to speakers, included in the export)</label>
          <select value={f.license} onChange={(e) => set("license", e.target.value)}>{["Research use only", "Open (CC BY 4.0)", "Commercial use permitted", "Exclusive to the requester"].map((l) => <option key={l}>{l}</option>)}</select></>}
        <div className="row">
          <div><label>Who can work on it</label>
            <select value={f.minLevel} onChange={(e) => set("minLevel", Number(e.target.value))}><option value={0}>Anyone</option><option value={1}>Regular level and above</option><option value={2}>Trusted level only</option></select></div>
          <div><label>Language check</label>
            <select value={f.requireQual ? "1" : "0"} onChange={(e) => set("requireQual", e.target.value === "1")}><option value="0">No test needed</option><option value="1">Must pass the {f.dst} test</option></select></div>
        </div>
        <label>Nostr Wallet Connect link</label>
        <input value={f.nwc} onChange={(e) => set("nwc", e.target.value)} placeholder="nostr+walletconnect://…" />
        <p className="hint">Set a <b>spending cap</b> of about <b>{budget} sats</b> on the link ({n} items × {per} sats{speak ? ` + ${reviewCost} sats per clip for a peer to verify it` : ""}). We never hold your money, and the link is stored encrypted. Revoke it when done.</p>
        <p className="hint">{rank ? "With 2+ workers per item, votes are counted and each row is labeled consensus or disputed." : speak ? "Each accepted recording is also verified by a second, qualified listener who types what they hear." : "With 2+ workers per item, independent answers are compared and labeled consensus or disputed."} Your task is announced on Nostr, signed with your key.</p>
        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy || !f.title.trim() || !n || !f.nwc.trim()} onClick={submit}>{busy ? "Publishing…" : `Publish task (${n} ${n === 1 ? "item" : "items"})`}</button>
      </section>
    </div>
  );
}
