import { withAuth } from "@/lib/auth";
import { liveWallet } from "@/lib/wallet";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  return withAuth(req, (pk) => liveWallet(pk));
}
