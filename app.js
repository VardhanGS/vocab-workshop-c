"use strict";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const sample = (arr, n) => shuffle(arr).slice(0, n);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const norm = (s) => s.toLowerCase().trim().replace(/[^a-z]/g, "");

// Pick n distinct items from pool that satisfy ok(item); never returns dupes.
function distinct(pool, n, ok) {
  const out = [];
  for (const it of shuffle(pool)) {
    if (out.length >= n) break;
    if (ok(it)) out.push(it);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Modes                                                              */
/* ------------------------------------------------------------------ */
// Each builder returns a question object or null (word not eligible).
// Question shape:
//   { tag, prompt, promptSmall, sub, sayWord, type:"mc"|"type",
//     options:[...], answer, accept:[...], explain }

// Distractor vocab words: words from the pool that are NOT the target,
// not synonyms of it, and not antonyms of it.
function distractorWords(word, pool, n) {
  const banned = new Set([word.w, ...word.vsyn, ...word.vant].map(norm));
  return distinct(pool, n, (o) => !banned.has(norm(o.w))).map((o) => o.w);
}

const MODES = {
  meaning: {
    name: "Right Meaning", emoji: "🎯", desc: "Pick the definition",
    build(word, pool) {
      const wrong = distinct(pool, 3, (o) => o.w !== word.w && o.d !== word.d)
        .map((o) => o.d);
      if (wrong.length < 3) return null;
      return {
        tag: "Choose the meaning", prompt: word.w, sayWord: word.w,
        sub: "What does this word mean?", type: "mc",
        options: shuffle([word.d, ...wrong]), answer: word.d,
        explain: `${cap(word.w)} (${word.p}) — ${word.d}`,
      };
    },
  },

  synMatch: {
    name: "Synonym Match", emoji: "🟰", desc: "Same-meaning vocab word",
    build(word, pool) {
      if (!word.vsyn.length) return null;
      const correct = pick(word.vsyn);
      const wrong = distractorWords(word, pool, 3);
      if (wrong.length < 3) return null;
      return {
        tag: "Synonyms", prompt: word.w, sayWord: word.w,
        sub: `(${word.p}) ${word.d}<br>Pick the vocab word that means the SAME.`,
        type: "mc",
        options: shuffle([correct, ...wrong]), answer: correct,
        explain: `${cap(word.w)} means the same as ${word.vsyn.join(", ")}.`,
      };
    },
  },

  antMatch: {
    name: "Antonym Match", emoji: "↔️", desc: "Opposite vocab word",
    build(word, pool) {
      if (!word.vant.length) return null;
      const correct = pick(word.vant);
      const wrong = distractorWords(word, pool, 3);
      if (wrong.length < 3) return null;
      return {
        tag: "Antonyms", prompt: word.w, sayWord: word.w,
        sub: `(${word.p}) ${word.d}<br>Pick the vocab word that means the OPPOSITE.`,
        type: "mc",
        options: shuffle([correct, ...wrong]), answer: correct,
        explain: `${cap(word.w)} is the opposite of ${word.vant.join(", ")}.`,
      };
    },
  },

  sameOpp: {
    name: "Same or Opposite?", emoji: "⚖️", desc: "Judge the pair",
    build(word, pool) {
      const hasSyn = word.vsyn.length, hasAnt = word.vant.length;
      let other, answer;
      const roll = Math.random();
      if (hasSyn && (roll < 0.34 || !hasAnt)) {
        other = pick(word.vsyn); answer = "Synonyms";
      } else if (hasAnt && roll < 0.67) {
        other = pick(word.vant); answer = "Antonyms";
      } else {
        const d = distractorWords(word, pool, 1);
        if (!d.length) return null;
        other = d[0]; answer = "Unrelated";
      }
      return {
        tag: "Same or opposite?",
        prompt: `${word.w.toUpperCase()} &nbsp;/&nbsp; ${other.toUpperCase()}`,
        promptSmall: true,
        sub: "How are these two words related?",
        sayWord: null, type: "mc",
        options: ["Synonyms", "Antonyms", "Unrelated"], answer,
        explain: `${cap(word.w)} (${word.d}) and ${other} are ${answer.toLowerCase()}.`,
      };
    },
  },

  recall: {
    name: "Recall the Word", emoji: "✍️", desc: "Type from the clue",
    build(word) {
      return {
        tag: "Recall the word",
        prompt: `“${word.assoc}”`, promptSmall: true,
        sub: `(${word.p}) ${word.d}`, sayWord: null, type: "type",
        placeholder: "Type the vocab word...",
        accept: [norm(word.w)], answer: word.w,
        explain: `${cap(word.w)} (${word.p}) — ${word.d}`,
      };
    },
  },

  fill: {
    name: "Fill the Blank", emoji: "🧩", desc: "Word bank sentence",
    build(word, pool) {
      const wrong = distinct(pool, 3, (o) => o.w !== word.w && o.p === word.p);
      const more = distinct(pool, 3 - wrong.length, (o) =>
        o.w !== word.w && !wrong.includes(o));
      const opts = [word, ...wrong, ...more].slice(0, 4).map((o) => o.w);
      if (opts.length < 4) return null;
      return {
        tag: "Fill in the blank", prompt: sentenceHTML(word.s),
        promptSmall: true, sub: "Pick the word from the bank:",
        sayWord: null, type: "mc",
        options: shuffle([...new Set(opts)]), answer: word.w,
        explain: `${cap(word.w)} — ${word.d}`,
      };
    },
  },

  assoc: {
    name: "Word Association", emoji: "💭", desc: "Match the idea",
    build(word, pool) {
      const wrong = distinct(pool, 3, (o) => o.w !== word.w).map((o) => o.w);
      if (wrong.length < 3) return null;
      return {
        tag: "Word association", prompt: `“${word.assoc}”`,
        promptSmall: true, sub: "Which word goes with this idea?",
        sayWord: null, type: "mc",
        options: shuffle([word.w, ...wrong]), answer: word.w,
        explain: `${cap(word.w)} (${word.p}) — ${word.d}`,
      };
    },
  },

  analogy: {
    name: "Analogies", emoji: "🔗", desc: "Complete the pair",
    build(word, pool) {
      // A:B :: C:? where both pairs share the same vocab-to-vocab relation.
      const rel = word.vsyn.length && (!word.vant.length || Math.random() < 0.5)
        ? "vsyn" : "vant";
      if (!word[rel].length) return null;
      const model = distinct(pool, 1, (o) => o.w !== word.w && o[rel].length)[0];
      if (!model) return null;
      const correct = pick(word[rel]);
      const wrong = distractorWords(word, pool, 3);
      if (wrong.length < 3) return null;
      const relWord = rel === "vsyn" ? "same" : "opposite";
      return {
        tag: "Analogies",
        prompt: `${model.w.toUpperCase()} : ${pick(model[rel]).toUpperCase()}  ::  ${word.w.toUpperCase()} : ?`,
        promptSmall: true,
        sub: `The first pair means the ${relWord}. Complete the second pair with a vocab word.`,
        sayWord: null, type: "mc",
        options: shuffle([correct, ...wrong]), answer: correct,
        explain: `${cap(word.w)} ${rel === "vsyn" ? "means the same as" : "is the opposite of"} ${correct}.`,
      };
    },
  },
};

// Order shown on the home grid.
const MODE_ORDER = ["meaning", "synMatch", "antMatch", "fill", "analogy", "assoc", "sameOpp", "recall"];

// Turn "... ____ ..." into HTML with a styled blank.
function sentenceHTML(s) {
  return s.replace(/_{2,}/g, '<span class="blank">_____</span>');
}

/* ------------------------------------------------------------------ */
/* State                                                              */
/* ------------------------------------------------------------------ */
const LS_BEST = "vwc_best";
const LS_TRICKY = "vwc_tricky";

let state = null; // { questions, idx, score, missed, modeKey }

function getTricky() {
  try { return JSON.parse(localStorage.getItem(LS_TRICKY)) || []; }
  catch { return []; }
}
function setTricky(list) {
  localStorage.setItem(LS_TRICKY, JSON.stringify([...new Set(list)].slice(-60)));
}
function addTricky(w) { const t = getTricky(); t.push(w); setTricky(t); }
function removeTricky(w) { setTricky(getTricky().filter((x) => x !== w)); }

/* ------------------------------------------------------------------ */
/* Home                                                               */
/* ------------------------------------------------------------------ */
function buildHome() {
  const sel = $("unitSelect");
  sel.innerHTML = "";
  const all = document.createElement("option");
  all.value = "all"; all.textContent = "All units (1–15) · 300 words";
  sel.appendChild(all);
  UNIT_NUMS.forEach((u) => {
    const o = document.createElement("option");
    o.value = String(u);
    o.textContent = `Unit ${u} · ${UNITS[u].length} words`;
    sel.appendChild(o);
  });

  const grid = $("modeGrid");
  grid.innerHTML = "";
  MODE_ORDER.forEach((key) => {
    const m = MODES[key];
    const b = document.createElement("button");
    b.className = "mode-btn";
    b.innerHTML = `<span class="mode-emoji">${m.emoji}</span>
      <span class="mode-name">${m.name}</span>
      <span class="mode-desc">${m.desc}</span>`;
    b.addEventListener("click", () => startRound(key, currentPool()));
    grid.appendChild(b);
  });

  $("bestScore").textContent = (localStorage.getItem(LS_BEST) || "0") + "%";
  const tricky = getTricky();
  $("reviewCount").textContent = tricky.length;
  $("reviewBtn").classList.toggle("dim", tricky.length === 0);
}

function currentPool() {
  const v = $("unitSelect").value;
  if (v === "all") return ALL_WORDS.slice();
  return UNITS[Number(v)].slice();
}

/* ------------------------------------------------------------------ */
/* Round building                                                     */
/* ------------------------------------------------------------------ */
function startRound(modeKey, pool) {
  const mode = MODES[modeKey];
  const want = Number($("countSelect").value);
  const order = shuffle(pool);
  const questions = [];
  for (const word of order) {
    const q = mode.build(word, pool);
    if (q) { q.word = word; questions.push(q); }
    if (questions.length >= want) break;
  }
  // If a mode skipped many words (e.g. antonyms), top up by reusing pool.
  if (questions.length === 0) {
    alert("Not enough words in this unit for that mode. Try 'All units'.");
    return;
  }
  state = { questions, idx: 0, score: 0, missed: [], modeKey };
  showScreen("quiz");
  renderQuestion();
}

function startTrickyRound() {
  const tricky = getTricky();
  if (!tricky.length) return;
  const pool = ALL_WORDS.filter((o) => tricky.includes(o.w));
  // Mixed modes for review.
  const want = Math.min(pool.length * 2, 20);
  const questions = [];
  let guard = 0;
  while (questions.length < want && guard < 400) {
    guard++;
    const word = pick(pool);
    const mk = pick(MODE_ORDER);
    const q = MODES[mk].build(word, ALL_WORDS);
    if (q) { q.word = word; questions.push(q); }
  }
  if (!questions.length) return;
  state = { questions, idx: 0, score: 0, missed: [], modeKey: "review" };
  showScreen("quiz");
  renderQuestion();
}

/* ------------------------------------------------------------------ */
/* Question rendering                                                 */
/* ------------------------------------------------------------------ */
function renderQuestion() {
  const q = state.questions[state.idx];
  $("modeTag").textContent = q.tag;
  $("prompt").innerHTML = q.prompt;
  $("prompt").classList.toggle("small", !!q.promptSmall);
  $("subPrompt").innerHTML = q.sub || "";
  $("feedback").textContent = "";
  $("feedback").className = "feedback";
  $("nextBtn").classList.add("hidden");

  // speak button only when there's a single word to say
  $("speakBtn").parentElement.classList.toggle("hidden", !q.sayWord);

  const progress = `${state.idx + 1} / ${state.questions.length}`;
  $("progressText").textContent = progress;
  $("progressFill").style.width =
    ((state.idx) / state.questions.length) * 100 + "%";
  $("score").textContent = state.score;

  const optWrap = $("options");
  const form = $("answerForm");
  optWrap.innerHTML = "";

  if (q.type === "mc") {
    form.classList.add("hidden");
    optWrap.classList.remove("hidden");
    q.options.forEach((opt, i) => {
      const b = document.createElement("button");
      b.className = "opt-btn";
      b.innerHTML = `<span class="opt-letter">${"ABCD"[i]}</span>${opt}`;
      b.addEventListener("click", () => answerMc(b, opt, q));
      optWrap.appendChild(b);
    });
  } else {
    optWrap.classList.add("hidden");
    form.classList.remove("hidden");
    const inp = $("answerInput");
    inp.value = "";
    inp.placeholder = q.placeholder || "Type your answer...";
    setTimeout(() => inp.focus(), 50);
  }
}

function answerMc(btn, opt, q) {
  const correct = opt === q.answer;
  [...$("options").children].forEach((b) => {
    b.classList.add("disabled");
    const txt = b.textContent.replace(/^[ABCD]/, "");
    if (txt === q.answer) b.classList.add("correct");
  });
  if (!correct) btn.classList.add("wrong");
  finishQuestion(correct, q);
}

function submitTyped(e) {
  e.preventDefault();
  const q = state.questions[state.idx];
  if (q.type !== "type") return;
  const val = norm($("answerInput").value);
  if (!val) return;
  const correct = q.accept.includes(val);
  $("answerInput").blur();
  finishQuestion(correct, q);
}

function finishQuestion(correct, q) {
  const fb = $("feedback");
  if (correct) {
    state.score++;
    fb.className = "feedback good";
    fb.innerHTML = `✅ Correct! <small>${q.explain}</small>`;
    removeTricky(q.word.w);
  } else {
    state.missed.push(q.word);
    addTricky(q.word.w);
    fb.className = "feedback bad";
    const ans = q.type === "type"
      ? `Answer: <span class="hl">${q.answer}</span>`
      : `Answer: <span class="hl">${q.answer}</span>`;
    fb.innerHTML = `❌ ${ans} <small>${q.explain}</small>`;
  }
  $("score").textContent = state.score;
  $("nextBtn").classList.remove("hidden");
  $("nextBtn").focus();
}

function nextQuestion() {
  state.idx++;
  if (state.idx >= state.questions.length) return finishRound();
  renderQuestion();
}

/* ------------------------------------------------------------------ */
/* Results                                                            */
/* ------------------------------------------------------------------ */
function finishRound() {
  const total = state.questions.length;
  const pct = Math.round((state.score / total) * 100);
  $("resultSummary").innerHTML =
    `You scored <b>${state.score} / ${total}</b> (${pct}%)`;

  const best = Number(localStorage.getItem(LS_BEST) || 0);
  if (pct > best) localStorage.setItem(LS_BEST, String(pct));

  const ml = $("missedList");
  // de-dupe missed words
  const seen = new Set();
  const missed = state.missed.filter((w) => !seen.has(w.w) && seen.add(w.w));
  if (missed.length) {
    ml.innerHTML = "<h3>📌 Review these:</h3>" + missed.map((w) =>
      `<div><span class="mw">${cap(w.w)}</span> <span class="md">— ${w.d}</span></div>`
    ).join("");
  } else {
    ml.innerHTML = "<h3>🌟 Perfect — nothing missed!</h3>";
  }
  showScreen("results");
}

/* ------------------------------------------------------------------ */
/* Speech                                                             */
/* ------------------------------------------------------------------ */
function say(text, rate) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate || 0.9;
  u.lang = "en-US";
  speechSynthesis.speak(u);
}

/* ------------------------------------------------------------------ */
/* Screens / wiring                                                   */
/* ------------------------------------------------------------------ */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(id).classList.add("active");
  window.scrollTo(0, 0);
}

function init() {
  buildHome();
  $("homeBtn").addEventListener("click", () => { showScreen("home"); buildHome(); });
  $("resultsHomeBtn").addEventListener("click", () => { showScreen("home"); buildHome(); });
  $("againBtn").addEventListener("click", () => {
    if (state.modeKey === "review") startTrickyRound();
    else startRound(state.modeKey, currentPool());
  });
  $("nextBtn").addEventListener("click", nextQuestion);
  $("answerForm").addEventListener("submit", submitTyped);
  $("reviewBtn").addEventListener("click", startTrickyRound);
  $("speakBtn").addEventListener("click", () => {
    const q = state && state.questions[state.idx];
    if (q && q.sayWord) say(q.sayWord, 0.85);
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

init();
