/**
 * How text is cut into frames (what is on screen at once) and how long each frame stays up.
 * Pure functions, shared by the reader and the reading-style previews, so a preview is exactly what
 * reading will feel like.
 */

export type StyleId = "flow" | "phrases" | "calm";

export interface ReadingStyle {
  id: StyleId;
  name: string;
  /** One line under the name in the picker. */
  tagline: string;
  /** Words on screen at once; 1 is classic one-word RSVP. */
  maxWords: number;
  /** A frame never grows past this many characters (spaces included). */
  maxChars: number;
  /** Extra time after a frame ending in . ! ? …, in multiples of one word's time. */
  sentencePause: number;
  /** Extra time after , ; : — */
  clausePause: number;
  /** Extra time at the end of a paragraph (replaces the sentence pause, doesn't stack). */
  paragraphPause: number;
  /** Letters a word may have before it gets extra time. */
  lengthFrom: number;
  /** Extra time per letter beyond `lengthFrom`, in multiples of one word's time. */
  perLetter: number;
  /** Cap on the length bonus. */
  maxLengthBonus: number;
  /** Time for very short words (1–3 letters), which are read at a glance. */
  shortWord: number;
  /** Extra time for a word containing digits. */
  digits: number;
  /** Frames that start slower after pressing play, easing up to full speed. */
  rampFrames: number;
}

// Placeholder values until docs/research/speed-reading.md lands; see that file for the reasoning.
export const STYLES: Record<StyleId, ReadingStyle> = {
  flow: {
    id: "flow",
    name: "Flow",
    tagline: "One word at a time, longer words get more time",
    maxWords: 1,
    maxChars: 40,
    sentencePause: 1.3,
    clausePause: 0.6,
    paragraphPause: 1.8,
    lengthFrom: 6,
    perLetter: 0.1,
    maxLengthBonus: 1.2,
    shortWord: 0.85,
    digits: 0.4,
    rampFrames: 5,
  },
  phrases: {
    id: "phrases",
    name: "Phrases",
    tagline: "Short words travel together, so you see phrases",
    maxWords: 3,
    maxChars: 16,
    sentencePause: 1.2,
    clausePause: 0.5,
    paragraphPause: 1.6,
    lengthFrom: 7,
    perLetter: 0.08,
    maxLengthBonus: 1,
    shortWord: 0.7,
    digits: 0.4,
    rampFrames: 4,
  },
  calm: {
    id: "calm",
    name: "Calm",
    tagline: "Steady rhythm with generous pauses, for dense text",
    maxWords: 1,
    maxChars: 40,
    sentencePause: 2,
    clausePause: 1,
    paragraphPause: 3,
    lengthFrom: 5,
    perLetter: 0.14,
    maxLengthBonus: 1.6,
    shortWord: 1,
    digits: 0.6,
    rampFrames: 8,
  },
};

export const DEFAULT_STYLE: StyleId = "flow";

const TRAILING_CLOSERS = /["'”’»)\]}*]+$/;
const bare = (word: string) => word.replace(TRAILING_CLOSERS, "");
const letters = (word: string) => word.replace(/[^\p{L}\p{N}]/gu, "").length;
const endsWithSentence = (word: string) => /[.!?…]$/.test(bare(word));
const endsWithClause = (word: string) => /[,;:—–]$/.test(bare(word));

/**
 * Frame start indices for a chapter. One word per frame, or for phrase styles, greedy runs of short
 * words that stop at punctuation and paragraph ends so a frame never straddles a pause.
 */
export function buildFrames(words: string[], paraEnds: Set<number>, style: ReadingStyle): number[] {
  const starts: number[] = [];
  let i = 0;
  while (i < words.length) {
    starts.push(i);
    let chars = words[i].length;
    let count = 1;
    while (
      count < style.maxWords &&
      i + count < words.length &&
      !closesFrame(words[i + count - 1], i + count - 1, paraEnds) &&
      chars + 1 + words[i + count].length <= style.maxChars
    ) {
      chars += 1 + words[i + count].length;
      count++;
    }
    // A phrase shouldn't end on "the" or "of": hand trailing function words to the next frame, so it
    // reads "sister" | "on the bank," rather than "sister on the" | "bank,".
    while (count > 1 && !closesFrame(words[i + count - 1], i + count - 1, paraEnds) && isFunctionWord(words[i + count - 1])) {
      count--;
    }
    i += count;
  }
  return starts;
}

/** Common English function words; anything of two letters or fewer counts too, as a cross-language fallback. */
const FUNCTION_WORDS = new Set(
  "a an the of to in on at by for from with as into onto upon about over under after before than and or but nor so if that this these those its his her their our your my is was are were be been".split(" "),
);

function isFunctionWord(word: string) {
  const core = bare(word).replace(/^[^\p{L}]+/u, "").toLowerCase();
  return FUNCTION_WORDS.has(core) || letters(core) <= 2;
}

function closesFrame(word: string, index: number, paraEnds: Set<number>) {
  return paraEnds.has(index) || endsWithSentence(word) || endsWithClause(word);
}

/** How long a frame stays up, in multiples of one word's time at the current speed. */
export function frameWeight(words: string[], start: number, end: number, paraEnds: Set<number>, style: ReadingStyle): number {
  let weight = 0;
  for (let i = start; i < end; i++) weight += wordWeight(words[i], style);
  const last = end - 1;
  if (paraEnds.has(last)) weight += style.paragraphPause;
  else if (endsWithSentence(words[last])) weight += style.sentencePause;
  else if (endsWithClause(words[last])) weight += style.clausePause;
  return weight;
}

function wordWeight(word: string, style: ReadingStyle): number {
  const n = letters(bare(word));
  let weight = n <= 3 ? style.shortWord : 1;
  if (n > style.lengthFrom) weight += Math.min((n - style.lengthFrom) * style.perLetter, style.maxLengthBonus);
  if (/\d/.test(word)) weight += style.digits;
  return weight;
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

/** Slower first frames after pressing play, so the eye can settle. */
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
