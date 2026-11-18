// Text helpers shared by grading and peer verification.
// fold(): lowercase, strip tone marks/diacritics and punctuation, so "Ẹ káàárọ̀" and "e kaaaro" compare equal.
// Also folds letters used across African orthographies (ɛ ɔ ɓ ɗ ƙ ŋ ɲ ʋ ɖ ɣ ...), Arabic vowel marks and elongation, and apostrophe-like marks.
const MAP: Record<string, string> = { ɛ: "e", ɔ: "o", ɓ: "b", ɗ: "d", ɖ: "d", ƙ: "k", ƴ: "y", ŋ: "ng", ɲ: "ny", ʋ: "v", ɣ: "g", ɩ: "i", ʊ: "u", ṣ: "s", ɨ: "i", ə: "e", ǝ: "e", ــ: "" };
export const fold = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[ɛɔɓɗɖƙƴŋɲʋɣɩʊṣɨəǝـ]/gu, (c) => MAP[c] ?? c)
    .replace(/[أإآٱ]/gu, "ا").replace(/ى/gu, "ي").replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();

// Levenshtein similarity in 0..1 on folded text.
export function similarity(a: string, b: string) {
  const x = fold(a), y = fold(b);
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  const m = x.length, n = y.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}
