import { run } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { CONSENT_VERSION, hasVoiceConsent } from "@/lib/consent";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAuth(req, async (pk) => ({ voice: await hasVoiceConsent(pk), version: CONSENT_VERSION }));
}

export async function POST(req: Request) {
  return withAuth(req, async (pk) => {
    await run(`INSERT INTO consents (pubkey,kind,version,accepted_at,withdrawn_at) VALUES (?, 'voice', ?, ?, NULL)
      ON CONFLICT(pubkey,kind) DO UPDATE SET version=EXCLUDED.version, accepted_at=EXCLUDED.accepted_at, withdrawn_at=NULL`, pk, CONSENT_VERSION, Math.floor(Date.now() / 1000));
    return { voice: true };
  });
}
