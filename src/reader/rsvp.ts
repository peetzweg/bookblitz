const TRAILING_CLOSERS = /["'”’»)\]}*]+$/;
const LEADING = /^[^\p{L}\p{N}]+/u;

/** Index of the optimal recognition point: the letter the eye should fix on. */
function orpIndex(word: string): number {
  const lead = word.match(LEADING)?.[0].length ?? 0;
  const core = word.slice(lead).replace(TRAILING_CLOSERS, "").replace(/[^\p{L}\p{N}]+$/u, "");
  const n = core.length;
  const offset = n <= 1 ? 0 : n <= 5 ? 1 : n <= 9 ? 2 : n <= 13 ? 3 : 4;
  return Math.min(lead + offset, Math.max(word.length - 1, 0));
}

function baseInterval(wpm: number): number {
  return 60000 / wpm;
}

/** Average time per word for the current reading style, so "time left" matches what reading does. */
let meanWeight = 1.16;

export function setEstimateWeight(weight: number) {
  meanWeight = weight;
}

export function estimateMs(words: number, wpm: number): number {
  return words * baseInterval(wpm) * meanWeight;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** "1 hr 5 min", or "1h 5m" where space is tight. */
export function formatDuration(ms: number, compact = false): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  const [hr, min] = compact ? ["h", "m"] : [" hr", " min"];
  if (minutes < 60) return `${minutes}${min}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}${hr} ${m}${min}` : `${h}${hr}`;
}

/**
 * Focus letter for a frame. A single word uses its recognition point (the Spritz table); a phrase
 * uses the letter nearest 40% of the way in (research brief §5.2).
 */
export function framePivot(text: string): number {
  if (!text.includes(" ")) return orpIndex(text);
  const target = Math.round(text.length * 0.4);
  for (let d = 0; d < text.length; d++) {
    if (text[target - d] && text[target - d] !== " ") return target - d;
    if (text[target + d] && text[target + d] !== " ") return target + d;
  }
  return 0;
}
