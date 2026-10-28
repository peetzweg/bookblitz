import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { reader, readingProgress } from "../reader/reader";
import { framePivot } from "../reader/rsvp";
import { library } from "../store/library";
import { useStore } from "../store/store";
import { RibbonView } from "./Ribbon";
import { reduceKeyframes, RIBBONS, transitionFrames, type Intensity, type TransitionId } from "./transitions";

/** The frame the reader is on: one word, or a short phrase in phrase styles. */
export function WordDisplay() {
  const text = useStore(reader, (s) => s.content?.[s.chapter]?.words.slice(s.word, s.frameEnd).join(" ") ?? "");
  const frameKey = useStore(reader, (s) => `${s.chapter}:${s.word}`);
  const playing = useStore(reader, (s) => s.playing);
  const transition = useStore(library, (s) => s.settings.transition ?? "cut");
  const intensity = useStore(library, (s) => s.settings.transitionIntensity ?? "noticeable");
  const wpm = useStore(library, (s) => s.settings.wpm);
  if (RIBBONS.has(transition)) return <ReaderRibbon mode={transition as "stream" | "glide"} intensity={intensity} wpm={wpm} />;
  // Only animate while reading; a jump while paused should just show the word.
  return <WordView text={text} frameKey={frameKey} transition={playing ? transition : "cut"} intensity={intensity} wpm={wpm} />;
}

function ReaderRibbon({ mode, intensity, wpm }: { mode: "stream" | "glide"; intensity: Intensity; wpm: number }) {
  const words = useStore(reader, (s) => s.content?.[s.chapter]?.words);
  const word = useStore(reader, (s) => s.word);
  const end = useStore(reader, (s) => s.frameEnd);
  const playing = useStore(reader, (s) => s.playing);
  if (!words) return null;
  return <RibbonView words={words} word={word} end={end} mode={mode} intensity={intensity} wpm={wpm} playing={playing} progress={readingProgress} />;
}

interface WordViewProps {
  text: string;
  /** Changes with every frame, even when two frames have the same text ("that that"). */
  frameKey?: string;
  transition?: TransitionId;
  intensity?: Intensity;
  wpm?: number;
  /** Plays transitions this many times slower, so the lab can show what each one does. */
  slow?: number;
}

/**
 * Swift Read-style display. The focus letter is centred on a fixed point and the rest of the text
 * hangs off either side of it, so nothing on screen moves between frames: not the focus letter, not the
 * guides, not the box height (long text shrinks inside a fixed-height row). With a transition, the
 * previous frame stays a moment as a ghost layer underneath, playing its exit.
 */
export function WordView({ text, frameKey = text, transition = "cut", intensity = "noticeable", wpm = 300, slow = 1 }: WordViewProps) {
  const base = transitionFrames(transition, intensity, wpm);
  const frames = { ...base, enterMs: base.enterMs * slow, exitMs: base.exitMs * slow, enterDelayMs: base.enterDelayMs * slow };
  const [current, setCurrent] = useState({ key: frameKey, text });
  const [ghost, setGhost] = useState<{ key: string; text: string } | null>(null);

  // A new frame: the one on screen becomes the ghost (derived state, set during render).
  if (current.key !== frameKey) {
    setGhost(frames.exit ? current : null);
    setCurrent({ key: frameKey, text });
  } else if (current.text !== text) {
    // Same place, re-cut text (the style changed): just show it.
    setCurrent({ key: frameKey, text });
  }

  useEffect(() => {
    if (!ghost) return;
    const timer = setTimeout(() => setGhost(null), frames.exitMs + 20);
    return () => clearTimeout(timer);
  }, [ghost, frames.exitMs]);

  return (
    <div className="rsvp">
      <div className="rsvp-guide top" />
      <div className="rsvp-word" aria-live="off">
        {ghost && (
          <Layer key={`out:${ghost.key}`} text={ghost.text} frames={frames.exit} duration={frames.exitMs} />
        )}
        <Layer key={`in:${current.key}`} text={current.text} frames={frames.enter} duration={frames.enterMs} delay={frames.enterDelayMs} />
      </div>
      <div className="rsvp-guide bottom" />
    </div>
  );
}

/**
 * An ease-out cubic. A steeper curve (quint) finishes most of the change in the first couple of frames,
 * which at 100–200ms per transition, and 60fps on phones, leaves nothing to see.
 */
const EASE_OUT = "cubic-bezier(0.33, 1, 0.68, 1)";

/** One frame's text, positioned on the pivot. Plays its keyframes once, when it mounts. */
function Layer({ text, frames, duration, delay = 0 }: { text: string; frames: Keyframe[] | null; duration: number; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const keyframes = reduced ? reduceKeyframes(frames) : frames;
    if (keyframes && ref.current) ref.current.animate(keyframes, { duration, delay, easing: EASE_OUT, fill: "both" });
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
