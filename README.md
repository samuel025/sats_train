# ⚡ Sats-for-Data

**Teach AI your language and get paid in sats.** A mobile-first web app where people earn bitcoin (over Lightning) for small language tasks in Nigerian Pidgin, Yoruba, Hausa and English. The code is language-agnostic, with 40+ African languages built in that switch on with one setting (see below). Requesters fund tasks from their own spending-capped wallet link, so the app never holds money. The result is a quality-checked dataset. It builds datasets; it does not train a model.

- **Who it helps and how many:** [docs/IMPACT.md](docs/IMPACT.md)
- **How it can be attacked and what it does about it:** [THREAT_MODEL.md](THREAT_MODEL.md)

## Run it (one command)

Needs only Docker. Payments are simulated, so no wallet or account is required.

```bash
docker compose up --build        # then open http://localhost:3000
npm test                         # unit tests, then an end-to-end test against the running app
```

The app starts with demo tasks of every type already loaded. To turn on the LLM grader, run `GEMINI_API_KEY=... docker compose up --build`; without a key a basic offline grader is used.

### Without Docker
```bash
npm install
npm run setup                    # writes .env.local with fresh secrets and simulated payments
# set NEON_POSTGRES (or DATABASE_URL) in .env.local to any Postgres
npm run dev
```

### Real (sandbox) Lightning payments
Set `MOCK_PAYMENTS=0`. Demo tasks are then paid from a **sandbox wallet** (Alby's NWC faucet: real NWC and Lightning-address payments with play-money sats). `npm run demo:wallet` creates one and saves `DEMO_NWC` in `.env.local`; `npm run demo:wallet -- topup` refills it. Set `SEED_DEMO=1` and the same `DEMO_NWC` on your host. Pointing the app at a real wallet changes no code.

## The flow
1. A **requester** posts a task, connects a spending-capped Nostr Wallet Connect link, and signs the task announcement with their own Nostr key.
2. A **worker** creates an account in one tap (a key kept on their device; no email or phone), passes a short language test if the task needs one, and works one item at a time.
3. Answers are checked, and accepted ones are paid in sats to the worker's wallet address after a short anti-abuse hold.
4. The requester downloads the dataset (JSONL, CSV, or a ZIP with audio) with agreement labels and a SHA-256 hash pinned on Nostr.

## The worker's wallet
Workers can connect their own Lightning wallet with a **read-only** Nostr Wallet Connect link and see, inside the app: their live balance (with a naira value), recent transactions, and a **Receive** button that creates a Lightning invoice with a QR code and detects the payment when it arrives. The server refuses any link that can send money, so it can never spend a worker's funds, and a worker can disconnect at any time. **A connected wallet is also the easiest way to get paid:** the worker's wallet creates the invoice (the app checks it is for exactly the reward), so no Lightning address is needed. A Lightning address still works as a fallback. Payouts show a live Held → Sending → Paid tracker with a "+N sats received" toast. Requesters can press **Check funding** on a task to see its wallet balance, spending cap left, and what the task may still pay, with a warning before it runs short.

## Language-agnostic by design
- **Launch set vs. built-in set:** only English, Nigerian Pidgin, Yoruba and Hausa are on today. To widen it, set `NEXT_PUBLIC_LANGUAGES` at build time to a comma-separated list (e.g. `English,Swahili,Zulu`) or `*` for every registry language plus any typed name. Qualification tests, task validation and demo seeding all follow that setting.
- **Any language:** a task's language is just a name, so no code change is needed to add one.
- **Right-to-left aware:** Arabic, N'Ko, Adlam and other RTL text displays correctly in prompts and answer boxes, even for languages not in the list.
- **Orthography-tolerant checks:** comparison ignores tone marks, special letters (ɛ ɔ ɓ ɗ ƙ ŋ), Arabic vowel marks and spelling variants. The LLM filter is told not to fail dialect, code-switching or non-standard spelling, and to judge only effort and script when it does not know the language.
- **Qualification tests** are written for Pidgin, Hausa, Yoruba, Igbo, Swahili, Zulu and Amharic (the last four activate when their language is enabled). Add one by adding an entry to `src/lib/qualify.ts` and the name to `TEST_LANGS` in `src/lib/languages.ts` (a unit test keeps them in sync). Have a native speaker review any new test. Tasks in other languages work without a test, using hidden check items and several workers per item.
- **Local currency:** amounts show in the worker's own currency (NGN, KES, GHS, ZAR, UGX, TZS, ETB, RWF, XOF, XAF, EGP, MAD, ZMW, USD), guessed from the browser locale and changeable in the header. If the rate feed is down for a currency with no stored value, the figure is hidden rather than invented.

## Training-ready data
Exports are built to be trained on by someone else. [`scripts/dataset/prepare.py`](scripts/dataset/README.md) turns a text export into a train/test split (by source sentence, so nothing leaks) with a dataset card covering counts, licence, how it was made and its limits. Voice exports are already audio plus transcript. Training itself is the requester's next step.

## Task types
| Type | What the worker does | How quality is checked |
|---|---|---|
| Translation / labelling | Types an answer | Spam filter, hidden check items, agreement between workers |
| Voice recording | Reads a sentence aloud (16 kHz WAV) | Audio filter, plus a second qualified listener who types what they hear |
| Preference ranking | Picks the better of two AI replies | Hidden gold items and vote agreement |

Workers have levels (New, Regular, Trusted) and can pass language tests to unlock verification work and gated tasks.

## How grading works
The LLM is a **spam, gibberish and coherence filter**, not a translation authority. It is told not to fail spelling variants, missing tone marks or dialect. Correctness comes from people: several workers answer the same item, listeners verify recordings, and hidden check items catch cheaters. If the preferred model is overloaded the app falls back to a faster one, and if none respond the answer is **not** paid.

## What Nostr does here
- Workers sign in with a Nostr key (browser extension or a key on the device). Every API call is a signed request bound to its URL, method and body.
- Each task is announced as an event **signed by the requester**.
- Every dataset export is hashed and pinned as a signed event, so its origin can be proven.
- Reputation follows the account key and is public at `/api/reputation/<pubkey>`.

## Security at a glance
No custody of funds · read-only wallet links only · NWC links encrypted at rest · invoice amounts verified before paying · server-side request forgery guard on wallet lookups · signed, replay-limited requests · parameterised SQL · validated, bounded inputs · security headers and CSP · fail-closed grading and secrets. Details and known gaps: [THREAT_MODEL.md](THREAT_MODEL.md).

## Configuration
See [.env.example](.env.example). The important ones: `NEON_POSTGRES` / `DATABASE_URL`, `APP_SECRET` (required in production, 16+ characters), `GEMINI_API_KEY`, `MOCK_PAYMENTS`, `DEMO_NWC`.

## Tests
- `npm run test:unit`: address guard, invoice amounts, encryption, tone-mark matching.
- `npm run test:payout`: payouts into a connected wallet (no address), the address fallback, and the requester funding check, against sandbox wallets. Needs internet and a server with `MOCK_PAYMENTS=0 ALLOW_SPENDING_WALLET_LINKS=1 PAYOUT_COOLDOWN_SECS=3 MIN_ANSWER_SECS=1`.
- `npm run test:wallet`: the wallet panel against sandbox wallets (connect, balance, invoice paid by a different wallet, privacy, and refusal of links that can send). Needs internet and a server started with `ALLOW_SPENDING_WALLET_LINKS=1`.
- `npm run test:e2e`: the real flows against a running app in simulated-payment mode (auth, posting, anti-abuse, ranking and payouts, hidden checks, qualification, voice consent, exports and provenance). `BASE_URL` defaults to `http://localhost:3000`.

## Known limits
Not penetration tested. The grader can be wrong, so peer agreement matters. Many keys can still extract small amounts, bounded by each requester's wallet cap. Accepted voice recordings cannot be withdrawn, which the consent screen says plainly; seek legal review before real use. The demo wallet moves play-money sats.

## Layout
`src/lib` db, crypto, auth, grader, payout and wallet safety, nostr · `src/app/api` routes · `src/app` pages · `scripts` tests and helpers · MIT licensed.
