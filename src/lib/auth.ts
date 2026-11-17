import { verifyEvent, type Event } from "nostr-tools";
import { createHash } from "node:crypto";

// NIP-98 style: client sends `Authorization: Nostr <base64(event json)>`, kind 27235,
// tags: u (absolute url), method, payload (sha256 of body).
export async function authPubkey(req: Request, body: string): Promise<string> {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Nostr ")) throw new Error("Missing Nostr auth");
  const ev = JSON.parse(Buffer.from(h.slice(6), "base64").toString("utf8")) as Event;
  if (ev.kind !== 27235 || !verifyEvent(ev)) throw new Error("Bad signature");
  if (Math.abs(Date.now() / 1000 - ev.created_at) > 60) throw new Error("Auth expired");
  const tag = (n: string) => ev.tags.find((t) => t[0] === n)?.[1];
  const u = new URL(req.url);
  const claimed = new URL(tag("u") || "http://x");
  if (claimed.pathname !== u.pathname) throw new Error("URL mismatch");
  if ((tag("method") || "").toUpperCase() !== req.method) throw new Error("Method mismatch");
  if (body) {
    const hash = createHash("sha256").update(body).digest("hex");
    if (tag("payload") !== hash) throw new Error("Payload mismatch");
  }
  return ev.pubkey;
}

export async function withAuth(
  req: Request,
  fn: (pubkey: string, body: any) => Promise<unknown>
) {
  try {
    if (Number(req.headers.get("content-length") || 0) > 4_000_000) throw Object.assign(new Error("Request too large"), { status: 413 });
    const raw = req.method === "GET" ? "" : await req.text();
    if (raw.length > 4_000_000) throw Object.assign(new Error("Request too large"), { status: 413 });
    const pk = await authPubkey(req, raw);
    const out = await fn(pk, raw ? JSON.parse(raw) : {});
    return Response.json(out);
  } catch (e: any) {
    return Response.json({ error: e.message || "error" }, { status: e.status || 400 });
  }
}
