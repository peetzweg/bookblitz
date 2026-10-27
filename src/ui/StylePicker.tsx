import { useEffect, useMemo, useState } from "react";
import { buildFrames, DEFAULT_STYLE, frameDurationMs, paragraphEnds, rampFactor, STYLES, type StyleId } from "../reader/timing";
import { tokenize } from "../epub/parse";
import { library, updateSettings } from "../store/library";
import { useStore } from "../store/store";
import { CheckIcon } from "./icons";
import type { TransitionId } from "./transitions";
import { WordView } from "./WordDisplay";

/** Public domain (Carroll, 1865); has a long word, a clause, a question and a quote to feel the timing on. */
const SAMPLE = tokenize(
  "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”",
);
const SAMPLE_ENDS = paragraphEnds([0], SAMPLE.length);
/** Breather before the sample starts over. */
const LOOP_PAUSE_MS = 1200;

const ORDER: StyleId[] = ["flow", "phrases", "calm"];

/**
 * The reading-style taste test: each style plays the same passage at your speed, so you can feel the
 * difference instead of reading about it. Shown before the first read, and from the reader's footer.
 */
export function StylePicker({ onDone, embedded = false }: { onDone?: (style: StyleId) => void; embedded?: boolean }) {
  const current = useStore(library, (s) => s.settings.style ?? DEFAULT_STYLE);
  const firstTime = useStore(library, (s) => !s.settings.styleChosen);
  const [selected, setSelected] = useState<StyleId>(current);

  // The first time through, each style plays at its suggested speed; afterwards your own speed is kept.
  const select = (id: StyleId) => {
    setSelected(id);
    if (firstTime) updateSettings({ wpm: STYLES[id].defaultWpm });
  };
  useEffect(() => {
    if (firstTime) updateSettings({ wpm: STYLES[current].defaultWpm });
  }, []);

  return (
    <div className={`style-picker ${embedded ? "embedded" : ""}`}>
      <div className="style-preview">
        <SamplePlayer style={selected} />
      </div>
      {!embedded && (
        <div className="style-intro">
          <h2 className="card-title small">How do you like to read?</h2>
          <p className="card-meta">
            Each style reads the same lines at your speed. Pick the one that feels easiest; you can change it any time in Settings.
          </p>
        </div>
      )}
      <div className="style-options" role="radiogroup" aria-label="Reading style">
        {ORDER.map((id) => {
          const style = STYLES[id];
          return (
            <button
              key={id}
              role="radio"
              aria-checked={selected === id}
              className={`style-option pressable ${selected === id ? "selected" : ""}`}
              onClick={() => select(id)}
            >
              <span className="style-option-text">
                <span className="style-option-name">
                  {style.name}
                  {id === DEFAULT_STYLE && <span className="style-badge">Recommended</span>}
                </span>
                <span className="style-option-tagline">{style.tagline}</span>
              </span>
              <span className="style-check">{selected === id && <CheckIcon size={16} />}</span>
            </button>
          );
        })}
      </div>
      {embedded ? (
        <button
          className="pill-button filled"
          disabled={selected === current}
          onClick={() => {
            updateSettings({ style: selected, styleChosen: true });
            onDone?.(selected);
          }}
        >
          {selected === current ? `Reading with ${STYLES[selected].name}` : `Use ${STYLES[selected].name}`}
        </button>
      ) : (
        <button
          className="start-button"
          onClick={() => {
            updateSettings({ style: selected, styleChosen: true });
            onDone?.(selected);
          }}
        >
          Read with {STYLES[selected].name}
        </button>
      )}
    </div>
  );
}

/**
 * Plays the sample on a loop with the real timing functions and word transition, so a preview feels
 * exactly like reading. Both default to your current settings.
 */
export function SamplePlayer({ style: id, transition }: { style?: StyleId; transition?: TransitionId }) {
  const intensity = useStore(library, (s) => s.settings.transitionIntensity ?? "noticeable");
  const wpm = useStore(library, (s) => s.settings.wpm);
  const savedStyle = useStore(library, (s) => s.settings.style ?? DEFAULT_STYLE);
  const savedTransition = useStore(library, (s) => s.settings.transition ?? "cut");
  id ??= savedStyle;
  transition ??= savedTransition;
  const style = STYLES[id];
  const starts = useMemo(() => buildFrames(SAMPLE, SAMPLE_ENDS, style), [style]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [id]);

  useEffect(() => {
    const start = starts[index];
    const end = starts[index + 1] ?? SAMPLE.length;
    const last = index >= starts.length - 1;
    const delay = frameDurationMs(SAMPLE, start, end, SAMPLE_ENDS, style, wpm, rampFactor(index, style)) + (last ? LOOP_PAUSE_MS : 0);
    const timer = setTimeout(() => setIndex(last ? 0 : index + 1), delay);
    return () => clearTimeout(timer);
  }, [index, starts, style, wpm]);

  const start = starts[Math.min(index, starts.length - 1)];
  const end = starts[index + 1] ?? SAMPLE.length;
  return <WordView text={SAMPLE.slice(start, end).join(" ")} frameKey={`${id}:${index}`} transition={transition} intensity={intensity} wpm={wpm} />;
}
