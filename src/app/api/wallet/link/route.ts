import { withAuth } from "@/lib/auth";
import { connectWallet, disconnectWallet, walletStatus } from "@/lib/wallet";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  return withAuth(req, (pk) => walletStatus(pk));
}

export async function POST(req: Request) {
  return withAuth(req, async (pk, b) => {
    if (b.action === "disconnect") { await disconnectWallet(pk); return { connected: false }; }
    return connectWallet(pk, String(b.nwc || "").trim().slice(0, 2000));
  });
}
