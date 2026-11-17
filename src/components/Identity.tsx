"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Identity, getIdentity, createKey, signInExtension, importKey, backupKey, signOut } from "@/lib/client";

function BackupBanner({ onDone }: { onDone: () => void }) {
  const save = () => {
    const k = backupKey(); if (!k) return;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([`Sats-for-Data private key. Keep it secret. Anyone with it can use your account and your earnings.\n\n${k}\n`], { type: "text/plain" }));
    a.download = "sats-for-data-key.txt"; a.click();
  };
  return (
    <div className="banner">
      <div><b>Back up your account key.</b> It is your account. If you clear this browser without a backup, your account and unpaid earnings are lost.</div>
      <div className="banner-actions"><button className="btn sm" onClick={save}>Download key file</button><button className="btn sm secondary" onClick={() => { localStorage.setItem("sfd_backed_up", "1"); onDone(); }}>I saved it</button></div>
    </div>
  );
}

const Ctx = createContext<{ id: Identity | null }>({ id: null });
export const useId = () => useContext(Ctx).id;

export function Shell({ children }: { children: ReactNode }) {
  const [id, setId] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);
  const [nsec, setNsec] = useState("");
  const [err, setErr] = useState("");
  const path = usePathname();
  const [hasExt, setHasExt] = useState(false);
  const [backed, setBacked] = useState(true);
  useEffect(() => { try { setBacked(localStorage.getItem("sfd_backed_up") === "1"); } catch { /* private mode */ } setHasExt(!!(window as any).nostr); getIdentity().then((i) => { setId(i); setReady(true); }); }, []);

  const landing = path === "/";
  const links = [["/tasks", "Tasks"], ["/review", "Verify"], ["/qualify", "Qualify"], ["/post", "Post a task"], ["/wallet", "Wallet"]];
  const footer = id && (
    <footer className="foot">
      Signed in as {id.npub.slice(0, 12)}…{id.npub.slice(-6)} ·{" "}
      {id.mode === "local" && <a href="#" onClick={(e) => { e.preventDefault(); prompt("Save this account key somewhere safe. Anyone with it can use your account:", backupKey() || ""); }}>Back up account key</a>} ·{" "}
      <a href="#" onClick={(e) => { e.preventDefault(); signOut(); setId(null); }}>Sign out</a>
    </footer>
  );

  return (
    <Ctx.Provider value={{ id }}>
      <header className="bar">
        <Link href="/" className="brand"><span className="logo">⚡</span>Sats-for-Data</Link>
        <nav>
          {links.map(([h, t]) => <Link key={h} href={h} className={path === h ? "on" : ""}>{t}</Link>)}
          {!id && ready && <Link href="/tasks" className="navcta">Sign in</Link>}
        </nav>
      </header>
      {landing ? (
        <>{children}{id && <div className="landing-foot">{footer}</div>}</>
      ) : (
        <main>
          {!ready ? <p className="muted">Loading…</p> : !id ? (
            <section className="card float narrow" style={{ marginTop: 24 }}>
              <div className="tag">Sign in</div>
              <h3 style={{ fontSize: 24, marginBottom: 8 }}>Sign in to start earning</h3>
              <p className="muted">Your account is a private key stored on this device. No email, bank account or phone number needed.</p>
              {hasExt && <button className="btn" onClick={async () => setId(await signInExtension())}>Sign in with my Nostr extension</button>}
              <button className={hasExt ? "btn secondary" : "btn"} onClick={async () => setId(await createKey())}>Create my account</button>
              <details><summary>I already have an account key</summary>
                <input placeholder="Paste your account key (starts with nsec1)" value={nsec} onChange={(e) => setNsec(e.target.value)} />
                <button className="btn secondary" onClick={async () => { try { setId(await importKey(nsec)); } catch (e: any) { setErr(e.message); } }}>Sign in with this key</button>
                {err && <p className="err">{err}</p>}
              </details>
            </section>
          ) : (<>{id.mode === "local" && !backed && <BackupBanner onDone={() => setBacked(true)} />}{children}{footer}</>)}
        </main>
      )}
    </Ctx.Provider>
  );
}
