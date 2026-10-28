/**
 * Experimental guided reading: instead of flashing words in one place, the text stays on the page and
 * something paces the eye through it, at your speed and with your reading style's pauses. A wide set
 * on purpose, to try on real chapters before narrowing down. See docs/research/guided-reading.md.
 */

export type GuideId = "flash" | "highlight" | "pacer" | "hops" | "sentence" | "focus" | "cover" | "scroll";

interface Guide {
  id: GuideId;
  name: string;
  description: string;
}

const GUIDES: Guide[] = [
  {
    id: "flash",
    name: "Off: flash words",
    description: "The classic: one word (or phrase) at a time in one place, so your eyes never move",
  },
  {
    id: "highlight",
    name: "Highlight",
    description: "The word you're on lights up and the highlight steps along, like karaoke lyrics. With Phrases, it lights whole phrases",
  },
  {
    id: "pacer",
    name: "Pacer",
    description: "A bar glides under the line like a finger tracing it; your eyes follow just above it",
  },
  {
    id: "hops",
    name: "Hops",
    description: "Each line splits into two or three spans that light up in turn: take in each span in one glance",
  },
  {
    id: "sentence",
    name: "Sentence",
    description: "The sentence you're in stands out and the rest of the page steps back, sentence by sentence",
  },
  {
    id: "focus",
    name: "Line focus",
    description: "A window of three lines stays clear around the line you're on, and moves down at your speed",
  },
  {
    id: "cover",
    name: "Cover",
    description: "Text fades away behind you, like sliding a card down the page. Breaks the research on purpose: looking back helps",
  },
  {
    id: "scroll",
    name: "Scroll",
    description: "A teleprompter: the text rolls up past a fixed reading line, continuously, at your speed",
  },
];

export const GUIDE = Object.fromEntries(GUIDES.map((g) => [g.id, g])) as Record<GuideId, Guide>;
export const GUIDE_ORDER = GUIDES.map((g) => g.id);

/** Guides that move every animation frame, rather than once per word. */
export const CONTINUOUS: ReadonlySet<GuideId> = new Set(["pacer", "scroll"]);

/** How much of a word to embolden for "Bold word starts" (the Bionic Reading idea): about half. */
export function boldLength(word: string): number {
  const letters = word.replace(/[^\p{L}\p{N}]/gu, "").length;
  if (letters <= 1) return word.length;
  const lead = word.match(/^[^\p{L}\p{N}]*/u)?.[0].length ?? 0;
  return lead + (letters <= 3 ? 1 : Math.ceil(letters / 2));
}
