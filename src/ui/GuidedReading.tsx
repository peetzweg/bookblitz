import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tokenize } from "../epub/parse";
import { lineReturnMs, reader, readingProgress, setLineStartTest } from "../reader/reader";
import { buildFrames, DEFAULT_STYLE, frameTiming, paragraphEnds, rampFactor, STYLES } from "../reader/timing";
import { library } from "../store/library";
import { useStore } from "../store/store";
import type { GuideId } from "./guides";
import { GuidedText } from "./GuidedText";

/** The chapter being read, with the guide from settings, driven by the reader's clock. */
export function GuidedReading() {
  const content = useStore(reader, (s) => s.content?.[s.chapter]);
  const word = useStore(reader, (s) => s.word);
  const end = useStore(reader, (s) => s.frameEnd);
  const playing = useStore(reader, (s) => s.playing);
  const settings = useStore(library, (s) => s.settings);
  if (!content) return null;
  return (
    <GuidedText
      words={content.words}
      paras={content.paras.length ? content.paras : NO_PARAS}
      word={word}
      end={end}
      guide={settings.guide ?? "flash"}
      gradient={settings.guideGradient}
      bold={settings.guideBold}
      playing={playing}
      progress={readingProgress}
      onLineStarts={setLineStartTest}
    />
  );
}

const NO_PARAS = [0];

/** Public domain (Carroll, 1865): two paragraphs, so the preview shows line and paragraph changes. */
const FIRST = tokenize(
  "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”",
);
const SECOND = tokenize(
  "So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.",
);
const SAMPLE = [...FIRST, ...SECOND];
const SAMPLE_PARAS = [0, FIRST.length];
const SAMPLE_ENDS = paragraphEnds(SAMPLE_PARAS, SAMPLE.length);
const LOOP_PAUSE_MS = 1200;

/** The settings preview: the sample on a loop, with the real timing, your speed and style. */
export function GuidedSample({ guide }: { guide: GuideId }) {
  const wpm = useStore(library, (s) => s.settings.wpm);
  const styleId = useStore(library, (s) => s.settings.style ?? DEFAULT_STYLE);
  const gradient = useStore(library, (s) => s.settings.guideGradient);
  const bold = useStore(library, (s) => s.settings.guideBold);
  const style = STYLES[styleId] ?? STYLES[DEFAULT_STYLE];
  const starts = useMemo(() => buildFrames(SAMPLE, SAMPLE_ENDS, style), [style]);
  const [index, setIndex] = useState(0);
  const clock = useRef({ startedAt: 0, holdMs: 0, readMs: 1 });
  const startsLine = useRef<((word: number) => boolean) | null>(null);
  const onLineStarts = useCallback((test: ((word: number) => boolean) | null) => (startsLine.current = test), []);

  useEffect(() => setIndex(0), [styleId]);

  useEffect(() => {
    const i = Math.min(index, starts.length - 1);
    const end = starts[i + 1] ?? SAMPLE.length;
    const last = i >= starts.length - 1;
    const { readMs, pauseMs } = frameTiming(SAMPLE, starts[i], end, SAMPLE_ENDS, style, wpm, rampFactor(i, style));
    const holdMs = startsLine.current?.(starts[i]) ? lineReturnMs(wpm) : 0;
    clock.current = { startedAt: performance.now(), holdMs, readMs };
    const timer = setTimeout(() => setIndex(last ? 0 : i + 1), holdMs + readMs + pauseMs + (last ? LOOP_PAUSE_MS : 0));
    return () => clearTimeout(timer);
  }, [index, starts, style, wpm]);

  const i = Math.min(index, starts.length - 1);
  return (
    <GuidedText
      words={SAMPLE}
      paras={SAMPLE_PARAS}
      word={starts[i]}
      end={starts[i + 1] ?? SAMPLE.length}
      guide={guide}
      gradient={gradient}
      bold={bold}
      playing
      progress={() => {
        const { startedAt, holdMs, readMs } = clock.current;
        return Math.min(1, Math.max(0, (performance.now() - startedAt - holdMs) / readMs));
      }}
      eyeLine={0.38}
      onLineStarts={onLineStarts}
    />
  );
}
