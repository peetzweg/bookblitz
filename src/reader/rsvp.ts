const TRAILING_CLOSERS = /["'”’»)\]}*]+$/;
const LEADING = /^[^\p{L}\p{N}]+/u;

/** Index of the optimal recognition point: the letter the eye should fix on. */
export function orpIndex(word: string): number {
  const lead = word.match(LEADING)?.[0].length ?? 0;
  const core = word.slice(lead).replace(TRAILING_CLOSERS, "").replace(/[^\p{L}\p{N}]+$/u, "");
  const n = core.length;
  const offset = n <= 1 ? 0 : n <= 5 ? 1 : n <= 9 ? 2 : n <= 13 ? 3 : 4;
  return Math.min(lead + offset, Math.max(word.length - 1, 0));
}

export function endsSentence(word: string): boolean {
  return /[.!?…]$/.test(word.replace(TRAILING_CLOSERS, ""));
}

/** How long a word stays on screen, relative to the base interval. */
export function wordWeight(word: string, endsParagraph: boolean): number {
  const bare = word.replace(TRAILING_CLOSERS, "");
  let weight = 1;
  if (/[.!?…]$/.test(bare)) weight = 2.2;
  else if (/[,;:—–]$/.test(bare)) weight = 1.5;
  if (endsParagraph) weight = Math.max(weight, 2.6);
  const letters = bare.replace(/[^\p{L}\p{N}]/gu, "").length;
  if (letters > 8) weight += Math.min((letters - 8) * 0.07, 0.7);
  if (/\d/.test(bare)) weight += 0.3;
  return weight;
}

export function baseInterval(wpm: number): number {
  return 60000 / wpm;
}

/** Average weight across real prose, so time estimates match what the engine actually does. */
const AVERAGE_WEIGHT = 1.22;

export function estimateMs(words: number, wpm: number): number {
  return words * baseInterval(wpm) * AVERAGE_WEIGHT;
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
