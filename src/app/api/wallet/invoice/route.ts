import { withAuth } from "@/lib/auth";
import { receiveInvoice } from "@/lib/wallet";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  return withAuth(req, async (pk, b) => {
    const sats = Math.floor(Number(b.sats));
    if (!(sats >= 1 && sats <= 1_000_000)) throw new Error("Amount must be between 1 and 1,000,000 sats");
    return receiveInvoice(pk, sats, String(b.memo || "").slice(0, 100));
  });
}
