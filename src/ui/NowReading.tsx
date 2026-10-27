import { AnimatePresence, motion, useDragControls } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { pause, reader, seek, setLiveRate, setOpen, setWpm, stepSentence, toggle } from "../reader/reader";
import { estimateMs, formatClock, formatDuration } from "../reader/rsvp";
import type { ReaderFont } from "../store/db";
import { library, updateSettings } from "../store/library";
import { useStore } from "../store/store";
import { ChapterComplete, ChapterIntro } from "./ChapterCards";
import { Cover } from "./Cover";
import { land, takeOff } from "./coverFlight";
import { ContextView } from "./ContextView";
import { BackIcon, CheckIcon, ChevronDownIcon, ForwardIcon, ListIcon, PauseIcon, PlayIcon } from "./icons";
import { Slider } from "./Slider";
import { WordDisplay } from "./WordDisplay";

const FONTS: ReaderFont[] = ["sans", "serif", "iowan", "charter", "athelas", "rounded"];
const FONT_NAMES: Record<ReaderFont, string> = {
  sans: "SF Pro",
  serif: "New York",
  iowan: "Iowan",
  charter: "Charter",
  athelas: "Athelas",
  rounded: "SF Rounded",
};

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
  const completed = useStore(reader, (s) => s.completed);
  const atChapterStart = useStore(reader, (s) => !s.playing && s.word === 0);
  const font = useStore(library, (s) => s.settings.font);
  const [showChapters, setShowChapters] = useState(false);
  const dragControls = useDragControls();
  const dragged = useRef(false);
  const sheetRef = useRef<HTMLElement>(null);

  /** The big cover on a chapter card if one is showing, else the one in the header. */
  const flightTarget = () =>
    sheetRef.current?.querySelector<HTMLElement>('[data-flight-target="hero"]') ??
    sheetRef.current?.querySelector<HTMLElement>('[data-flight-target="header"]');

  // The sheet mounts at translateY(100%); land the cover where it will be once the slide finishes.
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const offset = sheet.getBoundingClientRect().top - parseFloat(getComputedStyle(sheet).top);
    land(flightTarget(), offset);
  }, []);

  const close = () => {
    takeOff(flightTarget());
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
        ref={sheetRef}
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
              <Cover book={book} className="sheet-cover" flightTarget="header" />
              <button
                className="sheet-heading"
                aria-label="Show chapters"
                onClick={() => {
                  if (dragged.current) return;
                  pause();
                  setShowChapters((v) => !v);
                }}
              >
                <div className="sheet-chapter">{book.chapters[chapter]?.title}</div>
                <div className="sheet-book">
                  Chapter {chapter + 1} of {book.chapters.length} · {book.title}
                </div>
              </button>
            </div>
          </header>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={showChapters ? "chapters" : completed !== null ? `done-${completed}` : atChapterStart ? `intro-${chapter}` : "reading"}
              className="sheet-main"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            >
              {showChapters ? (
                <ChapterPicker onPick={() => setShowChapters(false)} />
              ) : completed !== null ? (
                <ChapterComplete index={completed} onDone={close} />
              ) : atChapterStart ? (
                <ChapterIntro />
              ) : (
                <>
                  <Stage startDrag={startDrag} dragged={dragged} />
                  <div className={`context-wrap ${playing ? "hidden" : ""}`}>
                    <ContextView />
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

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
              className="footer-button font-button"
              onClick={() => updateSettings({ font: FONTS[(FONTS.indexOf(font) + 1) % FONTS.length] })}
              aria-label={`Reading font: ${FONT_NAMES[font]}. Tap to change.`}
            >
              <span className={`font-${font}`}>Aa</span>
              <span className="font-name">{FONT_NAMES[font] ?? FONT_NAMES.sans}</span>
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

/** wpm gained per pixel dragged down (or lost per pixel dragged up). */
const RATE_PER_PX = 3;
/** Speeds this close to zero hold still, so there's a clear stop between forwards and backwards. */
const HOLD_ZONE = 40;
const MAX_FORWARD = 1000;
const MAX_REVERSE = 600;
const MOVE_THRESHOLD = 8;

/**
 * The word, plus the speed gesture while reading: drag down to speed up, up to slow down, and keep going
 * up to read backwards. Letting go carries on forwards. A tap without dragging pauses.
 */
function Stage({ startDrag, dragged }: { startDrag: (e: React.PointerEvent) => void; dragged: React.RefObject<boolean> }) {
  const playing = useStore(reader, (s) => s.playing);
  const rate = useStore(reader, (s) => s.rate);
  const gesture = useRef<{ y: number; base: number; moved: boolean; rate: number } | null>(null);
  const suppressClick = useRef(false);

  const end = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.moved) return;
    suppressClick.current = true;
    // Reading backwards is a detour: on release, carry on at the speed you had before.
    if (g.rate > 0) setWpm(Math.min(MAX_FORWARD, Math.max(100, Math.round(g.rate / 10) * 10)));
    setLiveRate(null);
  };

  return (
    <div
      className={`stage ${playing ? "playing" : ""}`}
      onPointerDown={(e) => {
        suppressClick.current = false;
        dragged.current = false;
        if (!reader.get().playing) return startDrag(e);
        e.currentTarget.setPointerCapture(e.pointerId);
        const base = library.get().settings.wpm;
        gesture.current = { y: e.clientY, base, moved: false, rate: base };
      }}
      onPointerMove={(e) => {
        const g = gesture.current;
        if (!g) return;
        const dy = e.clientY - g.y;
        if (!g.moved && Math.abs(dy) < MOVE_THRESHOLD) return;
        g.moved = true;
        const raw = g.base + (dy - Math.sign(dy) * MOVE_THRESHOLD) * RATE_PER_PX;
        const clamped = Math.min(MAX_FORWARD, Math.max(-MAX_REVERSE, raw));
        g.rate = Math.abs(clamped) < HOLD_ZONE ? 0 : Math.round(clamped);
        setLiveRate(g.rate);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onClick={() => {
        if (dragged.current || suppressClick.current) return;
        toggle();
      }}
    >
      <AnimatePresence>
        {rate !== null && (
          <motion.div
            className={`speed-hud ${rate < 0 ? "reverse" : ""}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", bounce: 0, duration: 0.2 }}
          >
            {rate > 0 ? <ForwardIcon size={13} /> : rate < 0 ? <BackIcon size={13} /> : <PauseIcon size={11} />}
            <span>{rate === 0 ? "Hold" : `${Math.abs(rate)} wpm${rate < 0 ? " back" : ""}`}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <WordDisplay />
      <div className="stage-hint">
        {playing ? (rate === null ? "" : "↓ faster · ↑ slower") : "Tap to read · drag while reading to change speed"}
      </div>
    </div>
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
