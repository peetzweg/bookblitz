import { db, type BookMeta, type ChapterContent } from "../store/db";
import { library, markOpened, saveProgress, updateSettings } from "../store/library";
import { createStore } from "../store/store";
import { setEstimateWeight } from "./rsvp";
import {
  buildFrames,
  DEFAULT_STYLE,
  frameDurationMs,
  frameIndexOf,
  paragraphEnds,
  rampFactor,
  startsSentence,
  STYLES,
  type ReadingStyle,
} from "./timing";

interface ReaderState {
  book?: BookMeta;
  content?: ChapterContent[];
  chapter: number;
  /** First word of the frame on screen. Progress, bookmarks and the context view all work in words. */
  word: number;
  /** One past the last word of the frame on screen: `word + 1` for one-word styles. */
  frameEnd: number;
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
  /** Play was pressed before any reading style was picked: show the taste test first. */
  askStyle: boolean;
}

export const reader = createStore<ReaderState>({
  chapter: 0,
  word: 0,
  frameEnd: 1,
  playing: false,
  open: false,
  rate: null,
  completed: null,
  askStyle: false,
});

const SAVE_EVERY_MS = 3000;
/** Longest frame we account for, so a stalled tab doesn't fire a burst of words. */
const MAX_FRAME_MS = 250;

let frame: number | undefined;
let lastFrame = 0;
/** How far through the current frame's display time we are, from 0 to 1. */
let frameProgress = 0;
/** Frames shown since play was pressed, for the ramp-up. */
let framesInRun = 0;
let lastSave = 0;
let paraEnds = new Set<number>();
/** Start word of every frame in the current chapter, for the current style. */
let frameStarts: number[] = [0];
let styleId = library.get().settings.style;

export function currentStyle(): ReadingStyle {
  return STYLES[library.get().settings.style ?? DEFAULT_STYLE] ?? STYLES[DEFAULT_STYLE];
}
let wakeLock: WakeLockSentinel | undefined;

export async function openBook(id: string, opts: { chapter?: number; word?: number; open?: boolean } = {}) {
  const current = reader.get();
  if (current.book?.id !== id) {
    pause();
    const [book, content] = await Promise.all([db.book(id), db.content(id)]);
    if (!book || !content) return;
    const saved = library.get().progress[id];
    reader.set({ book, content, chapter: saved?.chapter ?? 0, word: saved?.word ?? 0, completed: null });
    indexChapter();
    updateSettings({ lastBookId: id });
  }
  if (opts.chapter !== undefined) seek(opts.chapter, opts.word ?? 0);
  if (opts.open ?? true) {
    reader.set({ open: true });
    markOpened(id);
  }
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
  // The first read starts with picking a style, so people feel the options before settling on one.
  if (!library.get().settings.styleChosen) return reader.set({ askStyle: true, open: true });
  // Pressing play at the very end starts the book over, like an album.
  if (chapter === content.length - 1 && word >= content[chapter].words.length - 1) seek(0, 0);
  framesInRun = 0;
  frameProgress = 0;
  reader.set({ playing: true, completed: null, askStyle: false });
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
  reader.set({ chapter: c, completed: null });
  if (chapterChanged) indexChapter();
  showFrameAt(w);
  framesInRun = 0;
  frameProgress = 0;
  if (save) persist();
}

/** Jumps to the start of the previous (-1) or next (+1) sentence. */
export function stepSentence(direction: -1 | 1) {
  const { content, chapter, word } = reader.get();
  if (!content) return;
  const words = content[chapter].words;
  const isStart = (i: number) => startsSentence(words, i, paraEnds);

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
    const style = currentStyle();
    const words = state.content[state.chapter].words;
    // Pauses, length bonuses and the ramp-up only make sense reading forwards; backwards is a scan.
    const duration = forward
      ? frameDurationMs(words, state.word, state.frameEnd, paraEnds, style, rate, rampFactor(framesInRun, style))
      : ((state.frameEnd - state.word) * 60000) / -rate;
    frameProgress += dt / duration;
    if (frameProgress >= 1) {
      frameProgress = Math.min(frameProgress - 1, 0.5);
      step(forward);
      if (!reader.get().playing) return;
    }
  }
  frame = requestAnimationFrame(tick);
}

function step(forward: boolean) {
  const { content, word } = reader.get();
  if (!content) return;
  const index = frameIndexOf(frameStarts, word);
  if (forward) {
    if (index >= frameStarts.length - 1) return completeChapter();
    showFrame(index + 1);
    framesInRun++;
  } else if (index > 0) {
    // Reading backwards holds at the start of the chapter rather than crossing into the previous one.
    showFrame(index - 1);
  }
  if (Date.now() - lastSave > SAVE_EVERY_MS) persist();
}

function showFrame(index: number) {
  const { content, chapter } = reader.get();
  const total = content?.[chapter]?.words.length ?? 1;
  reader.set({ word: frameStarts[index], frameEnd: frameStarts[index + 1] ?? total });
}

/** Shows the frame that contains `word`. */
function showFrameAt(word: number) {
  showFrame(frameIndexOf(frameStarts, word));
}

/** Each chapter is its own session: stop at the end, celebrate, and wait on the next one. */
function completeChapter() {
  const { content, chapter } = reader.get();
  if (!content) return;
  pause();
  if (chapter < content.length - 1) seek(chapter + 1, 0);
  reader.set({ completed: chapter });
}

/** Works out paragraph ends and frames for the current chapter and style, keeping the current place. */
function indexChapter() {
  const { content, chapter, word } = reader.get();
  const current = content?.[chapter];
  if (!current) return;
  paraEnds = paragraphEnds(current.paras, current.words.length);
  frameStarts = buildFrames(current.words, paraEnds, currentStyle());
  showFrameAt(word);
}

// Switching styles mid-chapter re-cuts the frames around the current word.
setEstimateWeight(currentStyle().meanWeight);
library.subscribe(() => {
  const next = library.get().settings.style;
  if (next === styleId) return;
  styleId = next;
  setEstimateWeight(currentStyle().meanWeight);
  indexChapter();
});

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
