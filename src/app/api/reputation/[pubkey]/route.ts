import { reputation } from "@/lib/reputation";

export const runtime = "nodejs";

// Public: anyone (including other apps) can look up a worker's track record by Nostr pubkey.
export async function GET(_: Request, ctx: { params: Promise<{ pubkey: string }> }) {
  const { pubkey } = await ctx.params;
  if (!/^[0-9a-f]{64}$/.test(pubkey)) return Response.json({ error: "Expected a 64-char hex pubkey" }, { status: 400 });
  return Response.json(await reputation(pubkey));
}
