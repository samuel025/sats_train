# ⚡ Sats-for-Data

Teach AI your language and get paid in sats. A mobile-first web app where people earn Lightning sats for small language tasks (Nigerian Pidgin, Yoruba, Hausa, English). Requesters fund tasks through a spending-capped **Nostr Wallet Connect** link, an **LLM grader** checks every answer, approved answers are paid over **Lightning**, and the dataset exports as JSONL or CSV.

It builds datasets; it does not train a model.

## Flow
post task (NWC link + cap) → published as a Nostr event → worker signs in with a Nostr key → answers one item at a time → grader checks (heuristics, hidden check items, LLM) → pass = Lightning payout to the worker's Lightning address → requester exports data.

## Run
```bash
cp .env.example .env.local   # set NEON_POSTGRES, APP_SECRET, GEMINI_API_KEY
npm install
npm run dev                  # http://localhost:3000
```
Try it without moving sats: `MOCK_PAYMENTS=1 npm run dev`, then use `demo` as the NWC link when posting.
Without `GEMINI_API_KEY` a basic offline grader is used (demo only).

## Demo and sandbox payments
The demo tasks are paid from a **sandbox** wallet (Alby's NWC faucet: real NWC and Lightning-address payments, play-money sats). Run `npm run demo:wallet` to create one and save `DEMO_NWC` in `.env.local`; run `npm run demo:wallet -- topup` to refill it. Set `SEED_DEMO=1` and the same `DEMO_NWC` on your host. With `MOCK_PAYMENTS=1` payouts are simulated and no wallet is needed. Swapping in a real wallet link changes no code.

## How grading really works
The LLM is a **spam, gibberish and coherence filter**, not a translation authority: it checks good-faith effort, plausible target language, on-topic meaning and format, and is told not to fail missing tone marks, dialect or spelling variants. Correctness comes from **peer consensus**: with 2+ workers per item, independent answers are compared and the export labels each row `consensus`, `disputed` or `single`.

## What Nostr does here
- Workers sign in with a Nostr key (NIP-07 extension or a local key); every API call is a signed event.
- Each task announcement is **signed by the requester** and published to relays.
- Every dataset export is SHA-256 hashed and pinned as a signed Nostr event for provenance.
- Reputation is keyed to the Nostr pubkey and public at `/api/reputation/<pubkey>`.

## Security design
- **No custody.** Payments are made from the requester's own wallet over NWC; the spending cap is enforced by their wallet. Tell requesters to set a low cap and revoke the link afterward.
- NWC strings are encrypted at rest (AES-256-GCM, key from `APP_SECRET`) and never sent to browsers.
- Every API call is authenticated with a signed Nostr event (NIP-98 style: bound to URL, method, body hash, 60 s window). No passwords or emails.
- Grader key stays server-side, and grading falls back to a faster model if the preferred one is overloaded (no model available means no payment). Grader output is treated as data, answers are quoted as untrusted. Grader failure = no payment.
- Hidden check items are mixed in and look identical; failing them withholds pay. They never appear in exports.
- Anti-abuse: per-key rate limit, minimum answer time, repeated-answer detection, and a payout cooldown (`PAYOUT_COOLDOWN_SECS`, default 20) before sats move. Not implemented: Lightning hold invoices (NWC does not offer them).
- Per-item payout uniqueness (DB constraint) prevents double pay; per-worker daily cap (`DAILY_CAP_SATS`); 3 attempts per item.

## Known limits
The grader can be wrong, and many Nostr keys could still extract small amounts (bounded by the caps). Tasks are published to relays signed by the app key, tagged with the requester. Data lives in Postgres (Neon), including voice recordings, so the app keeps no local state and can run on serverless hosts.

## Layout
`src/lib` db, crypto, auth (NIP-98), grader, payout (LNURL-pay + NWC), nostr · `src/app/api` routes · `src/app/*` pages. MIT licensed.
