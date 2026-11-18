"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { authedFetch } from "@/lib/client";
import { Naira } from "@/components/Naira";

type Status = { connected: boolean; sandbox?: boolean; alias?: string | null; lud16?: string | null; canSend?: boolean; canInvoice?: boolean; canList?: boolean };
type Live = { balance: number; transactions: { type: string; state: string; sats: number; description: string; at: number }[] };

const ago = (t: number) => { if (!t) return ""; const s = Math.max(0, Math.floor(Date.now() / 1000) - t); return s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86400)} d ago`; };

export function WalletPanel({ savedAddress, onUseAddress, onChange }: { savedAddress: string; onUseAddress: (a: string) => void; onChange?: () => void }) {
  const [st, setSt] = useState<Status | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [link, setLink] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false); // receive form
  const [showForm, setShowForm] = useState(false); // connect form (collapsed until wanted)
  const [sats, setSats] = useState(100); const [memo, setMemo] = useState("");
  const [inv, setInv] = useState<{ invoice: string; sats: number; qr: string } | null>(null);
  const [got, setGot] = useState<number | null>(null); const [copied, setCopied] = useState(false);
  const base = useRef<number | null>(null), poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setErr("");
    try { const l = await authedFetch("/api/wallet/live"); setLive(l); return l as Live; }
    catch (e: any) { setErr(e.message); return null; } finally { setLoading(false); }
  }, []);
  useEffect(() => { authedFetch("/api/wallet/link").then((s) => { setSt(s); if (s.connected) void refresh(); }).catch((e) => setErr(e.message)); return () => { if (poll.current) clearInterval(poll.current); }; }, [refresh]);

  async function connect() {
    if (link.trim().length < 20) { setErr("Paste your wallet connection link first. It starts with nostr+walletconnect://"); return; }
    setBusy(true); setErr("");
    try { const s = await authedFetch("/api/wallet/link", { body: { nwc: link } }); setSt(s); setLink(""); await refresh(); onChange?.(); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }
  async function disconnect() {
    if (!confirm("Disconnect this wallet from Sats-for-Data? Your wallet and funds are not affected.")) return;
    await authedFetch("/api/wallet/link", { body: { action: "disconnect" } }); setSt({ connected: false, sandbox: st?.sandbox }); setLive(null); setInv(null); setOpen(false); onChange?.();
  }
  async function makeInvoice() {
    setBusy(true); setErr(""); setGot(null);
    try {
      const r = await authedFetch("/api/wallet/invoice", { body: { sats, memo } });
      setInv({ invoice: r.invoice, sats: r.sats, qr: await QRCode.toDataURL(r.invoice.toUpperCase(), { margin: 1, width: 260, errorCorrectionLevel: "L" }) });
      base.current = live?.balance ?? null;
      if (poll.current) clearInterval(poll.current); let n = 0; // watch for the payment for up to 3 minutes
      poll.current = setInterval(async () => { n++; const l = await refresh().catch(() => null);
        if (l && base.current !== null && l.balance > base.current) { setGot(l.balance - base.current); if (poll.current) clearInterval(poll.current); } else if (n > 45 && poll.current) clearInterval(poll.current); }, 4000);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  if (!st) return (
    <section className="card wp-compact"><div><h3 style={{ marginBottom: 2 }}>Your Lightning wallet <span className="pill">optional</span></h3>
      <p className="muted small" style={{ margin: 0 }}>{err || "Checking…"}</p></div></section>
  );

  if (!st.connected && !showForm) return (
    <section className="card wp-compact" id="wallet-panel">
      <div><h3 style={{ marginBottom: 2 }}>Your Lightning wallet <span className="pill">recommended</span></h3>
        <p className="muted small" style={{ margin: 0 }}>Get paid straight into it with no address needed, see your balance, and receive sats.</p></div>
      <button className="btn sm secondary" onClick={() => setShowForm(true)}>Connect</button>
    </section>
  );

  if (!st.connected) return (
    <section className="card">
      <div className="sec-head"><h3>Connect your Lightning wallet</h3><button className="linkbtn" style={{ margin: 0 }} onClick={() => { setShowForm(false); setErr(""); }}>Cancel</button></div>
      <p className="muted small" style={{ marginTop: 0 }}>Paste a Nostr Wallet Connect link from your wallet to see your live balance and payments and to create invoices.</p>
      <label>Wallet connection link</label>
      <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="nostr+walletconnect://…" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <p className="hint"><b>Create a read-only connection.</b> Allow only "read balance", "read transactions" and "create invoices". Sats-for-Data refuses a link that can send payments, so it can never spend your money.{st.sandbox ? " (Sandbox mode: links that can send are allowed for testing.)" : ""}</p>
      {err && <p className="err">{err}</p>}
      <button className="btn inline" disabled={busy} onClick={connect}>{busy ? "Connecting…" : "Connect wallet"}</button>
    </section>
  );

  return (
    <section className="card wp" id="wallet-panel">
      <div className="wp-head">
        <div><div className="label">Your Lightning wallet{st.alias ? ` · ${st.alias}` : ""}</div>
          <div className="wp-bal">⚡ {live ? live.balance.toLocaleString() : "…"} <span>sats</span></div>
          {live && <Naira sats={live.balance} />}</div>
        <div className="wp-actions">
          <button className="btn sm secondary" onClick={() => void refresh()} disabled={loading}>{loading ? "Updating…" : "Refresh"}</button>
          {st.canInvoice && <button className="btn sm" onClick={() => { setOpen(!open); setInv(null); setGot(null); }}>Receive</button>}
        </div>
      </div>
      <div style={{ margin: "8px 0 4px" }}>
        {st.canSend ? <span className="pill bad" title="This link can also send payments">⚠ link can also send</span> : <span className="pill paid">✓ read-only link</span>}
        {st.canInvoice
          ? <span className="pill paid">✓ payouts are paid into this wallet</span>
          : <span className="pill bad" title="This link cannot create invoices">⚠ cannot create invoices, so payouts still need an address</span>}
        {!st.canInvoice && st.lud16 && st.lud16.toLowerCase() !== (savedAddress || "").toLowerCase() && <button className="linkbtn" onClick={() => onUseAddress(st.lud16!)}>Use {st.lud16} for my payouts</button>}
      </div>
      {err && <p className="err">{err}</p>}

      {open && (
        <div className="wp-recv">
          {!inv ? (<>
            <div className="row"><div><label>Amount (sats)</label><input type="number" min={1} max={1000000} value={sats} onChange={(e) => setSats(Number(e.target.value))} /></div>
              <div><label>Note (optional)</label><input value={memo} maxLength={100} onChange={(e) => setMemo(e.target.value)} placeholder="What is it for?" /></div></div>
            <button className="btn inline" disabled={busy || !(sats >= 1)} onClick={makeInvoice}>{busy ? "Creating…" : "Create invoice"}</button>
          </>) : (
            <div className="wp-inv">
              {got ? <div className="wp-got">✓ Received {got.toLocaleString()} sats</div> : <>
                <img src={inv.qr} alt={`Lightning invoice for ${inv.sats} sats`} width={200} height={200} />
                <div className="muted small">Scan with any Lightning wallet, or copy it. Waiting for payment…</div></>}
              <code className="wp-code">{inv.invoice.slice(0, 34)}…</code>
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <button className="btn sm secondary" onClick={() => { void navigator.clipboard?.writeText(inv.invoice); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied ✓" : "Copy invoice"}</button>
                <button className="btn sm secondary" onClick={() => { setInv(null); setGot(null); }}>New invoice</button></div>
            </div>
          )}
        </div>
      )}

      {st.canList && live && (
        <div className="list" style={{ marginTop: 10 }}>
          {live.transactions.length === 0 && <p className="muted small" style={{ margin: "8px 0 0" }}>No payments yet.</p>}
          {live.transactions.map((t, i) => (
            <div key={i} className="item">
              <div><b style={{ fontWeight: 500 }}>{t.type === "incoming" ? "↓ Received" : "↑ Sent"}</b>{t.state !== "settled" && <span className="pill" style={{ marginLeft: 8 }}>{t.state}</span>}
                <div className="muted small">{t.description || "Lightning payment"} · {ago(t.at)}</div></div>
              <div style={{ textAlign: "right", color: t.type === "incoming" ? "var(--ink)" : "var(--ash)" }}><b style={{ fontWeight: 500 }}>{t.type === "incoming" ? "+" : "−"}{t.sats.toLocaleString()} sats</b></div>
            </div>))}
        </div>
      )}
      <button className="linkbtn" style={{ marginTop: 12 }} onClick={disconnect}>Disconnect wallet</button>
    </section>
  );
}
