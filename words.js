// Sadlier Vocabulary Workshop — Level C (Enriched Edition)
// 300 words across 15 units. Data lives in data_part1/2/3.js (loaded first).
// Each word: { u, w, p, d, syn[], ant[], s (sentence with ____), assoc }

const ALL_WORDS = [].concat(WORDS_PART1, WORDS_PART2, WORDS_PART3);

// Build vocab-to-vocab synonym/antonym maps from relations.js.
// Synonyms are symmetric within each group; antonyms are symmetric per pair.
const VSYN = {};
const VANT = {};
function relAdd(map, a, b) {
  (map[a] = map[a] || []);
  if (a !== b && map[a].indexOf(b) === -1) map[a].push(b);
}
SYN_GROUPS.forEach((g) => {
  g.forEach((a) => g.forEach((b) => relAdd(VSYN, a, b)));
});
ANT_PAIRS.forEach(([a, b]) => {
  relAdd(VANT, a, b);
  relAdd(VANT, b, a);
});
// Attach the vocab-derived lists to each word.
ALL_WORDS.forEach((o) => {
  o.vsyn = VSYN[o.w] || [];
  o.vant = VANT[o.w] || [];
});

// Group by unit, preserving order.
const UNITS = {};
ALL_WORDS.forEach((o) => {
  (UNITS[o.u] = UNITS[o.u] || []).push(o);
});
const UNIT_NUMS = Object.keys(UNITS).map(Number).sort((a, b) => a - b);
