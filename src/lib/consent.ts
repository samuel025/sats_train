import { db } from "./db";

export const CONSENT_VERSION = 1;
export const LICENSES = ["Research use only", "Open (CC BY 4.0)", "Commercial use permitted", "Exclusive to the requester"] as const;

export const hasVoiceConsent = (pk: string) =>
  !!db().prepare("SELECT 1 FROM consents WHERE pubkey=? AND kind='voice' AND version>=? AND accepted_at IS NOT NULL AND withdrawn_at IS NULL").get(pk, CONSENT_VERSION);
