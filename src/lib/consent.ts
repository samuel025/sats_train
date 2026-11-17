import { unlinkSync } from "node:fs";
import { db } from "./db";

export const CONSENT_VERSION = 1;
export const LICENSES = ["Research use only", "Open (CC BY 4.0)", "Commercial use permitted", "Exclusive to the requester"] as const;

export const hasVoiceConsent = (pk: string) =>
  !!db().prepare("SELECT 1 FROM consents WHERE pubkey=? AND kind='voice' AND version>=? AND accepted_at IS NOT NULL AND withdrawn_at IS NULL").get(pk, CONSENT_VERSION);

// Withdrawal deletes the person's stored recordings. Payments already made are unaffected.
export function withdrawVoice(pk: string) {
  const d = db();
  const rows = d.prepare("SELECT id,audio_path FROM submissions WHERE worker=? AND audio_path IS NOT NULL").all(pk) as { id: string; audio_path: string }[];
  for (const r of rows) { try { unlinkSync(r.audio_path); } catch { /* already gone */ } }
  d.prepare("UPDATE submissions SET audio_path=NULL WHERE worker=?").run(pk);
  d.prepare("UPDATE consents SET withdrawn_at=? WHERE pubkey=? AND kind='voice'").run(Math.floor(Date.now() / 1000), pk);
  return rows.length;
}
