import { AnimatePresence, motion, useDragControls } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { pause, reader, seek, setOpen, setWpm, stepSentence, toggle } from "../reader/reader";
import { estimateMs, formatClock, formatDuration } from "../reader/rsvp";
import type { ReaderFont } from "../store/db";
import { library, updateSettings } from "../store/library";
import { useStore } from "../store/store";
import { ContextView } from "./ContextView";
import { BackIcon, CheckIcon, ChevronDownIcon, ForwardIcon, ListIcon, PauseIcon, PlayIcon } from "./icons";
import { Slider } from "./Slider";
import { WordDisplay } from "./WordDisplay";

const FONTS: ReaderFont[] = ["sans", "serif", "rounded", "mono"];
const FONT_NAMES: Record<ReaderFont, string> = { sans: "SF Pro", serif: "New York", rounded: "SF Pro Rounded", mono: "SF Mono" };

const SHEET_SPRING = { type: "spring", bounce: 0, duration: 0.45 } as const;
const DISMISS_DISTANCE = 140;
const DISMISS_VELOCITY = 600;

export function NowReading() {
  const open = useStore(reader, (s) => s.open && !!s.book);
  return <AnimatePresence>{open && <Sheet key="sheet" />}</AnimatePresence>;
}

function Sheet() {
  const book = useStore(reader, (s) => s.book)!;
  const chapter = useStore(reader, (s) => s.chapter);
  const playing = useStore(reader, (s) => s.playing);
  const font = useStore(library, (s) => s.settings.font);
  const [showChapters, setShowChapters] = useState(false);
  const dragControls = useDragControls();
  const dragged = useRef(false);

  const close = () => {
    pause();
    setOpen(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const wpm = library.get().settings.wpm;
      // Drop focus so a focused button doesn't also activate on keyup.
      if (e.key === " ") (document.activeElement as HTMLElement | null)?.blur();
      if (e.key === " ") toggle();
      else if (e.key === "ArrowLeft") stepSentence(-1);
      else if (e.key === "ArrowRight") stepSentence(1);
      else if (e.key === "ArrowUp") setWpm(Math.min(1000, wpm + 25));
      else if (e.key === "ArrowDown") setWpm(Math.max(100, wpm - 25));
      else if (e.key === "Escape") close();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const startDrag = (e: React.PointerEvent) => {
    dragged.current = false;
    dragControls.start(e);
  };

  return (
    <>
      <motion.div
        className="sheet-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={SHEET_SPRING}
      />
      <motion.section
        className="sheet"
        style={{ "--tint": book.tint ?? "60 60 70" } as React.CSSProperties}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={SHEET_SPRING}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 1 }}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={(_, info) => {
          if (info.offset.y > DISMISS_DISTANCE || info.velocity.y > DISMISS_VELOCITY) close();
        }}
        aria-label="Now Reading"
      >
        <div className={`sheet-inner reader-font-${font}`}>
          <header className="sheet-header" onPointerDown={startDrag}>
            <div className="grabber" />
            <div className="sheet-header-row">
              <button className="icon-button" onClick={close} aria-label="Close reader">
                <ChevronDownIcon size={26} />
              </button>
              <div className="sheet-heading">
                <div className="sheet-chapter">{book.chapters[chapter]?.title}</div>
                <div className="sheet-book">{book.title}</div>
              </div>
              <div className="icon-button-spacer" />
            </div>
          </header>

          {showChapters ? (
            <ChapterPicker onPick={() => setShowChapters(false)} />
          ) : (
            <>
              <div
                className={`stage ${playing ? "playing" : ""}`}
                onPointerDown={startDrag}
                onClick={() => {
                  if (!dragged.current) toggle();
                }}
              >
                <WordDisplay />
                <div className="stage-hint">{playing ? "" : "Tap to read"}</div>
              </div>
              <div className={`context-wrap ${playing ? "hidden" : ""}`}>
                <ContextView />
              </div>
            </>
          )}

          <Scrubber />

          <div className="transport">
            <button className="transport-button" onClick={() => stepSentence(-1)} aria-label="Previous sentence">
              <BackIcon size={34} />
            </button>
            <button className="transport-button main" onClick={toggle} aria-label={playing ? "Pause" : "Read"}>
              {playing ? <PauseIcon size={46} /> : <PlayIcon size={46} />}
            </button>
            <button className="transport-button" onClick={() => stepSentence(1)} aria-label="Next sentence">
              <ForwardIcon size={34} />
            </button>
          </div>

          <SpeedControl />

          <div className="sheet-footer">
            <button
              className="icon-button footer-button font-button"
              onClick={() => updateSettings({ font: FONTS[(FONTS.indexOf(font) + 1) % FONTS.length] })}
              aria-label={`Reading font: ${FONT_NAMES[font]}. Tap to change.`}
            >
              <span className={`font-${font}`}>Aa</span>
            </button>
            <button
              className={`icon-button footer-button ${showChapters ? "on" : ""}`}
              onClick={() => {
                pause();
                setShowChapters((v) => !v);
              }}
              aria-label="Chapters"
            >
              <ListIcon size={22} />
            </button>
          </div>
        </div>
      </motion.section>
    </>
  );
}

function Scrubber() {
  const chapter = useStore(reader, (s) => s.chapter);
  const word = useStore(reader, (s) => s.word);
  const total = useStore(reader, (s) => s.content?.[s.chapter]?.words.length ?? 1);
  const wpm = useStore(library, (s) => s.settings.wpm);
  return (
    <div className="scrubber">
      <Slider
        label="Position in chapter"
        value={word}
        min={0}
        max={Math.max(total - 1, 1)}
        onChange={(w) => seek(chapter, w, false)}
        onCommit={(w) => seek(chapter, w)}
      />
      <div className="scrubber-times">
        <span>{formatClock(estimateMs(word, wpm))}</span>
        <span>
          {word + 1} / {total}
        </span>
        <span>-{formatClock(estimateMs(total - word - 1, wpm))}</span>
      </div>
    </div>
  );
}

function SpeedControl() {
  const wpm = useStore(library, (s) => s.settings.wpm);
  return (
    <div className="speed">
      <span className="speed-end">100</span>
      <Slider label="Words per minute" value={wpm} min={100} max={1000} step={10} onChange={setWpm} />
      <span className="speed-end">1000</span>
      <div className="speed-value">{wpm} words per minute</div>
    </div>
  );
}

function ChapterPicker({ onPick }: { onPick: () => void }) {
  const book = useStore(reader, (s) => s.book)!;
  const current = useStore(reader, (s) => s.chapter);
  const wpm = useStore(library, (s) => s.settings.wpm);
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(".current");
    if (list.current && el) list.current.scrollTop = el.offsetTop - list.current.clientHeight / 3;
  }, []);

  return (
    <ol className="sheet-chapters" ref={list}>
      {book.chapters.map((c, i) => (
        <li key={i}>
          <button
            className={`sheet-chapter-row pressable ${i === current ? "current" : ""} ${i < current ? "read" : ""}`}
            onClick={() => {
              seek(i, 0);
              onPick();
            }}
          >
            <span className="chapter-index">{i + 1}</span>
            <span className="chapter-title">{c.title}</span>
            <span className="chapter-time">
              {i < current ? <CheckIcon size={16} className="chapter-check" /> : formatDuration(estimateMs(c.words, wpm))}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
