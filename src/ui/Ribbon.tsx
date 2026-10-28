import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { framePivot } from "../reader/rsvp";
import { slideMs, type Intensity } from "./transitions";

/** Words kept rendered either side of the current one; the window moves on in steps. */
const BEHIND = 24;
const AHEAD = 48;
const EASE_OUT = "cubic-bezier(0.33, 1, 0.68, 1)";
/** How visible the words either side are, by intensity. */
const NEIGHBOURS: Record<Intensity, number> = { subtle: 0.18, noticeable: 0.3, strong: 0.45 };

interface Props {
  words: string[];
  /** The frame being read: its first word, and one past its last. */
  word: number;
  end: number;
  /**
   * Stream slides each new word into the focus mark, with its neighbours faintly in view. Glide moves the
   * line continuously, at reading speed, so there are no steps at all.
   */
  mode: "stream" | "glide";
  intensity: Intensity;
  wpm: number;
  playing: boolean;
  /** How far through the frame's words reading is, 0–1 (Glide reads it every animation frame). */
  progress: () => number;
  /** Plays Stream's slide this many times slower, for the lab. */
  slow?: number;
}

/**
 * Flash reading as one line of text instead of separate words: the frame being read sits on the focus
 * mark at full strength, and the words before and after it stay faintly in view, so the next word is
 * already there before it arrives. Positions are set directly in the DOM, as in GuidedText.
 */
export function RibbonView({ words, word, end, mode, intensity, wpm, playing, progress, slow = 1 }: Props) {
  const [win, setWin] = useState(() => windowAround(words, word));
  const nearStart = win.first > 0 && word < win.first + 4;
  const nearEnd = win.last < words.length && word > win.last - AHEAD / 2;
  if (win.words !== words || nearStart || nearEnd || word < win.first || word >= win.last) setWin(windowAround(words, word));

  const box = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const spans = useRef<HTMLElement[]>([]);
  const shown = useRef({ word: -1, end: -1 });
  const latest = useRef({ word, end, mode, progress, wpm, intensity, slow });
  latest.current = { word, end, mode, progress, wpm, intensity, slow };
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const text = useMemo(() => {
    const out = [];
    for (let i = win.first; i < win.last; i++) {
      const w = words[i];
      const p = framePivot(w);
      out.push(
        <span key={i} className="rw">
          {w.slice(0, p)}
          <span className="rw-f">{w.charAt(p)}</span>
          {w.slice(p + 1)}
        </span>,
        " ",
      );
    }
    return out;
  }, [words, win.first, win.last]);

  /** Centre of the letter the eye should be on for the frame starting at `start` and ending at `stop`. */
  const centreOf = (start: number, stop: number) => {
    const els = spans.current;
    const k = start - win.first;
    if (k < 0 || k >= els.length) return null;
    let i = k;
    // A phrase is anchored on its word nearest 40% of the way in, like the single-word display.
    if (stop - start > 1) {
      const phrase = words.slice(start, stop).join(" ");
      let at = framePivot(phrase);
      while (i < Math.min(stop - win.first, els.length) - 1 && at > words[win.first + i].length) {
        at -= words[win.first + i].length + 1;
        i++;
      }
    }
    // Both spans measure from the strip (their offsetParent), so the letter's own offset is enough.
    const f = els[i].querySelector<HTMLElement>(".rw-f");
    return f ? f.offsetLeft + f.offsetWidth / 2 : els[i].offsetLeft;
  };

  const markX = () => (box.current?.clientWidth ?? 0) * 0.4;

  const lastX = useRef(0);
  const setX = (x: number, ms: number) => {
    const s = strip.current;
    if (!s) return;
    // A long jump (a skip, or the sample starting over) cuts instead of sweeping across everything.
    if (Math.abs(x - lastX.current) > (box.current?.clientWidth ?? 0)) ms = 0;
    lastX.current = x;
    s.style.transition = ms ? `transform ${ms}ms ${EASE_OUT}` : "none";
    s.style.transform = `translateX(${x}px)`;
  };

  /** Marks the frame being read; the rest of the line stays dim. */
  const light = (word: number, end: number) => {
    const els = spans.current;
    for (let i = shown.current.word; i < shown.current.end; i++) els[i - win.first]?.classList.remove("rw-current");
    for (let i = word; i < end; i++) els[i - win.first]?.classList.add("rw-current");
    shown.current = { word, end };
  };

  /** Glide: the mark sweeps from halfway before the frame to halfway after it, so there's no step. */
  const glide = () => {
    const { word, end, progress } = latest.current;
    const here = centreOf(word, end);
    if (here === null) return;
    const before = word > 0 ? centreOf(word - 1, word) ?? here : here;
    const after = centreOf(end, end + 1) ?? here;
    const from = (before + here) / 2;
    const to = (here + after) / 2;
    setX(markX() - (from + (to - from) * progress()), 0);
  };

  // New text in the window: measure, and put the line back where it was, without animating.
  useLayoutEffect(() => {
    spans.current = [...(strip.current?.querySelectorAll<HTMLElement>(".rw") ?? [])];
    const { word, end } = shown.current.word >= 0 ? shown.current : latest.current;
    shown.current = { word: -1, end: -1 };
    light(word, end);
    const c = centreOf(word, end);
    if (c !== null) setX(markX() - c, 0);
    void strip.current?.offsetWidth;
  }, [text]);

  // Every new frame.
  useLayoutEffect(() => {
    light(word, end);
    // Glide moves on its own every animation frame, once the clock has caught up with this frame.
    if (mode === "glide" && playing && !reduced) return;
    const c = centreOf(word, end);
    if (c === null) return;
    const ms = playing && !reduced ? slideMs(intensity, wpm) * slow : 0;
    setX(markX() - c, ms);
  }, [word, end, mode, playing]);

  useEffect(() => {
    if (mode !== "glide" || !playing || reduced) return;
    let frame = requestAnimationFrame(function tick() {
      glide();
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, playing, text]);

  useEffect(() => {
    const onResize = () => {
      const { word, end } = latest.current;
      const c = centreOf(word, end);
      if (c !== null) setX(markX() - c, 0);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });

  return (
    <div className="rsvp ribbon" ref={box} style={{ "--rw-dim": NEIGHBOURS[intensity] } as React.CSSProperties}>
      <div className="rsvp-guide top" />
      <div className="rsvp-word ribbon-row" aria-live="off">
        <div className="ribbon-strip" ref={strip}>
          {text}
        </div>
      </div>
      <div className="rsvp-guide bottom" />
    </div>
  );
}

function windowAround(words: string[], word: number) {
  return { words, first: Math.max(0, word - BEHIND), last: Math.min(words.length, word + AHEAD) };
}
