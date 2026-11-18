#!/usr/bin/env python3
"""Make a Sats-for-Data text export training-ready: a clean train/test split plus a dataset card.

    python prepare.py export1.jsonl [export2.jsonl ...] --out data/ [--confidence consensus,single]

Rules that keep the evaluation honest:
  * The split is by SOURCE sentence, so a held-out sentence never appears (in any wording) in training.
  * Only rows whose agreement label is in --confidence are kept ("disputed" rows are dropped by default).
  * Several workers' answers to the same source all become training rows, but the test set keeps ONE reference
    per source (the most agreed one), so scores are not inflated by duplicates.
  * The split is deterministic (--seed), so a re-run gives the same test set.
"""
import argparse, hashlib, json, os, random, sys
from collections import defaultdict


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--out", default="data")
    ap.add_argument("--confidence", default="consensus,single", help="comma list of: consensus, single, disputed")
    ap.add_argument("--test-frac", type=float, default=0.15)
    ap.add_argument("--min-test", type=int, default=10, help="refuse to evaluate on fewer held-out sources than this")
    ap.add_argument("--seed", type=int, default=13)
    ap.add_argument("--license", default="Research use only", help="licence the requester set for this data; written into the dataset card")
    ap.add_argument("--name", default="", help="dataset name for the card")
    a = ap.parse_args()

    keep = {c.strip() for c in a.confidence.split(",") if c.strip()}
    rows, dropped = [], 0
    for f in a.files:
        for line in open(f, encoding="utf-8"):
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            if "source" not in r or "target" not in r:
                sys.exit(f"{f}: not a text translation export (needs 'source' and 'target'). Voice exports are not handled here.")
            if r.get("confidence", "single") not in keep or not str(r["source"]).strip() or not str(r["target"]).strip():
                dropped += 1
                continue
            rows.append(r)
    if not rows:
        sys.exit("No usable rows after filtering.")

    pairs = {(r["src_lang"], r["dst_lang"]) for r in rows}
    if len(pairs) > 1:
        sys.exit(f"Mixed language pairs {sorted(pairs)}. Train one pair at a time: pass exports of a single pair.")
    src_lang, dst_lang = next(iter(pairs))

    by_src = defaultdict(list)
    for r in rows:
        by_src[r["source"].strip()].append(r)
    sources = sorted(by_src)
    random.Random(a.seed).shuffle(sources)
    n_test = max(1, round(len(sources) * a.test_frac))
    test_src, train_src = set(sources[:n_test]), sources[n_test:]
    if n_test < a.min_test:
        print(f"WARNING: only {n_test} held-out sources (< {a.min_test}). Scores will be noisy; collect more data before trusting them.", file=sys.stderr)

    rank = {"consensus": 2, "single": 1, "disputed": 0}
    train, test = [], []
    for s in train_src:
        seen = set()
        for r in by_src[s]:
            t = r["target"].strip()
            if t not in seen:
                seen.add(t)
                train.append({"source": s, "target": t})
    for s in sorted(test_src):
        best = max(by_src[s], key=lambda r: (rank.get(r.get("confidence"), 0), r.get("agreement") or 0))
        test.append({"source": s, "target": best["target"].strip()})

    os.makedirs(a.out, exist_ok=True)
    meta = {"src_lang": src_lang, "dst_lang": dst_lang, "seed": a.seed, "confidence_kept": sorted(keep), "rows_dropped": dropped,
            "unique_sources": len(sources), "train_rows": len(train), "test_rows": len(test)}
    for name, data in (("train", train), ("test", test)):
        with open(os.path.join(a.out, f"{name}.jsonl"), "w", encoding="utf-8") as fh:
            fh.write("\n".join(json.dumps(x, ensure_ascii=False) for x in data) + "\n")
    meta["test_sha256"] = hashlib.sha256(open(os.path.join(a.out, "test.jsonl"), "rb").read()).hexdigest()
    json.dump(meta, open(os.path.join(a.out, "meta.json"), "w"), indent=2)
    name = a.name or f"sats-for-data-{src_lang}-{dst_lang}".lower().replace(" ", "-")
    card = f"""---
language: [{src_lang}, {dst_lang}]
license: {a.license}
task_categories: [translation]
---
# {name}

Human-written {src_lang} to {dst_lang} sentence pairs collected on Sats-for-Data, where contributors are paid in bitcoin sats over Lightning.

| | |
|---|---|
| Unique source sentences | {len(sources)} |
| Train rows | {len(train)} |
| Test rows (one reference per held-out source) | {len(test)} |
| Agreement labels kept | {", ".join(sorted(keep))} |
| Split | by source sentence, seed {a.seed}; test set SHA-256 `{meta["test_sha256"]}` |
| Licence | {a.license} |

## Files
`train.jsonl`, `test.jsonl`: one JSON object per line with `source` and `target`. `meta.json`: the counts above.

## How it was made
Contributors answered one item at a time. An automatic filter removed spam and gibberish; it does not judge translation quality. Where several contributors answered the same item, answers were labelled `consensus` or `disputed` by overlap, and disputed rows were dropped here. Hidden check items were excluded. Contributors consented to this use when they took part.

## Limits
Translations are crowd-sourced and not professionally reviewed. Spelling variation, missing tone marks and dialect differences are expected and were deliberately not penalised. Small sets are not representative of the whole language. Please report issues to the requester.
"""
    open(os.path.join(a.out, "DATASET_CARD.md"), "w", encoding="utf-8").write(card)
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
