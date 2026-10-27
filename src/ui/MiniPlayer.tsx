import { AnimatePresence, motion } from "motion/react";
import { play, reader, setOpen } from "../reader/reader";
import { useStore } from "../store/store";
import { Cover } from "./Cover";
import { PlayIcon } from "./icons";

/** Floating bar that keeps the current book one tap away, like Apple Music's mini player. */
export function MiniPlayer() {
  const book = useStore(reader, (s) => s.book);
  const open = useStore(reader, (s) => s.open);
  const chapter = useStore(reader, (s) => s.chapter);
  const fraction = useStore(reader, (s) => {
    const total = s.content?.[s.chapter]?.words.length ?? 0;
    return total ? Math.round(((s.word + 1) / total) * 200) / 200 : 0;
  });

  return (
    <AnimatePresence>
      {book && !open && (
        <motion.div
          className="mini-player"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.35 }}
        >
          <button className="mini-main pressable" onClick={() => setOpen(true)}>
            <Cover book={book} className="mini-cover" />
            <span className="mini-text">
              <span className="mini-title">{book.title}</span>
              <span className="mini-chapter">{book.chapters[chapter]?.title}</span>
            </span>
          </button>
          <button
            className="icon-button mini-play"
            aria-label="Read"
            onClick={() => {
              setOpen(true);
              // Let the sheet settle before the first word, so it isn't missed.
              setTimeout(play, 500);
            }}
          >
            <PlayIcon size={24} />
          </button>
          <div className="mini-progress" style={{ transform: `scaleX(${fraction})` }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
