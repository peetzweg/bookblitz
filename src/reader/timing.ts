/**
 * How text is cut into frames (what is on screen at once) and how long each frame stays up.
 * Pure functions, shared by the reader and the reading-style previews, so a preview is exactly what
 * reading will feel like.
 *
 * Values and formulas come from docs/research/speed-reading.md (§5); the section numbers below point
 * into it.
 */

export type StyleId = "flow" | "phrases" | "calm";

export interface ReadingStyle {
  id: StyleId;
  name: string;
  /** One line under the name in the picker. */
  tagline: string;
  /** Suggested speed, used the first time the style is picked. */
  defaultWpm: number;
  /** Words on screen at once; 1 is classic one-word RSVP. */
  maxWords: number;
  /** A frame never grows past this many characters (spaces included). */
  maxChars: number;
  /** Letters a word may have before it gets extra time. */
  lengthFrom: number;
  /** Extra time per letter beyond `lengthFrom`, in word slots. */
  perLetter: number;
  /** Cap on the length bonus. */
  maxLengthBonus: number;
  /** Time for a word of 1–3 letters on its own. */
  shortWord: number;
  /** Time for a function word riding along inside a phrase. */
  functionWord: number;
  /** Extra time for a word containing digits. */
  digits: number;
  /** A frame is never shorter than this many word slots. */
  minFrameWeight: number;
  /** Extra time after a clause, sentence and paragraph end, in word slots; paragraph replaces sentence. */
  pauses: { clause: number; sentence: number; paragraph: number };
  /** Pauses never drop below these, so they survive high speeds (Masson 1983: 500–1000ms helps). */
  pauseFloorMs: { clause: number; sentence: number; paragraph: number };
  /** Frames that start slower after pressing play or jumping, easing up to full speed. */
  rampFrames: number;
  /** Average time per word across real prose, for "time left" estimates (measured, §5.2). */
  meanWeight: number;
}

export const STYLES: Record<StyleId, ReadingStyle> = {
  flow: {
    id: "flow",
    name: "Flow",
    tagline: "One word at a time; long words and sentence ends get the time they need",
    defaultWpm: 300,
    maxWords: 1,
    maxChars: 40,
    lengthFrom: 5,
    perLetter: 0.1,
    maxLengthBonus: 1.2,
    shortWord: 0.85,
    functionWord: 0.85,
    digits: 0.4,
    minFrameWeight: 0,
    pauses: { clause: 0.6, sentence: 1.5, paragraph: 2.5 },
    pauseFloorMs: { clause: 90, sentence: 250, paragraph: 450 },
    rampFrames: 6,
    meanWeight: 1.16,
  },
  phrases: {
    id: "phrases",
    name: "Phrases",
    tagline: "Short words ride with the next word, so you read in phrases",
    defaultWpm: 340,
    maxWords: 3,
    maxChars: 16,
    lengthFrom: 5,
    perLetter: 0.1,
    maxLengthBonus: 1.2,
    shortWord: 0.85,
    functionWord: 0.5,
    digits: 0.4,
    minFrameWeight: 1,
    pauses: { clause: 0.6, sentence: 1.5, paragraph: 2.5 },
    pauseFloorMs: { clause: 90, sentence: 250, paragraph: 450 },
    rampFrames: 4,
    meanWeight: 1.04,
  },
  calm: {
    id: "calm",
    name: "Calm",
    tagline: "Slower, with generous pauses, for dense or unfamiliar text",
    defaultWpm: 260,
    maxWords: 1,
    maxChars: 40,
    lengthFrom: 4,
    perLetter: 0.12,
    maxLengthBonus: 1.6,
    shortWord: 1,
    functionWord: 1,
    digits: 0.6,
    minFrameWeight: 0,
    pauses: { clause: 1, sentence: 2.2, paragraph: 3.5 },
    pauseFloorMs: { clause: 150, sentence: 400, paragraph: 700 },
    rampFrames: 8,
    meanWeight: 1.36,
  },
};

export const DEFAULT_STYLE: StyleId = "flow";

const TRAILING_CLOSERS = /["'”’»)\]}*]+$/;
const bare = (word: string) => word.replace(TRAILING_CLOSERS, "");
const letters = (word: string) => word.replace(/[^\p{L}\p{N}]/gu, "").length;

/** Full stops that don't end a sentence. */
const ABBREVIATIONS = new Set("mr mrs ms dr st jr sr prof vs etc e.g i.e cf no vol p pp ch fig".split(" "));

function endsWithSentence(word: string) {
  const w = bare(word);
  if (/[!?…]$/.test(w)) return true;
  if (!w.endsWith(".")) return false;
  return !ABBREVIATIONS.has(w.slice(0, -1).replace(/^[^\p{L}]+/u, "").toLowerCase());
}

const endsWithClause = (word: string) => /[,;:—–]$/.test(bare(word));

/** Common English function words; anything of two letters or fewer counts too, as a cross-language fallback. */
const FUNCTION_WORDS = new Set(
  "a an the of to in on at by for from with as into onto upon about over under after before than and or but nor so if that this these those its his her their our your my is was are were be been".split(" "),
);

function isFunctionWord(word: string) {
  const core = bare(word).replace(/^[^\p{L}]+/u, "").toLowerCase();
  return FUNCTION_WORDS.has(core) || letters(core) <= 2;
}

const isNumber = (word: string) => /^\p{N}/u.test(bare(word).replace(/^[^\p{L}\p{N}]+/u, ""));

function closesFrame(words: string[], index: number, paraEnds: Set<number>) {
  return paraEnds.has(index) || endsWithSentence(words[index]) || endsWithClause(words[index]);
}

/**
 * Frame start indices for a chapter. One word per frame, or for phrase styles the S-PTP rule (§2.2):
 * leading function words plus one content word ("on the bank,"), a number with the word after it
 * ("9 feet"), never crossing punctuation or a paragraph end, within `maxWords` and `maxChars`.
 */
export function buildFrames(words: string[], paraEnds: Set<number>, style: ReadingStyle): number[] {
  const starts: number[] = [];
  let i = 0;
  while (i < words.length) {
    starts.push(i);
    let end = i + 1;
    if (style.maxWords > 1) {
      let chars = words[i].length;
      // Keep going only while everything so far is a lead-in (function words or a number).
      while (
        end - i < style.maxWords &&
        end < words.length &&
        !closesFrame(words, end - 1, paraEnds) &&
        (isFunctionWord(words[end - 1]) || isNumber(words[end - 1])) &&
        chars + 1 + words[end].length <= style.maxChars
      ) {
        chars += 1 + words[end].length;
        end++;
      }
    }
    i = end;
  }
  return starts;
}

/** Sentence pauses grow with sentence length (Spritz patent, flattened; §5.1). */
function sentenceScale(wordsInSentence: number) {
  return wordsInSentence <= 7 ? 0.67 : wordsInSentence <= 22 ? 1 : 1.45;
}

function wordsInSentenceEndingAt(words: string[], last: number, paraEnds: Set<number>) {
  let i = last;
  while (i > 0 && !endsWithSentence(words[i - 1]) && !paraEnds.has(i - 1)) i--;
  return last - i + 1;
}

function wordWeight(word: string, inPhrase: boolean, style: ReadingStyle) {
  const n = letters(bare(word));
  if (inPhrase && isFunctionWord(word)) return style.functionWord;
  let weight = n <= 3 ? style.shortWord : 1;
  weight += Math.min(Math.max(0, n - style.lengthFrom) * style.perLetter, style.maxLengthBonus);
  if (/\p{N}/u.test(word)) weight += style.digits;
  return weight;
}

/** How long a frame stays up, in milliseconds, including any pause after it. */
export function frameDurationMs(
  words: string[],
  start: number,
  end: number,
  paraEnds: Set<number>,
  style: ReadingStyle,
  wpm: number,
  ramp = 1,
): number {
  const { readMs, pauseMs } = frameTiming(words, start, end, paraEnds, style, wpm, ramp);
  return readMs + pauseMs;
}

/**
 * A frame's time split in two: reading its words, then the pause after it. Guided reading sweeps across
 * the words in the first part and holds still in the second.
 */
export function frameTiming(
  words: string[],
  start: number,
  end: number,
  paraEnds: Set<number>,
  style: ReadingStyle,
  wpm: number,
  ramp = 1,
): { readMs: number; pauseMs: number } {
  const base = 60000 / wpm;
  const inPhrase = end - start > 1;
  let weight = 0;
  for (let i = start; i < end; i++) weight += wordWeight(words[i], inPhrase, style);
  weight = Math.max(weight, style.minFrameWeight);

  const last = end - 1;
  let pause = 0;
  if (paraEnds.has(last)) {
    pause = Math.max(style.pauses.paragraph * base, style.pauseFloorMs.paragraph);
  } else if (endsWithSentence(words[last])) {
    const scaled = style.pauses.sentence * sentenceScale(wordsInSentenceEndingAt(words, last, paraEnds));
    pause = Math.max(scaled * base, style.pauseFloorMs.sentence);
  } else if (endsWithClause(words[last])) {
    pause = Math.max(style.pauses.clause * base, style.pauseFloorMs.clause);
  }
  return { readMs: weight * base * ramp, pauseMs: pause * ramp };
}

/** Index into `starts` of the frame containing `word`. */
export function frameIndexOf(starts: number[], word: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= word) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Slower first frames after pressing play, so the eye can settle: starts at about 56% speed. */
export function rampFactor(frameInRun: number, style: ReadingStyle): number {
  if (frameInRun >= style.rampFrames) return 1;
  return 1 + 0.8 * ((style.rampFrames - frameInRun) / style.rampFrames);
}

export function paragraphEnds(paras: number[], total: number): Set<number> {
  // A paragraph ends on the word before the next one starts.
  const ends = new Set(paras.map((p) => p - 1).filter((p) => p >= 0));
  if (total) ends.add(total - 1);
  return ends;
}

/** Sentence-start test for "back"/"forward" jumps, sharing the abbreviation rules above. */
export function startsSentence(words: string[], index: number, paraEnds: Set<number>): boolean {
  return index === 0 || paraEnds.has(index - 1) || endsWithSentence(words[index - 1]);
}
