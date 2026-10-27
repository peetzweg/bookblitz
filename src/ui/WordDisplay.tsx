import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { reader } from "../reader/reader";
import { framePivot } from "../reader/rsvp";
import { library } from "../store/library";
import { useStore } from "../store/store";
import { reduceKeyframes, transitionMs, TRANSITIONS, type TransitionId } from "./transitions";

/** The frame the reader is on: one word, or a short phrase in phrase styles. */
export function WordDisplay() {
  const text = useStore(reader, (s) => s.content?.[s.chapter]?.words.slice(s.word, s.frameEnd).join(" ") ?? "");
  const frameKey = useStore(reader, (s) => `${s.chapter}:${s.word}`);
  const playing = useStore(reader, (s) => s.playing);
  const transition = useStore(library, (s) => s.settings.transition ?? "cut");
  const wpm = useStore(library, (s) => s.settings.wpm);
  // Only animate while reading; a jump while paused should just show the word.
  return <WordView text={text} frameKey={frameKey} transition={playing ? transition : "cut"} wpm={wpm} />;
}

interface WordViewProps {
  text: string;
  /** Changes with every frame, even when two frames have the same text ("that that"). */
  frameKey?: string;
  transition?: TransitionId;
  wpm?: number;
}

/**
 * Swift Read-style display. The focus letter is centred on a fixed point and the rest of the text
 * hangs off either side of it, so nothing on screen moves between frames: not the focus letter, not the
 * guides, not the box height (long text shrinks inside a fixed-height row). With a transition, the
 * previous frame stays a moment as a ghost layer underneath, playing its exit.
 */
export function WordView({ text, frameKey = text, transition = "cut", wpm = 300 }: WordViewProps) {
  const style = TRANSITIONS[transition] ?? TRANSITIONS.cut;
  const duration = transitionMs(wpm);
  const [current, setCurrent] = useState({ key: frameKey, text });
  const [ghost, setGhost] = useState<{ key: string; text: string } | null>(null);

  // A new frame: the one on screen becomes the ghost (derived state, set during render).
  if (current.key !== frameKey) {
    setGhost(style.exit ? current : null);
    setCurrent({ key: frameKey, text });
  } else if (current.text !== text) {
    // Same place, re-cut text (the style changed): just show it.
    setCurrent({ key: frameKey, text });
  }

  useEffect(() => {
    if (!ghost) return;
    const timer = setTimeout(() => setGhost(null), duration * style.exitLength + 20);
    return () => clearTimeout(timer);
  }, [ghost, duration, style.exitLength]);

  return (
    <div className="rsvp">
      <div className="rsvp-guide top" />
      <div className="rsvp-word" aria-live="off">
        {ghost && (
          <Layer key={`out:${ghost.key}`} text={ghost.text} frames={style.exit} duration={duration * style.exitLength} />
        )}
        <Layer key={`in:${current.key}`} text={current.text} frames={style.enter} duration={duration} />
      </div>
      <div className="rsvp-guide bottom" />
    </div>
  );
}

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

/** One frame's text, positioned on the pivot. Plays its keyframes once, when it mounts. */
function Layer({ text, frames, duration }: { text: string; frames: Keyframe[] | null; duration: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const keyframes = reduced ? reduceKeyframes(frames) : frames;
    if (keyframes && ref.current) ref.current.animate(keyframes, { duration, easing: EASE_OUT, fill: "both" });
  }, []);

  const pivot = framePivot(text);
  // Shrink very long frames so they don't run off the screen.
  const scale = Math.min(1, 13 / Math.max(text.length, 1));
  return (
    <div ref={ref} className="rsvp-layer" style={{ "--word-scale": scale } as React.CSSProperties}>
      <span className="rsvp-anchor">
        <span className="rsvp-before">{text.slice(0, pivot)}</span>
        <span className="rsvp-focus">{text.charAt(pivot)}</span>
        <span className="rsvp-after">{text.slice(pivot + 1)}</span>
      </span>
    </div>
  );
}
