import { withAuth } from "@/lib/auth";
import { checkAddress } from "@/lib/payout";

export const runtime = "nodejs";

// "Test my address": looks it up without paying anything.
export async function POST(req: Request) {
  return withAuth(req, async (_pk, b) => checkAddress(String(b.address || "").trim().toLowerCase()));
}
