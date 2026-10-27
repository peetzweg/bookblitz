import { motion } from "motion/react";
import { play, reader, seek } from "../reader/reader";
import { estimateMs, formatDuration } from "../reader/rsvp";
import { library } from "../store/library";
import { useStore } from "../store/store";
import { CheckIcon, PlayIcon, RestartIcon } from "./icons";

const RISE = { type: "spring", bounce: 0, duration: 0.5 } as const;

/** Full-screen title card at the start of every chapter. Reading starts only when you ask it to. */
export function ChapterIntro() {
  const book = useStore(reader, (s) => s.book)!;
  const index = useStore(reader, (s) => s.chapter);
  const wpm = useStore(library, (s) => s.settings.wpm);
  const chapter = book.chapters[index];

  return (
    <div className="chapter-card">
      <motion.div className="card-kicker" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={RISE}>
        Chapter {index + 1} of {book.chapters.length}
      </motion.div>
      <motion.h2
        className="card-title"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...RISE, delay: 0.05 }}
      >
        {chapter.title}
      </motion.h2>
      <motion.div className="card-meta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...RISE, delay: 0.12 }}>
        {formatDuration(estimateMs(chapter.words, wpm))} · {chapter.words.toLocaleString()} words
      </motion.div>
      <motion.button
        className="start-button"
        onClick={play}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...RISE, delay: 0.18 }}
      >
        <PlayIcon size={18} /> {index === 0 ? "Start Reading" : "Start Chapter"}
      </motion.button>
    </div>
  );
}

/** Shown when a chapter's last word has been read: a small celebration, then what's up next. */
export function ChapterComplete({ index, onDone }: { index: number; onDone: () => void }) {
  const book = useStore(reader, (s) => s.book)!;
  const wpm = useStore(library, (s) => s.settings.wpm);
  const done = book.chapters[index];
  const next = book.chapters[index + 1];
  const total = book.chapters.length;

  return (
    <div className="chapter-card">
      <motion.div
        className="complete-badge"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.45, duration: 0.6, delay: 0.05 }}
      >
        <CheckIcon size={40} />
      </motion.div>
      <motion.div className="card-kicker" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...RISE, delay: 0.15 }}>
        {next ? `Chapter ${index + 1} complete` : "Book finished"}
      </motion.div>
      <motion.h2
        className="card-title small"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...RISE, delay: 0.2 }}
      >
        {next ? done.title : book.title}
      </motion.h2>

      <motion.div className="book-tally" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...RISE, delay: 0.25 }}>
        <div className="bar">
          <motion.div
            className="bar-fill"
            initial={{ width: `${(index / total) * 100}%` }}
            animate={{ width: `${((index + 1) / total) * 100}%` }}
            transition={{ type: "spring", bounce: 0, duration: 0.9, delay: 0.4 }}
          />
        </div>
        <div className="card-meta">
          {index + 1} of {total} chapters read
        </div>
      </motion.div>

      {next ? (
        <motion.div className="up-next" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...RISE, delay: 0.45 }}>
          <div className="card-kicker">Up Next</div>
          <div className="up-next-title">{next.title}</div>
          <div className="card-meta">{formatDuration(estimateMs(next.words, wpm))}</div>
          <button className="start-button" onClick={play}>
            <PlayIcon size={18} /> Start Chapter {index + 2}
          </button>
        </motion.div>
      ) : (
        <motion.div className="complete-actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...RISE, delay: 0.45 }}>
          <button className="start-button" onClick={onDone}>
            Done
          </button>
          <button className="ghost-button" onClick={() => seek(0, 0)}>
            <RestartIcon size={16} /> Read Again
          </button>
        </motion.div>
      )}
    </div>
  );
}
