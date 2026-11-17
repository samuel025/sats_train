# Threat model

Sats-for-Data moves small amounts of money between strangers and stores voice recordings, so its design starts from what an attacker could gain and what the app refuses to hold. This document lists what is protected, who might attack it, and what the code does about each threat. **Status** is stated honestly: ✅ implemented and tested, 🟡 partial, ⬜ not done.

## What we protect

| Asset | Why it matters |
|---|---|
| Requester funds | The money paid to workers. |
| Wallet connection links (NWC) | A link can spend from a requester's wallet, up to its limit. |
| Worker accounts and earnings | An account is a private key. Whoever holds it holds the earnings. |
| Voice recordings | Personal data. |
| Dataset integrity | Requesters pay for correct data. |
| Server secrets | `APP_SECRET`, `GEMINI_API_KEY`, database URL. |

## Design principles

1. **Never hold money.** There are no deposits and no balances. Payouts are spent from the requester's own wallet through a spending-capped NWC link. The worst case for a requester is their cap, not their wallet.
2. **Hold secrets only where needed.** NWC links are encrypted at rest and never sent to a browser. The LLM key never leaves the server. Browsers only ever hold their own account key.
3. **Distrust every input.** Everything a client sends is validated, bounded and treated as data, including text that is passed to the LLM.
4. **Fail closed.** If grading, wallet or secret handling fails, nothing is paid and nothing is silently downgraded.

## Trust boundaries

```
Browser  ──signed requests──►  App server  ──►  Postgres
                                   │
                  ┌────────────────┼──────────────────┬───────────────┐
                  ▼                ▼                  ▼               ▼
            Gemini API     Requester's wallet   Worker's wallet   Nostr relays
            (grading)      (NWC, pay_invoice)   (LNURL address)   (public events)
```

Everything outside the app server is untrusted, including the worker's wallet server, which is chosen by the worker.

## Threats and mitigations

### Money

| Threat | Mitigation | Status |
|---|---|---|
| App is breached and requester funds are stolen | No funds are held. Only encrypted, capped links exist. | ✅ |
| NWC link leaks from the database | AES-256-GCM with a random IV per link; the key comes from `APP_SECRET`. The app **refuses to start encrypting in production** without a real secret (no default). | ✅ |
| NWC link leaks to other users | Never returned by any API. Task reads strip it. | ✅ |
| Requester grants more permission than needed | The UI tells requesters to set a spending cap and revoke the link afterwards. The app only ever calls `pay_invoice` (and `get_balance` when resuming a paused task). | 🟡 cannot force the wallet's permission set |
| **Malicious wallet server inflates the invoice** (a worker's Lightning address is hosted on their own server, which could return an invoice for far more than the reward) | The amount in the invoice is decoded and **must equal the reward exactly**, or nothing is paid. | ✅ unit tested |
| **Server-side request forgery** (a worker enters an address whose host resolves to an internal service or cloud metadata) | Wallet lookups go through a guard that allows only public HTTPS on port 443, refuses IP literals, refuses redirects, caps response size, and rejects private, loopback and link-local addresses **inside the connection's own DNS lookup**, so DNS rebinding cannot bypass it. | ✅ unit tested |
| Double payment (retries, replays, race conditions) | A unique database constraint on (item, worker) means one payout per item. Payouts are claimed with an atomic flag before sending. | ✅ |
| Payout stuck if the process dies after claiming it | A payout claimed but not completed stays in `pending` and needs manual review. | 🟡 |
| Requester's wallet runs dry, so workers do unpaid work | Two funding failures pause the task, and workers see it paused. The requester fixes it and resumes, and failed payouts are retried. | ✅ tested |

### Identity and access

| Threat | Mitigation | Status |
|---|---|---|
| Impersonating a user | Every API call carries a signed Nostr event (NIP-98 style) bound to URL path, method and a hash of the body, valid for 60 seconds. Tampered bodies, wrong URLs and stale requests are refused. | ✅ tested |
| Replay of a captured request inside the 60-second window | Most replays are harmless because actions are idempotent or already recorded, but there is no nonce store. | 🟡 |
| Account key stolen from the browser | The key lives in `localStorage`. A content security policy blocks third-party scripts and framing (inline scripts are still allowed, because the framework needs them). A browser extension signer (NIP-07) is supported so the key never touches the page. | 🟡 |
| Losing the key means losing the account | A backup banner appears until the worker saves a key file. There is no recovery by design (no email, no passwords to leak). | 🟡 |
| Reading someone else's recordings | A recording is only served to its speaker, the task's requester, or a reviewer who was assigned that clip. | ✅ |
| Exporting someone else's dataset | Only the requester can export, and hidden check items never leave the server. | ✅ tested |

### Data quality and fraud

| Threat | Mitigation | Status |
|---|---|---|
| Bots and copy-pasting for sats | Minimum answer time, per-key rate limit, repeated-answer detection, copied-prompt detection, and a short payout hold. | ✅ |
| Gaming the grader | Hidden check items with known answers are mixed in. Failing one withholds that worker's payouts. | ✅ tested |
| Prompt injection through an answer or a recording | Answers are wrapped as data and the model is told never to follow instructions inside them. The model only decides pass or fail on a fixed rubric. | ✅ spot-tested with a live model |
| The LLM is wrong about Yoruba, Hausa or Pidgin | The model is a spam and coherence filter, not a translation judge, and is told to pass spelling and tone-mark variants. Correctness comes from several workers answering and from peers verifying recordings. | ✅ by design |
| Grader outage or overload | Falls back to a faster model. If every model fails, the answer is **not** paid. | ✅ observed live |
| Fake verification (reviewers guessing) | The reviewer never sees the expected sentence, must wait most of the clip's length before answering, and is only paid when their transcript matches. | ✅ tested |
| **One person with many keys** | Per-key limits are cheap to bypass, because keys are free. The real bound on losses is the requester's wallet cap. New accounts start at the lowest level and need a language test for gated tasks. | 🟡 no IP or device limits |

### Application

| Threat | Mitigation | Status |
|---|---|---|
| Oversized or malformed input | Reward, item counts, title, instructions, prompts, replies and request bodies all have limits. Languages are checked against a list. Audio must be a WAV of limited size and length. | ✅ tested |
| SQL injection | Every query is parameterised. | ✅ |
| Script injection and clickjacking | Content security policy, `X-Frame-Options`, `nosniff`, referrer and permissions policies, HSTS. React escapes output. | ✅ |
| Secrets in logs | Our code logs only error messages. It never logs keys, wallet links, addresses or answers. | ✅ |
| Secrets in the repository | `.env.local` is ignored. Only `.env.example` with empty values is committed. | ✅ |
| Denial of service on public endpoints | There is no IP-level rate limiting; only the answer and review endpoints are limited per key. Rely on the host's edge protection. | ⬜ rely on the host's edge protection |

### Privacy

| Threat | Mitigation | Status |
|---|---|---|
| Workers are identifiable | Accounts are anonymous keys, with no email, phone or name. | ✅ |
| Recordings used without consent | A consent screen must be accepted before recording. Each task states its data license, and the license is written into the export. | ✅ |
| Withdrawal | Accepted recordings are paid for and become part of the dataset, so they cannot be withdrawn. The consent screen says so before the worker records. Some data protection laws give people withdrawal rights, so a legal review is needed before real use. | 🟡 |

## Not covered (known limits)

- No audit of the third-party libraries beyond using widely used ones (`nostr-tools`, `@getalby/sdk`, `pg`).
- The naira rate comes from a free public API and is only for display.
- The sandbox wallet used for the demo moves play-money sats. The same code path pays any NWC wallet, but a large-scale real-money run has not been done.
- Not penetration tested.

## Reporting

Please open an issue on the repository without including secrets, or contact the maintainers privately for anything sensitive.
