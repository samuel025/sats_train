# Make an export training-ready

Sats-for-Data builds the dataset; it does not train a model. This script makes a text export ready for whoever does.

```bash
# Download a text export for ONE language pair from the app (Wallet > Export, JSONL), then:
python scripts/dataset/prepare.py my_export.jsonl --out data/ --license "Research use only"
```

Output in `data/`: `train.jsonl`, `test.jsonl`, `meta.json` and a `DATASET_CARD.md` (counts, how it was made, licence, limits).
No dependencies beyond Python 3.

What it guarantees
- The split is by **source sentence**, so no held-out sentence leaks into training through another worker's wording.
- `disputed` rows are dropped by default (`--confidence` changes that). Hidden check items never appear in exports.
- The test set keeps one reference per source, and the split is seeded; its SHA-256 is in the card so results can be compared.
- A warning is printed when the held-out set is under 10 sentences.

Voice exports (ZIP with 16 kHz WAV + `dataset.jsonl`) are already in a standard audio-plus-transcript layout and are used as they are.
