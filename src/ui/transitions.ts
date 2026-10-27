/**
 * Experimental hand-overs between words: a wide set on purpose, to find which kind of motion (if any)
 * makes reading less tiring, before narrowing down. See docs/research/word-transitions.md.
 *
 * By Emil Kowalski's frequency rule this shouldn't animate at all (5–6 swaps a second is far past
 * "100+ a day: never"), and the research says gaps and overlaps cost legibility, so Cut stays the
 * default and some variants here (Dissolve, Blink) deliberately break those rules to feel why.
 *
 * Everything is opacity/transform/filter on one small layer, scaled around the focus letter so the point
 * the eye is fixed on doesn't move unless the variant is about movement. Blur stays under 20px.
 */

export type TransitionId =
  | "cut"
  | "soften"
  | "dissolve"
  | "blink"
  | "depth"
  | "zoom"
  | "recede"
  | "pop"
  | "drift"
  | "ticker"
  | "rise"
  | "flip"
  | "focus"
  | "smear"
  | "echo"
  | "trail";

export type Intensity = "subtle" | "noticeable" | "strong";

export interface TransitionFrames {
  /** Keyframes for the word arriving; `null` means it simply appears. */
  enter: Keyframe[] | null;
  /** Keyframes for the word leaving, played on a copy underneath the new one; `null` means it vanishes. */
  exit: Keyframe[] | null;
  enterMs: number;
  exitMs: number;
  /** The new word waits this long before arriving (only Blink, which fades through nothing). */
  enterDelayMs: number;
}

interface Variant {
  id: TransitionId;
  name: string;
  description: string;
  /** Builds the frames from the amplitude (1 subtle, 2 noticeable, 3 strong) and the base duration. */
  build: (a: number, ms: number) => TransitionFrames;
}

const cap = (value: number, max: number) => Math.min(value, max);
const blur = (px: number, max = 16) => `blur(${cap(px, max)}px)`;
const none = { enter: null, exit: null, enterMs: 0, exitMs: 0, enterDelayMs: 0 };

const VARIANTS: Variant[] = [
  // ---- Fades: brightness only ----
  {
    id: "cut",
    name: "Cut",
    description: "Instant swap. The classic, and the baseline to compare against",
    build: () => none,
  },
  {
    id: "soften",
    name: "Soften",
    description: "Fades up instead of flashing on; the last word fades out underneath",
    build: (a, ms) => ({
      enter: [{ opacity: Math.max(0, 0.6 - 0.25 * a) }, { opacity: 1 }],
      exit: [{ opacity: cap(0.4 + 0.2 * a, 1) }, { opacity: 0 }],
      enterMs: ms,
      exitMs: ms * 0.8,
      enterDelayMs: 0,
    }),
  },
  {
    id: "dissolve",
    name: "Dissolve",
    description: "A full cross-fade: both words overlap for a moment. Breaks the research on purpose",
    build: (_a, ms) => ({
      enter: [{ opacity: 0 }, { opacity: 1 }],
      exit: [{ opacity: 1 }, { opacity: 0 }],
      enterMs: ms,
      exitMs: ms,
      enterDelayMs: 0,
    }),
  },
  {
    id: "blink",
    name: "Blink",
    description: "Fades out to nothing, then the next word fades in: a gap between words. Also breaks it",
    build: (_a, ms) => ({
      enter: [{ opacity: 0 }, { opacity: 1 }],
      exit: [{ opacity: 1 }, { opacity: 0 }],
      enterMs: ms * 0.5,
      exitMs: ms * 0.5,
      enterDelayMs: ms * 0.5,
    }),
  },
  // ---- Depth: towards and away from you ----
  {
    id: "depth",
    name: "Depth",
    description: "Arrives from just in front, recedes into a blur behind",
    build: (a, ms) => ({
      enter: [
        { opacity: Math.max(0, 0.5 - 0.15 * a), transform: `scale(${1 + 0.07 * a})`, filter: blur(2 * a, 8) },
        { opacity: 1, transform: "scale(1)", filter: "blur(0px)" },
      ],
      exit: [
        { opacity: cap(0.4 + 0.15 * a, 0.9), transform: "scale(1)", filter: "blur(0px)" },
        { opacity: 0, transform: `scale(${Math.max(0.7, 1 - 0.1 * a)})`, filter: blur(6 * a) },
      ],
      enterMs: ms,
      exitMs: ms * 1.2,
      enterDelayMs: 0,
    }),
  },
  {
    id: "zoom",
    name: "Zoom",
    description: "Flying through the text: words come at you and pass by, growing and blurring",
    build: (a, ms) => ({
      enter: [
        { opacity: 0, transform: `scale(${Math.max(0.5, 1 - 0.15 * a)})`, filter: blur(1.5 * a, 6) },
        { opacity: 1, transform: "scale(1)", filter: "blur(0px)" },
      ],
      exit: [
        { opacity: 0.8, transform: "scale(1)", filter: "blur(0px)" },
        { opacity: 0, transform: `scale(${1 + 0.35 * a})`, filter: blur(5 * a) },
      ],
      enterMs: ms,
      exitMs: ms * 1.2,
      enterDelayMs: 0,
    }),
  },
  {
    id: "recede",
    name: "Recede",
    description: "The opposite: each word lands on the glass and falls away into the distance",
    build: (a, ms) => ({
      enter: [
        { opacity: 0, transform: `scale(${1 + 0.2 * a})`, filter: blur(2 * a, 8) },
        { opacity: 1, transform: "scale(1)", filter: "blur(0px)" },
      ],
      exit: [
        { opacity: 0.7, transform: "scale(1)", filter: "blur(0px)" },
        { opacity: 0, transform: `scale(${Math.max(0.3, 1 - 0.22 * a)})`, filter: blur(2 * a, 8) },
      ],
      enterMs: ms,
      exitMs: ms * 1.3,
      enterDelayMs: 0,
    }),
  },
  {
    id: "pop",
    name: "Pop",
    description: "A springy arrival with a small overshoot, like an iOS notification; no exit",
    build: (a, ms) => ({
      enter: [
        { opacity: 0.2, transform: `scale(${Math.max(0.7, 1 - 0.08 * a)})` },
        { opacity: 1, transform: `scale(${1 + 0.03 * a})`, offset: 0.6 },
        { opacity: 1, transform: "scale(1)" },
      ],
      exit: null,
      enterMs: ms * 1.2,
      exitMs: 0,
      enterDelayMs: 0,
    }),
  },
  // ---- Motion: direction ----
  {
    id: "drift",
    name: "Drift",
    description: "A small slide in reading direction",
    build: (a, ms) => ({
      enter: [
        { opacity: Math.max(0, 0.55 - 0.15 * a), transform: `translateX(${0.14 * a}em)` },
        { opacity: 1, transform: "translateX(0)" },
      ],
      exit: [
        { opacity: cap(0.35 + 0.15 * a, 0.85), transform: "translateX(0)" },
        { opacity: 0, transform: `translateX(${-0.22 * a}em)` },
      ],
      enterMs: ms,
      exitMs: ms * 1.1,
      enterDelayMs: 0,
    }),
  },
  {
    id: "ticker",
    name: "Ticker",
    description: "A big slide, like a news ticker: words run in from the right and out to the left",
    build: (a, ms) => ({
      enter: [
        { opacity: 0, transform: `translateX(${0.6 * a}em)` },
        { opacity: 1, transform: "translateX(0)" },
      ],
      exit: [
        { opacity: 1, transform: "translateX(0)" },
        { opacity: 0, transform: `translateX(${-0.6 * a}em)` },
      ],
      enterMs: ms,
      exitMs: ms,
      enterDelayMs: 0,
    }),
  },
  {
    id: "rise",
    name: "Rise",
    description: "Words roll upwards, like film credits or a slot machine",
    build: (a, ms) => ({
      enter: [
        { opacity: 0, transform: `translateY(${0.3 * a}em)` },
        { opacity: 1, transform: "translateY(0)" },
      ],
      exit: [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: `translateY(${-0.3 * a}em)` },
      ],
      enterMs: ms,
      exitMs: ms,
      enterDelayMs: 0,
    }),
  },
  {
    id: "flip",
    name: "Flip",
    description: "A split-flap board: each word tips over and the next flips into place",
    build: (a, ms) => ({
      enter: [
        { opacity: 0.2, transform: `rotateX(${-cap(28 * a, 85)}deg)` },
        { opacity: 1, transform: "rotateX(0deg)" },
      ],
      exit: [
        { opacity: 1, transform: "rotateX(0deg)" },
        { opacity: 0, transform: `rotateX(${cap(28 * a, 85)}deg)` },
      ],
      enterMs: ms,
      exitMs: ms * 0.9,
      enterDelayMs: 0,
    }),
  },
  // ---- Blur & afterimage ----
  {
    id: "focus",
    name: "Focus",
    description: "A camera focus pull: words sharpen out of a blur and blur away again, without moving",
    build: (a, ms) => ({
      enter: [
        { opacity: 0.35, filter: blur(4 * a, 12) },
        { opacity: 1, filter: "blur(0px)" },
      ],
      exit: [
        { opacity: 0.6, filter: "blur(0px)" },
        { opacity: 0, filter: blur(4 * a, 12) },
      ],
      enterMs: ms,
      exitMs: ms,
      enterDelayMs: 0,
    }),
  },
  {
    id: "smear",
    name: "Smear",
    description: "Motion blur: the last word is stretched and streaked away to the left",
    build: (a, ms) => ({
      enter: [
        { opacity: 0.5, transform: `translateX(${0.12 * a}em)` },
        { opacity: 1, transform: "translateX(0)" },
      ],
      exit: [
        { opacity: 0.7, transform: "translateX(0) scaleX(1)", filter: "blur(0px)" },
        { opacity: 0, transform: `translateX(${-0.35 * a}em) scaleX(${1 + 0.4 * a})`, filter: blur(3 * a, 9) },
      ],
      enterMs: ms,
      exitMs: ms * 1.1,
      enterDelayMs: 0,
    }),
  },
  {
    id: "echo",
    name: "Echo",
    description: "The new word is crisp; the last one lingers as a faint, blurred afterimage",
    build: (a, ms) => ({
      enter: null,
      exit: [
        { opacity: cap(0.14 + 0.08 * a, 0.45), transform: "scale(0.97)", filter: blur(1.5 + 0.5 * a, 4) },
        { opacity: 0, transform: "scale(0.95)", filter: blur(4 + a, 8) },
      ],
      enterMs: 0,
      exitMs: ms * 3,
      enterDelayMs: 0,
    }),
  },
  {
    id: "trail",
    name: "Trail",
    description: "Afterimages stream away to the left, leaving a fading trail of the last few words",
    build: (a, ms) => ({
      enter: null,
      exit: [
        { opacity: cap(0.25 + 0.1 * a, 0.55), transform: "translateX(0)", filter: "blur(0.5px)" },
        { opacity: 0, transform: `translateX(${-1.1 * a}em)`, filter: blur(3 * a, 10) },
      ],
      enterMs: 0,
      exitMs: ms * 4,
      enterDelayMs: 0,
    }),
  },
];

export const TRANSITIONS = Object.fromEntries(VARIANTS.map((v) => [v.id, v])) as Record<TransitionId, Variant>;

/** For the lab: the variants in groups, one dimension pushed per group. */
export const TRANSITION_GROUPS: { name: string; ids: TransitionId[] }[] = [
  { name: "Fades", ids: ["cut", "soften", "dissolve", "blink"] },
  { name: "Depth", ids: ["depth", "zoom", "recede", "pop"] },
  { name: "Motion", ids: ["drift", "ticker", "rise", "flip"] },
  { name: "Blur & afterimage", ids: ["focus", "smear", "echo", "trail"] },
];

export const TRANSITION_ORDER: TransitionId[] = TRANSITION_GROUPS.flatMap((g) => g.ids);

export const INTENSITIES: { id: Intensity; name: string }[] = [
  { id: "subtle", name: "Subtle" },
  { id: "noticeable", name: "Noticeable" },
  { id: "strong", name: "Strong" },
];

/** Share of one word's time a transition takes (within min–max ms), and its amplitude. */
const LEVELS: Record<Intensity, { share: number; min: number; max: number; amp: number }> = {
  subtle: { share: 0.33, min: 45, max: 110, amp: 1 },
  noticeable: { share: 0.6, min: 90, max: 180, amp: 2 },
  strong: { share: 0.9, min: 120, max: 260, amp: 3 },
};

/** Keyframes and timings for one transition at one intensity and speed. */
export function transitionFrames(id: TransitionId, intensity: Intensity, wpm: number): TransitionFrames {
  const level = LEVELS[intensity] ?? LEVELS.noticeable;
  const ms = Math.min(level.max, Math.max(level.min, (60000 / wpm) * level.share));
  return (TRANSITIONS[id] ?? TRANSITIONS.cut).build(level.amp, ms);
}

/** Reduced motion keeps only the opacity part: no movement, no blur. */
export function reduceKeyframes(frames: Keyframe[] | null): Keyframe[] | null {
  return frames && frames.map(({ opacity, offset }) => (offset === undefined ? { opacity } : { opacity, offset }));
}
