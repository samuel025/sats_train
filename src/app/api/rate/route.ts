import { CURRENCIES } from "@/lib/languages";
export const runtime = "nodejs";

type Entry = { at: number; perBtc: number; source: string };
const cache = new Map<string, Entry>();
// Only Nigeria has a built-in fallback, because made-up rates for other currencies would mislead. Others show nothing when the feed is down.
const FALLBACK: Record<string, number> = { NGN: Number(process.env.FALLBACK_NGN_PER_BTC || 150_000_000) };

// Approximate BTC price in the worker's currency (?cur=KES), cached 10 minutes. Falls back to a stale value so the UI never breaks.
export async function GET(req: Request) {
  const cur = (new URL(req.url).searchParams.get("cur") || "NGN").toUpperCase();
  if (!CURRENCIES.some((c) => c.code === cur)) return Response.json({ error: "Unsupported currency" }, { status: 400 });
  const hit = cache.get(cur);
  if (hit && Date.now() - hit.at < 600_000) return Response.json({ cur, perBtc: hit.perBtc, source: hit.source });
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${cur.toLowerCase()}`, { signal: AbortSignal.timeout(6000) });
    const v = (await r.json())?.bitcoin?.[cur.toLowerCase()];
    if (!(v > 0)) throw new Error("bad rate");
    cache.set(cur, { at: Date.now(), perBtc: v, source: "coingecko" });
  } catch {
    const old = hit?.perBtc ?? FALLBACK[cur];
    if (!old) return Response.json({ cur, perBtc: null, source: "unavailable" });
    cache.set(cur, { at: hit ? hit.at : Date.now() - 540_000, perBtc: old, source: hit ? "stale" : "fallback" });
  }
  const e = cache.get(cur)!;
  return Response.json({ cur, perBtc: e.perBtc, source: e.source });
}
