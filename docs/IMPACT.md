# Usefulness and local impact

## The problem

Two gaps meet here, and one payment network can close both.

1. **People with phones but no way to be paid.** Many young Nigerians have a smartphone and spare time but no bank account, card or route to receive international payments, so online work paid in dollars is out of reach for them.
2. **AI that works poorly in local languages.** Published research describes Nigerian Pidgin, Yoruba and Hausa as low-resource: there is far less machine-readable text and speech than for English, and community-built datasets are the main remedy. See the NaijaNLP survey, the NaijaSenti dataset (about 30,000 annotated tweets across Hausa, Igbo, Yoruba and Pidgin) and the MasakhaNER work listed under Sources.

Bitcoin over Lightning can pay very small amounts instantly to anyone with a wallet, which is what small tasks need. Card-based and bank-based payouts cannot do that economically.

## Who it is for

### Primary user: the worker

An **illustrative persona** (not an interviewee): a university student or recent graduate in a Nigerian city, fluent in Pidgin and either Yoruba or Hausa, with a mid-range Android phone, patchy mobile data and no dollar account.

| | Today | With Sats-for-Data |
|---|---|---|
| Earning from phone skills | Needs a bank or dollar account and an identity check, and fees are high | Create an account in one tap, with no email or phone number |
| A spare 10 minutes | Nothing that pays for that little time | Answer a handful of short items on one screen each |
| Getting paid | Days, minimums, fees | Accepted answers are paid in seconds to a wallet address |
| Knowing where you stand | Opaque | Every rejection shows its reason, and levels unlock better-paid tasks |

### Secondary user: the requester

Groups that need local-language data: research labs, NGOs and public-interest projects, and companies localising a chatbot or voice product. They post a task, fund it from their own capped wallet link, and download a dataset with agreement labels and a provenance hash.

> **Validation status:** we have not interviewed any workers or requesters. The persona and the requester segment are hypotheses. The first validation step is described under "How we would measure it".

## What changes for them

- **A worker** gets a way to turn language knowledge into small, immediate income, and a track record (reputation by account key) that unlocks higher-value work.
- **The language communities** get datasets built by their own speakers, with speaker consent and a stated license.
- **Requesters** get data whose quality is checked by several independent speakers and by hidden gold items, not by a model that may be weak in these languages.

## Reach: an illustrative model

These are **assumptions to test, not measurements**.

Exchange rate used: about ₦86–87 million per BTC (a public price feed, mid-November 2026), so **200 sats ≈ ₦172**. The rate moves daily.

Assumptions: a worker completes **20 accepted items per week**; the reward is **200 sats per item**; each item is answered by **2 workers**.

| Active workers | Accepted answers per week | Paid to workers per week | Sentence pairs with 2-way agreement per month |
|---|---|---|---|
| 50 (a campus pilot) | 1,000 | about ₦172,000 | about 2,000 |
| 500 (several campuses) | 10,000 | about ₦1.72 million | about 20,000 |

- **A worker's income:** 20 items × ₦172 ≈ **₦3,440 per week** of supplemental income. That is modest by design: a flexible top-up, not a salary.
- **A requester's cost:** one verified sentence pair needs two answers, so 2 × 200 sats ≈ **₦344**, or about ₦344,000 per 1,000 pairs, before any quality bonus.

## How we would measure it

A four-week pilot with one campus group, tracking:

| Metric | Why it matters |
|---|---|
| Weekly active workers | Real reach |
| Share of new workers who get a wallet address and receive a first payout | **The biggest risk:** the wallet step. This is the number that decides whether the idea works. |
| Median time from first visit to first sats received | Friction |
| Acceptance rate and share of consensus items | Data quality |
| Payout success rate | Reliability of the payment path |
| Items completed per worker per week | Checks the 20-items assumption |
| Requesters who come back for a second task | Whether anyone wants the data |

## Risks to the claims above

- **The wallet barrier.** Workers need a Lightning wallet address. The app tests an address before work starts and links a plain-language guide, but getting a first wallet is still the largest drop-off risk. Options in the guide include a USSD-based wallet for basic phones, which would need verifying in practice.
- **Demand.** Whether requesters will pay for this data at these prices is untested.
- **Small earnings.** At ₦3,440 per week, motivation will depend on tasks being quick and enjoyable and on cash-out being easy.
- **Rate swings.** Rewards are in sats, so their naira value moves with the exchange rate.

## Sources

- NaijaNLP: a survey of Nigerian low-resource languages, <https://arxiv.org/html/2502.19784v2>
- NaijaSenti: a Nigerian Twitter sentiment corpus, <https://www.lsv.uni-saarland.de/wp-content/uploads/2022/06/lrec2022_NaijaSenti.pdf>
- MasakhaNER: named entity recognition for African languages, <https://arxiv.org/pdf/2103.11811v1.pdf>
