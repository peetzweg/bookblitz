import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { paragraphEnds, startsSentence } from "../reader/timing";
import { boldLength, CONTINUOUS, type GuideId } from "./guides";

/** Words kept rendered before and after the current one; the window moves on in paragraph steps. */
const WORDS_BEFORE = 150;
const WORDS_AFTER = 500;
/** How long the text takes to slide up to the next line, for guides that step a line at a time. */
const LINE_MS = 380;
const EASE_OUT = "cubic-bezier(0.33, 1, 0.68, 1)";

interface Props {
  words: string[];
  /** Index of each paragraph's first word. */
  paras: number[];
  /** The frame being read: its first word, and one past its last. */
  word: number;
  end: number;
  guide: GuideId;
  /** Colour each line from one end to the other, alternating, to lead the eye to the next line (BeeLine). */
  gradient?: boolean;
  /** Embolden the first half of each word (Bionic Reading). */
  bold?: boolean;
  playing: boolean;
  /** How far through the frame's words reading is, 0–1, read every animation frame for smooth guides. */
  progress: () => number;
  /** Height of the line being read, as a share of the box. */
  eyeLine?: number;
  /** Receives a test for whether a word starts a line, so the clock can wait for the eye to sweep back. */
  onLineStarts?: (test: ((word: number) => boolean) | null) => void;
}

interface Line {
  top: number;
  height: number;
  left: number;
  right: number;
  /** Line number within its paragraph, for the gradient's alternation. */
  inPara: number;
}

interface Layout {
  /** Index of the first rendered word. */
  first: number;
  spans: HTMLElement[];
  lines: Line[];
  /** Line of each rendered word. */
  lineOf: number[];
  /** For Hops: the left and right edges of the span each word belongs to. */
  hop: { left: number; right: number }[];
}

/**
 * Text on the page with a guide pacing the eye through it. The words render once per window of
 * paragraphs; everything that moves (the guide, the scroll) is positioned directly in the DOM on each
 * word, or each animation frame for continuous guides, without re-rendering the text.
 */
export function GuidedText({ words, paras, word, end, guide, gradient = false, bold = false, playing, progress, eyeLine = 0.4, onLineStarts }: Props) {
  const [win, setWin] = useState(() => windowAround(words, paras, word));
  if (win.words !== words || needsNewWindow(win, paras, words.length, word)) setWin(windowAround(words, paras, word));

  const viewport = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  const layout = useRef<Layout | null>(null);
  const placed = useRef({ line: -1, read: -1, sentence: -1 });
  const paraEnds = useMemo(() => paragraphEnds(paras, words.length), [paras, words]);
  const latest = useRef({ words, paraEnds, word, end, guide, progress, eyeLine });
  latest.current = { words, paraEnds, word, end, guide, progress, eyeLine };

  const text = useMemo(() => {
    const blocks = [];
    for (let p = win.first; p <= win.last; p++) {
      const start = paras[p];
      const stop = p + 1 < paras.length ? paras[p + 1] : words.length;
      const spans = [];
      for (let i = start; i < stop; i++) {
        const w = words[i];
        const cut = bold ? boldLength(w) : 0;
        spans.push(
          <span key={i} className="gw">
            {cut ? (
              <>
                <b>{w.slice(0, cut)}</b>
                {w.slice(cut)}
              </>
            ) : (
              w
            )}
          </span>,
          " ",
        );
      }
      blocks.push(<p key={p}>{spans}</p>);
    }
    return blocks;
  }, [words, paras, win.first, win.last, bold]);

  /** Moves the scroll and the guide to where reading is. `smooth` lets them glide, else they jump. */
  const place = (smooth: boolean) => {
    const L = layout.current;
    const box = viewport.current;
    const content = inner.current;
    if (!L || !box || !content || !L.spans.length) return;
    const { words, paraEnds, word, end, guide, progress, eyeLine } = latest.current;
    const k = clamp(word - L.first, 0, L.spans.length - 1);
    const kEnd = clamp(end - L.first, k + 1, L.spans.length);
    const lineIndex = L.lineOf[k];
    const line = L.lines[lineIndex];
    const newLine = lineIndex !== placed.current.line;
    placed.current.line = lineIndex;
    const continuous = CONTINUOUS.has(guide);
    const point = continuous ? pointAt(L, k, kEnd, words, progress()) : null;

    // The scroll: the line being read sits on the eye line. Scroll rolls on continuously within a line.
    let centre = line.top + line.height / 2;
    if (guide === "scroll" && point) {
      const next = L.lines[lineIndex + 1];
      const along = clamp((point.x - line.left) / Math.max(line.right - line.left, 1), 0, 1);
      if (next) centre += (next.top + next.height / 2 - centre) * along;
    }
    const y = box.clientHeight * eyeLine - centre;
    content.style.transition = smooth && newLine && !continuous ? `transform ${LINE_MS}ms ${EASE_OUT}` : "none";
    content.style.transform = `translateY(${y}px)`;

    const m = mark.current;
    if (m) {
      // A guide that steps word by word slides between words, but jumps to a new line.
      const glide = smooth && !newLine && !continuous;
      if (guide === "highlight") {
        let left = Infinity;
        let right = -Infinity;
        for (let i = k; i < kEnd; i++) {
          if (L.lineOf[i] !== lineIndex) continue;
          left = Math.min(left, L.spans[i].offsetLeft);
          right = Math.max(right, L.spans[i].offsetLeft + L.spans[i].offsetWidth);
        }
        setBox(m, left, line.top, right - left, line.height, glide ? 90 : 0);
      } else if (guide === "hops") {
        const h = L.hop[k];
        setBox(m, h.left, line.top, h.right - h.left, line.height, glide ? 140 : 0);
      } else if (guide === "focus") {
        setBox(m, 0, line.top, content.clientWidth, line.height, smooth ? 200 : 0);
      } else if (guide === "pacer" && point) {
        setBox(m, point.x, line.top + line.height, 0, 0, 0);
      }
    }

    // Line focus keeps a window of three lines clear, the current one in the middle, and dims the rest.
    if (guide === "focus" && newLine) {
      for (let i = 0; i < L.spans.length; i++) L.spans[i].classList.toggle("gw-off", Math.abs(L.lineOf[i] - lineIndex) > 1);
    }

    // Sentence spotlight: only the sentence being read is at full strength.
    if (guide === "sentence") {
      let from = word;
      while (from > 0 && !startsSentence(words, from, paraEnds)) from--;
      if (from !== placed.current.sentence) {
        placed.current.sentence = from;
        let to = word + 1;
        while (to < words.length && !startsSentence(words, to, paraEnds)) to++;
        for (let i = 0; i < L.spans.length; i++) L.spans[i].classList.toggle("gw-off", L.first + i < from || L.first + i >= to);
      }
    }

    if (guide === "cover") {
      // Words behind the reading point fade; only the ones that changed are touched.
      const from = placed.current.read < 0 ? 0 : Math.min(placed.current.read, k);
      const to = placed.current.read < 0 ? L.spans.length : Math.max(placed.current.read, k);
      for (let i = from; i < to; i++) L.spans[i].classList.toggle("gw-read", i < k);
      placed.current.read = k;
    }
  };

  // Measure lines after the text renders, when the box resizes, and when fonts load.
  useLayoutEffect(() => {
    const content = inner.current;
    if (!content) return;
    const measure = () => {
      layout.current = measureLayout(content, paras[win.first], paras, gradient);
      for (const span of layout.current.spans) {
        if (guide !== "cover") span.classList.remove("gw-read");
        if (guide !== "focus" && guide !== "sentence") span.classList.remove("gw-off");
      }
      placed.current = { line: -1, read: -1, sentence: -1 };
      place(false);
    };
    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(content);
    return () => observer.disconnect();
  }, [text, gradient, guide]);

  useEffect(() => {
    if (!onLineStarts) return;
    onLineStarts((w) => {
      const L = layout.current;
      const k = L ? w - L.first : -1;
      return !!L && k > 0 && k < L.lineOf.length && L.lineOf[k] !== L.lineOf[k - 1];
    });
    return () => onLineStarts(null);
  }, [onLineStarts]);

  // Every new frame.
  useLayoutEffect(() => place(true), [word, end, eyeLine]);

  // Continuous guides move every animation frame while reading.
  useEffect(() => {
    if (!playing || !CONTINUOUS.has(guide)) return;
    let frame = requestAnimationFrame(function tick() {
      place(false);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, guide]);

  return (
    <div className={`guided guide-${guide}`} ref={viewport}>
      <div className="guided-text" ref={inner}>
        {text}
        <div className="guided-mark" ref={mark} />
      </div>
      {guide === "scroll" && <div className="guided-eyeline" style={{ top: `${eyeLine * 100}%` }} />}
    </div>
  );
}

function setBox(el: HTMLElement, left: number, top: number, width: number, height: number, ms: number) {
  el.style.transition = ms ? `transform ${ms}ms ${EASE_OUT}, width ${ms}ms ${EASE_OUT}` : "none";
  el.style.transform = `translate(${left}px, ${top}px)`;
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
}

/**
 * Where the eye is at `fraction` of the way through words k…kEnd: a point moving across each word and
 * the space after it, at a speed proportional to letters, as a finger would.
 */
function pointAt(L: Layout, k: number, kEnd: number, words: string[], fraction: number) {
  let total = 0;
  for (let i = k; i < kEnd; i++) total += words[L.first + i].length + 1;
  let left = fraction * total;
  for (let i = k; i < kEnd; i++) {
    const size = words[L.first + i].length + 1;
    if (left <= size || i === kEnd - 1) {
      const span = L.spans[i];
      const next = L.spans[i + 1];
      const stop = next && L.lineOf[i + 1] === L.lineOf[i] ? next.offsetLeft : span.offsetLeft + span.offsetWidth;
      return { x: span.offsetLeft + (stop - span.offsetLeft) * clamp(left / size, 0, 1), line: L.lineOf[i] };
    }
    left -= size;
  }
  return null;
}

function measureLayout(content: HTMLElement, first: number, paras: number[], gradient: boolean): Layout {
  const spans = [...content.querySelectorAll<HTMLElement>(".gw")];
  const lines: Line[] = [];
  const lineOf: number[] = [];
  let para = paragraphOf(paras, first);
  let inPara = -1;
  for (let i = 0; i < spans.length; i++) {
    const s = spans[i];
    const top = s.offsetTop;
    const last = lines[lines.length - 1];
    const startsPara = paras[para + 1] === first + i;
    if (startsPara) {
      para++;
      inPara = -1;
    }
    if (!last || startsPara || top > last.top + last.height / 2) {
      inPara++;
      lines.push({ top, height: s.offsetHeight, left: s.offsetLeft, right: s.offsetLeft + s.offsetWidth, inPara });
    } else {
      last.right = s.offsetLeft + s.offsetWidth;
    }
    lineOf.push(lines.length - 1);
  }

  // Hops: each line splits into spans of about a third of the column; short lines get fewer.
  const column = content.clientWidth || 1;
  const hop: Layout["hop"] = [];
  for (let i = 0; i < spans.length; ) {
    const line = lines[lineOf[i]];
    const parts = Math.max(1, Math.round((line.right - line.left) / (column / 3)));
    const width = (line.right - line.left) / parts;
    let j = i;
    while (j < spans.length && lineOf[j] === lineOf[i]) {
      const part = Math.min(parts - 1, Math.floor((spans[j].offsetLeft + spans[j].offsetWidth / 2 - line.left) / width));
      let e = j;
      while (e + 1 < spans.length && lineOf[e + 1] === lineOf[i]) {
        const s = spans[e + 1];
        if (Math.min(parts - 1, Math.floor((s.offsetLeft + s.offsetWidth / 2 - line.left) / width)) !== part) break;
        e++;
      }
      const box = { left: spans[j].offsetLeft, right: spans[e].offsetLeft + spans[e].offsetWidth };
      for (let n = j; n <= e; n++) hop[n] = box;
      j = e + 1;
    }
    i = j;
  }

  // BeeLine-style gradient: dark → blue, blue → dark, dark → red, red → dark, so the end of each line
  // matches the start of the next.
  for (let i = 0; i < spans.length; i++) {
    if (!gradient) {
      spans[i].style.color = "";
      continue;
    }
    const line = lines[lineOf[i]];
    const cycle = line.inPara % 4;
    const ink = "rgb(var(--ink))";
    const from = cycle === 1 ? "var(--bee-blue)" : cycle === 3 ? "var(--bee-red)" : ink;
    const to = cycle === 0 ? "var(--bee-blue)" : cycle === 2 ? "var(--bee-red)" : ink;
    const along = (spans[i].offsetLeft + spans[i].offsetWidth / 2 - line.left) / Math.max(line.right - line.left, 1);
    spans[i].style.color = `color-mix(in oklab, ${to} ${Math.round(clamp(along, 0, 1) * 100)}%, ${from})`;
  }

  return { first, spans, lines, lineOf, hop };
}

interface Window {
  words: string[];
  first: number;
  last: number;
}

function windowAround(words: string[], paras: number[], word: number): Window {
  const p = paragraphOf(paras, word);
  let first = p;
  while (first > 0 && word - paras[first] < WORDS_BEFORE) first--;
  let last = p;
  while (last < paras.length - 1 && paraEnd(paras, words.length, last) - word < WORDS_AFTER) last++;
  return { words, first, last };
}

/** Moves the window on when reading gets near either end of it, a few paragraphs at a time. */
function needsNewWindow(win: Window, paras: number[], total: number, word: number) {
  const start = paras[win.first];
  const stop = paraEnd(paras, total, win.last);
  if (word < start || word >= stop) return true;
  if (win.last < paras.length - 1 && stop - word < WORDS_AFTER / 3) return true;
  return win.first > 0 && word - start < WORDS_BEFORE / 3;
}

const paraEnd = (paras: number[], total: number, p: number) => (p + 1 < paras.length ? paras[p + 1] : total);

function paragraphOf(paras: number[], word: number) {
  let lo = 0;
  let hi = paras.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (paras[mid] <= word) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}
