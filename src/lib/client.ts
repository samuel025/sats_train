"use client";
import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from "nostr-tools";

const KEY = "sfd_sk";
const hex = (u: Uint8Array) => Array.from(u, (b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) => Uint8Array.from(s.match(/.{2}/g)!.map((h) => parseInt(h, 16)));

export type Identity = { pubkey: string; npub: string; mode: "ext" | "local" };

export async function getIdentity(): Promise<Identity | null> {
  try {
    if (localStorage.getItem("sfd_mode") === "ext" && (window as any).nostr) {
      const pk = await (window as any).nostr.getPublicKey();
      return { pubkey: pk, npub: nip19.npubEncode(pk), mode: "ext" };
    }
    const s = localStorage.getItem(KEY);
    if (!s) return null;
    const pk = getPublicKey(unhex(s));
    return { pubkey: pk, npub: nip19.npubEncode(pk), mode: "local" };
  } catch { return null; }
}
export async function signInExtension() { localStorage.setItem("sfd_mode", "ext"); return getIdentity(); }
export function createKey() { localStorage.setItem("sfd_mode", "local"); localStorage.setItem(KEY, hex(generateSecretKey())); return getIdentity(); }
export function importKey(nsec: string) {
  const d = nip19.decode(nsec.trim());
  if (d.type !== "nsec") throw new Error("Paste an nsec key");
  localStorage.setItem("sfd_mode", "local"); localStorage.setItem(KEY, hex(d.data)); return getIdentity();
}
export function backupKey() { const s = localStorage.getItem(KEY); return s ? nip19.nsecEncode(unhex(s)) : null; }
export function signOut() { localStorage.removeItem(KEY); localStorage.removeItem("sfd_mode"); }

export async function signNostrEvent(tmpl: { kind: number; created_at: number; tags: string[][]; content: string }) {
  const id = await getIdentity();
  if (!id) throw new Error("Sign in first");
  return id.mode === "ext" ? await (window as any).nostr.signEvent(tmpl) : finalizeEvent(tmpl, unhex(localStorage.getItem(KEY)!));
}

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function authedFetch(path: string, opts: { method?: string; body?: unknown; raw?: boolean } = {}) {
  const method = opts.method || (opts.body ? "POST" : "GET");
  const body = opts.body ? JSON.stringify(opts.body) : "";
  const url = new URL(path, location.origin).toString();
  const tags = [["u", url], ["method", method]];
  if (body) tags.push(["payload", await sha256(body)]);
  const tmpl = { kind: 27235, created_at: Math.floor(Date.now() / 1000), tags, content: "" };
  const id = await getIdentity();
  if (!id) throw new Error("Sign in first");
  const ev = id.mode === "ext" ? await (window as any).nostr.signEvent(tmpl) : finalizeEvent(tmpl, unhex(localStorage.getItem(KEY)!));
  const res = await fetch(path, { method, body: body || undefined, headers: { authorization: "Nostr " + btoa(JSON.stringify(ev)), ...(body ? { "content-type": "application/json" } : {}) } });
  if (opts.raw) return res;
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "Request failed");
  return j;
}
