// Sadlier Vocabulary Workshop — Level C (Enriched Edition)
// 300 words across 15 units. Data lives in data_part1/2/3.js (loaded first).
// Each word: { u, w, p, d, syn[], ant[], s (sentence with ____), assoc }

const ALL_WORDS = [].concat(WORDS_PART1, WORDS_PART2, WORDS_PART3);

// Group by unit, preserving order.
const UNITS = {};
ALL_WORDS.forEach((o) => {
  (UNITS[o.u] = UNITS[o.u] || []).push(o);
});
const UNIT_NUMS = Object.keys(UNITS).map(Number).sort((a, b) => a - b);
