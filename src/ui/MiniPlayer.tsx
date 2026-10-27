import { AnimatePresence, motion } from "motion/react";
import { useLayoutEffect, useRef } from "react";
import { play, reader, setOpen } from "../reader/reader";
import { useStore } from "../store/store";
import { Cover } from "./Cover";
import { hasPendingFlight, land, takeOff } from "./coverFlight";
import { PlayIcon } from "./icons";

/** Floating bar that keeps the current book one tap away, like Apple Music's mini player. */
export function MiniPlayer() {
  const show = useStore(reader, (s) => !!s.book && !s.open);
  return <AnimatePresence>{show && <Bar key="mini" />}</AnimatePresence>;
}

function Bar() {
  const book = useStore(reader, (s) => s.book)!;
  const chapter = useStore(reader, (s) => s.chapter);
  const fraction = useStore(reader, (s) => {
    const total = s.content?.[s.chapter]?.words.length ?? 0;
    return total ? Math.round(((s.word + 1) / total) * 200) / 200 : 0;
  });
  const ref = useRef<HTMLDivElement>(null);
  const cover = () => ref.current?.querySelector<HTMLElement>(".mini-cover");
  // Coming back from the reader, the cover flies down into this bar, so the bar must already be in place.
  const arriving = useRef(hasPendingFlight()).current;

  useLayoutEffect(() => {
    land(cover());
  }, []);

  const openReader = (thenPlay: boolean) => {
    takeOff(cover());
    setOpen(true);
    // Let the sheet settle before the first word, so it isn't missed.
    if (thenPlay) setTimeout(play, 500);
  };

  return (
    <motion.div
      ref={ref}
      className="mini-player"
      initial={arriving ? false : { opacity: 0, transform: "translateY(24px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      exit={{ opacity: 0, transform: "translateY(24px)" }}
      transition={{ type: "spring", bounce: 0, duration: 0.35 }}
    >
      <button className="mini-main pressable" onClick={() => openReader(false)}>
        <Cover book={book} className="mini-cover" />
        <span className="mini-text">
          <span className="mini-title">{book.title}</span>
          <span className="mini-chapter">{book.chapters[chapter]?.title}</span>
        </span>
      </button>
      <button className="icon-button mini-play" aria-label="Read" onClick={() => openReader(true)}>
        <PlayIcon size={24} />
      </button>
      <div className="mini-progress" style={{ transform: `scaleX(${fraction})` }} />
    </motion.div>
  );
}
