/**
 * Experimental hand-overs between words. The research (docs/research/word-transitions.md) points one
 * way: the incoming word must arrive crisp and almost at once (blank gaps and overlapping words both
 * cost legibility through masking), so only the outgoing word gets the soft treatment, and nothing
 * takes more than about a third of a word's time.
 *
 * Every animation is transform/opacity/filter on one small layer, scaled around the focus letter so the
 * point the eye is fixed on never moves.
 */

export type TransitionId = "cut" | "soften" | "depth" | "drift" | "echo";

export interface Transition {
  id: TransitionId;
  name: string;
  description: string;
  /** Keyframes for the word arriving; `null` means it simply appears. */
  enter: Keyframe[] | null;
  /** Keyframes for the word leaving, played on a copy underneath the new one; `null` means it vanishes. */
  exit: Keyframe[] | null;
  /** The exit lasts this many times the transition time (an echo lingers). */
  exitLength: number;
}

export const TRANSITIONS: Record<TransitionId, Transition> = {
  cut: {
    id: "cut",
    name: "Cut",
    description: "Words swap instantly. The classic, and the baseline to compare against",
    enter: null,
    exit: null,
    exitLength: 0,
  },
  soften: {
    id: "soften",
    name: "Soften",
    description: "Each word fades up instead of flashing on; the last one fades out underneath",
    enter: [{ opacity: 0.4 }, { opacity: 1 }],
    exit: [{ opacity: 0.6 }, { opacity: 0 }],
    exitLength: 0.7,
  },
  depth: {
    id: "depth",
    name: "Depth",
    description: "Words arrive from just in front and recede into a blur behind",
    enter: [
      { opacity: 0.35, transform: "scale(1.07)", filter: "blur(2px)" },
      { opacity: 1, transform: "scale(1)", filter: "blur(0px)" },
    ],
    exit: [
      { opacity: 0.55, transform: "scale(1)", filter: "blur(0px)" },
      { opacity: 0, transform: "scale(0.9)", filter: "blur(6px)" },
    ],
    exitLength: 1,
  },
  drift: {
    id: "drift",
    name: "Drift",
    description: "A small slide in reading direction, as if the line were moving past",
    enter: [
      { opacity: 0.4, transform: "translateX(0.14em)" },
      { opacity: 1, transform: "translateX(0)" },
    ],
    exit: [
      { opacity: 0.5, transform: "translateX(0)" },
      { opacity: 0, transform: "translateX(-0.22em)" },
    ],
    exitLength: 1,
  },
  echo: {
    id: "echo",
    name: "Echo",
    description: "The new word is crisp; the last one lingers as a faint, blurred afterimage",
    enter: null,
    exit: [
      { opacity: 0.22, transform: "scale(0.97)", filter: "blur(2px)" },
      { opacity: 0, transform: "scale(0.95)", filter: "blur(5px)" },
    ],
    exitLength: 3,
  },
};

export const TRANSITION_ORDER: TransitionId[] = ["cut", "soften", "depth", "drift", "echo"];

/** About a third of one word's time at this speed, within 45–110ms. */
export function transitionMs(wpm: number): number {
  return Math.min(110, Math.max(45, (60000 / wpm) * 0.33));
}

/** Reduced motion keeps only the opacity part: no movement, no blur. */
export function reduceKeyframes(frames: Keyframe[] | null): Keyframe[] | null {
  return frames && frames.map(({ opacity }) => ({ opacity }));
}
