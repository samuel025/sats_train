export const runtime = "nodejs";
let cache: { at: number; ngnPerBtc: number; source: string } | null = null;

// Approximate BTC price in naira, cached 10 minutes. Falls back to a stale/default value so the UI never breaks.
export async function GET() {
  if (cache && Date.now() - cache.at < 600_000) return Response.json({ ngnPerBtc: cache.ngnPerBtc, source: cache.source });
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=ngn", { signal: AbortSignal.timeout(6000) });
    const v = (await r.json())?.bitcoin?.ngn;
    if (!(v > 0)) throw new Error("bad rate");
    cache = { at: Date.now(), ngnPerBtc: v, source: "coingecko" };
  } catch {
    cache = { at: cache ? cache.at : Date.now() - 540_000, ngnPerBtc: cache?.ngnPerBtc ?? Number(process.env.FALLBACK_NGN_PER_BTC || 150_000_000), source: cache ? "stale" : "fallback" };
  }
  return Response.json({ ngnPerBtc: cache.ngnPerBtc, source: cache.source });
}
