import { db } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { CONSENT_VERSION, hasVoiceConsent } from "@/lib/consent";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAuth(req, async (pk) => ({ voice: hasVoiceConsent(pk), version: CONSENT_VERSION }));
}

export async function POST(req: Request) {
  return withAuth(req, async (pk) => {
    db().prepare(`INSERT INTO consents (pubkey,kind,version,accepted_at,withdrawn_at) VALUES (?, 'voice', ?, ?, NULL)
      ON CONFLICT(pubkey,kind) DO UPDATE SET version=excluded.version, accepted_at=excluded.accepted_at, withdrawn_at=NULL`).run(pk, CONSENT_VERSION, Math.floor(Date.now() / 1000));
    return { voice: true };
  });
}
