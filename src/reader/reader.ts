import { db, type BookMeta, type ChapterContent } from "../store/db";
import { library, markOpened, saveProgress, updateSettings } from "../store/library";
import { createStore } from "../store/store";
import { baseInterval, endsSentence, wordWeight } from "./rsvp";

interface ReaderState {
  book?: BookMeta;
  content?: ChapterContent[];
  chapter: number;
  word: number;
  playing: boolean;
  /** Whether the full-screen Now Reading sheet is showing. */
  open: boolean;
  /**
   * Live speed while the speed gesture is held, in signed words per minute: negative reads backwards,
   * 0 holds still. `null` means the normal speed from settings.
   */
  rate: number | null;
  /** Index of the chapter that was just finished, while its completion screen shows. */
  completed: number | null;
}

export const reader = createStore<ReaderState>({
  chapter: 0,
  word: 0,
  playing: false,
  open: false,
  rate: null,
  completed: null,
});

const SAVE_EVERY_MS = 3000;
const RAMP_WORDS = 5;
/** Longest frame we account for, so a stalled tab doesn't fire a burst of words. */
const MAX_FRAME_MS = 250;

let frame: number | undefined;
let lastFrame = 0;
/** How far through the current word's display time we are, from 0 to 1. */
let wordProgress = 0;
let rampIndex = 0;
let lastSave = 0;
let paraEnds = new Set<number>();
let wakeLock: WakeLockSentinel | undefined;

export async function openBook(id: string, opts: { chapter?: number; word?: number; open?: boolean } = {}) {
  const current = reader.get();
  if (current.book?.id !== id) {
    pause();
    const [book, content] = await Promise.all([db.book(id), db.content(id)]);
    if (!book || !content) return;
    const saved = library.get().progress[id];
    reader.set({ book, content, chapter: saved?.chapter ?? 0, word: saved?.word ?? 0, completed: null });
    updateSettings({ lastBookId: id });
  }
  if (opts.chapter !== undefined) seek(opts.chapter, opts.word ?? 0);
  if (opts.open ?? true) {
    reader.set({ open: true });
    markOpened(id);
  }
  indexParagraphs();
}

export function closeBook() {
  pause();
  reader.set({ book: undefined, content: undefined, open: false, chapter: 0, word: 0 });
}

export function setOpen(open: boolean) {
  reader.set(open ? { open } : { open, completed: null });
}

export function play() {
  const { content, chapter, word, playing } = reader.get();
  if (!content || playing) return;
  // Pressing play at the very end starts the book over, like an album.
  if (chapter === content.length - 1 && word >= content[chapter].words.length - 1) seek(0, 0);
  rampIndex = 0;
  wordProgress = 0;
  reader.set({ playing: true, completed: null });
  acquireWakeLock();
  lastFrame = performance.now();
  frame = requestAnimationFrame(tick);
}

export function pause() {
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = undefined;
  if (!reader.get().playing) return;
  reader.set({ playing: false, rate: null });
  persist();
  releaseWakeLock();
}

export function toggle() {
  if (reader.get().playing) pause();
  else play();
}

export function seek(chapter: number, word: number, save = true) {
  const { content } = reader.get();
  if (!content) return;
  const c = clamp(chapter, 0, content.length - 1);
  const w = clamp(word, 0, content[c].words.length - 1);
  const chapterChanged = c !== reader.get().chapter;
  reader.set({ chapter: c, word: w, completed: null });
  if (chapterChanged) indexParagraphs();
  rampIndex = 0;
  wordProgress = 0;
  if (save) persist();
}

/** Jumps to the start of the previous (-1) or next (+1) sentence. */
export function stepSentence(direction: -1 | 1) {
  const { content, chapter, word } = reader.get();
  if (!content) return;
  const words = content[chapter].words;
  const isStart = (i: number) => i === 0 || endsSentence(words[i - 1]) || paraEnds.has(i - 1);

  if (direction === 1) {
    for (let i = word + 1; i < words.length; i++) if (isStart(i)) return seek(chapter, i);
    if (chapter < content.length - 1) seek(chapter + 1, 0);
    return;
  }
  let i = word;
  while (i > 0 && !isStart(i)) i--;
  // Mid-sentence: back to its start. Near its start already: back one more sentence.
  if (word - i > 2) return seek(chapter, i);
  if (i === 0) {
    if (chapter === 0) return seek(0, 0);
    seek(chapter - 1, content[chapter - 1].words.length - 1);
    return stepSentence(-1);
  }
  i--;
  while (i > 0 && !isStart(i)) i--;
  seek(chapter, i);
}

export function setWpm(wpm: number) {
  updateSettings({ wpm });
}

/** Overrides the speed while the speed gesture is held; pass `null` to go back to the normal speed. */
export function setLiveRate(rate: number | null) {
  reader.set({ rate });
}

function tick(now: number) {
  const dt = Math.min(now - lastFrame, MAX_FRAME_MS);
  lastFrame = now;
  const state = reader.get();
  if (!state.playing || !state.content) return;

  const rate = state.rate ?? library.get().settings.wpm;
  if (rate !== 0) {
    const forward = rate > 0;
    const word = state.content[state.chapter].words[state.word];
    // Pauses for punctuation and the ramp-up only make sense reading forwards.
    const weight = forward ? wordWeight(word, paraEnds.has(state.word)) : 1;
    const ramp = forward && rampIndex < RAMP_WORDS ? 1 + 0.8 * ((RAMP_WORDS - rampIndex) / RAMP_WORDS) : 1;
    wordProgress += dt / (baseInterval(Math.abs(rate)) * weight * ramp);
    if (wordProgress >= 1) {
      wordProgress = Math.min(wordProgress - 1, 0.5);
      step(forward);
      if (!reader.get().playing) return;
    }
  }
  frame = requestAnimationFrame(tick);
}

function step(forward: boolean) {
  const { content, chapter, word } = reader.get();
  if (!content) return;
  if (forward) {
    if (word >= content[chapter].words.length - 1) return completeChapter();
    reader.set({ word: word + 1 });
    rampIndex++;
  } else if (word > 0) {
    // Reading backwards holds at the start of the chapter rather than crossing into the previous one.
    reader.set({ word: word - 1 });
  }
  if (Date.now() - lastSave > SAVE_EVERY_MS) persist();
}

/** Each chapter is its own session: stop at the end, celebrate, and wait on the next one. */
function completeChapter() {
  const { content, chapter } = reader.get();
  if (!content) return;
  pause();
  if (chapter < content.length - 1) seek(chapter + 1, 0);
  reader.set({ completed: chapter });
}

function indexParagraphs() {
  const { content, chapter } = reader.get();
  const paras = content?.[chapter]?.paras ?? [];
  // A paragraph ends on the word before the next one starts.
  paraEnds = new Set(paras.map((p) => p - 1).filter((p) => p >= 0));
  const total = content?.[chapter]?.words.length ?? 0;
  if (total) paraEnds.add(total - 1);
}

function persist() {
  const { book, content, chapter, word } = reader.get();
  if (!book || !content) return;
  lastSave = Date.now();
  const last = content.length - 1;
  const finished = chapter === last && word >= content[last].words.length - 1;
  saveProgress(book.id, { chapter, word, updatedAt: lastSave, ...(finished && { finished }) });
}

async function acquireWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request("screen");
  } catch {
    // Not supported or denied; reading still works, the screen may just dim.
  }
}

function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = undefined;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") pause();
  });
  window.addEventListener("pagehide", persist);
}
