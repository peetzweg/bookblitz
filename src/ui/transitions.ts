/**
 * Experimental hand-overs between words. The research (docs/research/word-transitions.md) points one
 * way: the incoming word should arrive crisp and almost at once (blank gaps and overlapping words both
 * cost legibility through masking), so the outgoing word gets the soft treatment.
 *
 * By Emil Kowalski's frequency rule this shouldn't animate at all (5–6 swaps a second is far past
 * "100+ a day: never"), and at a strength that can't hurt legibility it's invisible. So the lab offers
 * intensities that make each variant clearly perceptible, to judge whether a softer hand-over makes
 * reading less tiring. Cut stays the default.
 *
 * Everything is opacity/transform/filter on one small layer, scaled around the focus letter so the point
 * the eye is fixed on never moves. Blur stays well under 20px (expensive in Safari).
 */

export type TransitionId = "cut" | "soften" | "depth" | "drift" | "echo";
export type Intensity = "subtle" | "noticeable" | "strong";

export interface Transition {
  id: TransitionId;
  name: string;
  description: string;
}

export interface TransitionFrames {
  /** Keyframes for the word arriving; `null` means it simply appears. */
  enter: Keyframe[] | null;
  /** Keyframes for the word leaving, played on a copy underneath the new one; `null` means it vanishes. */
  exit: Keyframe[] | null;
  enterMs: number;
  exitMs: number;
}

export const TRANSITIONS: Record<TransitionId, Transition> = {
  cut: { id: "cut", name: "Cut", description: "Words swap instantly. The classic, and the baseline to compare against" },
  soften: { id: "soften", name: "Soften", description: "Each word fades up instead of flashing on; the last one fades out underneath" },
  depth: { id: "depth", name: "Depth", description: "Words arrive from just in front and recede into a blur behind" },
  drift: { id: "drift", name: "Drift", description: "A small slide in reading direction, as if the line were moving past" },
  echo: { id: "echo", name: "Echo", description: "The new word is crisp; the last one lingers as a faint, blurred afterimage" },
};

export const TRANSITION_ORDER: TransitionId[] = ["cut", "soften", "depth", "drift", "echo"];

export const INTENSITIES: { id: Intensity; name: string }[] = [
  { id: "subtle", name: "Subtle" },
  { id: "noticeable", name: "Noticeable" },
  { id: "strong", name: "Strong" },
];

/**
 * How strong each intensity is: `share` of one word's time (within min–max ms) and `amp`, which scales
 * every distance, blur and opacity step.
 */
const LEVELS: Record<Intensity, { share: number; min: number; max: number; amp: number }> = {
  subtle: { share: 0.33, min: 45, max: 110, amp: 1 },
  noticeable: { share: 0.6, min: 90, max: 180, amp: 2 },
  strong: { share: 0.9, min: 120, max: 260, amp: 3 },
};

const cap = (value: number, max: number) => Math.min(value, max);

/** Keyframes and timings for one transition at one intensity and speed. */
export function transitionFrames(id: TransitionId, intensity: Intensity, wpm: number): TransitionFrames {
  const level = LEVELS[intensity];
  const ms = Math.min(level.max, Math.max(level.min, (60000 / wpm) * level.share));
  const a = level.amp;
  switch (id) {
    case "soften":
      return {
        enter: [{ opacity: Math.max(0, 0.6 - 0.25 * a) }, { opacity: 1 }],
        exit: [{ opacity: cap(0.4 + 0.2 * a, 1) }, { opacity: 0 }],
        enterMs: ms,
        exitMs: ms * 0.8,
      };
    case "depth":
      return {
        enter: [
          { opacity: Math.max(0, 0.5 - 0.15 * a), transform: `scale(${1 + 0.07 * a})`, filter: `blur(${cap(2 * a, 8)}px)` },
          { opacity: 1, transform: "scale(1)", filter: "blur(0px)" },
        ],
        exit: [
          { opacity: cap(0.4 + 0.15 * a, 0.9), transform: "scale(1)", filter: "blur(0px)" },
          { opacity: 0, transform: `scale(${Math.max(0.7, 1 - 0.1 * a)})`, filter: `blur(${cap(6 * a, 16)}px)` },
        ],
        enterMs: ms,
        exitMs: ms * 1.2,
      };
    case "drift":
      return {
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
      };
    case "echo":
      return {
        enter: null,
        exit: [
          { opacity: cap(0.14 + 0.08 * a, 0.45), transform: "scale(0.97)", filter: `blur(${cap(1.5 + 0.5 * a, 4)}px)` },
          { opacity: 0, transform: "scale(0.95)", filter: `blur(${cap(4 + a, 8)}px)` },
        ],
        enterMs: 0,
        exitMs: ms * 3,
      };
    default:
      return { enter: null, exit: null, enterMs: 0, exitMs: 0 };
  }
}

/** Reduced motion keeps only the opacity part: no movement, no blur. */
export function reduceKeyframes(frames: Keyframe[] | null): Keyframe[] | null {
  return frames && frames.map(({ opacity }) => ({ opacity }));
}
