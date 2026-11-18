import { AnimatePresence, motion } from "motion/react";
import { Fragment, useEffect, useMemo } from "react";
import { chunkAt, paragraphEnds } from "../reader/timing";

interface Props {
  words: string[];
  /** Index of each paragraph's first word. */
  paras: number[];
  /** The frame being read: its first word, and one past its last. */
  word: number;
  end: number;
  /** Receives a test for whether a word starts a card, so the clock gives the eye a moment to get there. */
  onLineStarts?: (test: ((word: number) => boolean) | null) => void;
}

const EASE = [0.33, 1, 0.68, 1] as const;
const SLIDE = { duration: 0.34, ease: EASE };

/**
 * Sentence cards: one sentence at a time (long ones in parts), laid out as ordinary text in the middle
 * of the screen, with the words being read lit up at your pace. The eye stays in one small, still place
 * as with flashed words, but reads normally within it: it sees the next words coming, the sentence's
 * shape and punctuation, and can glance back. The card before stays faintly above and the next one
 * faintly below; moving on, they all slide up one place.
 */
export function SentenceCards({ words, paras, word, end, onLineStarts }: Props) {
  const paraEnds = useMemo(() => paragraphEnds(paras, words.length), [paras, words]);
  const current = chunkAt(words, paraEnds, word);
  const prev = current.start > 0 ? chunkAt(words, paraEnds, current.start - 1) : null;
  const next = current.end < words.length ? chunkAt(words, paraEnds, current.end) : null;

  useEffect(() => {
    if (!onLineStarts) return;
    onLineStarts((w) => w > 0 && chunkAt(words, paraEnds, w).start === w);
    return () => onLineStarts(null);
  }, [onLineStarts, words, paraEnds]);

  const cards = [
    prev && { ...prev, role: "prev" as const },
    { ...current, role: "current" as const },
    next && { ...next, role: "next" as const },
  ].filter((c) => !!c);

  return (
    <div className="guided sentence-cards">
      <AnimatePresence initial={false} mode="popLayout">
        {cards.map((c) => (
          <motion.p
            key={c.start}
            layout="position"
            className={`sc-card sc-${c.role} ${paraEnds.has(c.start - 1) ? "sc-para" : ""}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: c.role === "current" ? 1 : 0.3, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={SLIDE}
          >
            {words.slice(c.start, c.end).map((w, i) => {
              const at = c.start + i;
              const state = c.role !== "current" ? "" : at >= word && at < end ? "sc-now" : at < word ? "sc-read" : "";
              return (
                <Fragment key={at}>
                  <span className={`sc-word ${state}`}>{w}</span>{" "}
                </Fragment>
              );
            })}
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  );
}
