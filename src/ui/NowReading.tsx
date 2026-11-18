import { AnimatePresence, motion, useDragControls } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { pause, play, reader, seek, setLiveRate, setOpen, setWpm, stepChapter, stepSentence, toggle } from "../reader/reader";
import { estimateMs, formatClock, formatDuration } from "../reader/rsvp";
import { library } from "../store/library";
import { useStore } from "../store/store";
import { ChapterComplete, ChapterIntro } from "./ChapterCards";
import { Cover } from "./Cover";
import { land, takeOff } from "./coverFlight";
import { TypePanel } from "./TypePanel";
import { ContextView } from "./ContextView";
import { FONT_NAMES } from "./fonts";
import { BackIcon, ChapterBackIcon, ChapterForwardIcon, CheckIcon, TextIcon, ChevronDownIcon, RhythmIcon, ForwardIcon, ListIcon, PauseIcon, PlayIcon } from "./icons";
import { Slider } from "./Slider";
import { StylePicker } from "./StylePicker";
import { DEFAULT_STYLE, STYLES } from "../reader/timing";
import { WordDisplay } from "./WordDisplay";
import { GuidedReading } from "./GuidedReading";
import { haptic } from "./haptics";
import { MAX_WPM, MIN_WPM } from "../store/db";


type Panel = "styles" | "chapters" | "type" | "text";

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
  const atStart = useStore(reader, (s) => s.word === 0);
  const font = useStore(library, (s) => s.settings.font);
  const textSize = useStore(library, (s) => s.settings.textSize ?? 1);
  /** What the main area shows instead of the reading view, if anything. */
  const [panel, setPanel] = useState<Panel | null>(null);
  const showChapters = panel === "chapters";
  const showStyles = panel === "styles";
  /** Opens a panel, or closes it if it's already open. Reading pauses for it. */
  const togglePanel = (next: Panel) => {
    pause();
    setPanel((p) => (p === next ? null : next));
  };
  const askStyle = useStore(reader, (s) => s.askStyle);
  const style = useStore(library, (s) => STYLES[s.settings.style ?? DEFAULT_STYLE] ?? STYLES[DEFAULT_STYLE]);
  const guided = useStore(library, (s) => (s.settings.guide ?? "flash") !== "flash");
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

  // Reading again closes whatever panel was open.
  useEffect(() => {
    if (playing) setPanel(null);
  }, [playing]);

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
      // Up/right is faster, down/left slower; with Shift, left/right jump a sentence.
      else if (e.shiftKey && e.key === "ArrowLeft") stepSentence(-1);
      else if (e.shiftKey && e.key === "ArrowRight") stepSentence(1);
      else if (e.key === "ArrowUp" || e.key === "ArrowRight") setWpm(wpm + 25);
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") setWpm(wpm - 25);
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

  // Chapter cards are a moment of their own: their Start button is the only control they need.
  const choosing = askStyle || showStyles;
  const onCard = !choosing && !showChapters && (completed !== null || atChapterStart);
  // Pausing doesn't change the view: the word (or the page) stays exactly where it was and the controls
  // fade in over it. The paragraph around the word is a panel of its own (Text).
  const reading = playing || (!choosing && !onCard && panel === null);
  const sheetMode = `${choosing ? "choosing-style" : onCard ? "on-card" : ""} ${reading ? "reading" : ""} ${playing ? "playing" : ""}`;

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
        className={`sheet reader-font-${font}`}
        style={{ "--tint": book.tint ?? "60 60 70", "--text-scale": textSize } as React.CSSProperties}
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
        <div className={`sheet-inner ${sheetMode}`}>
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
                  togglePanel("chapters");
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
              key={
                askStyle || showStyles
                  ? "styles"
                  : panel === "chapters" || panel === "type"
                    ? panel
                    : completed !== null
                      ? `done-${completed}`
                      : atChapterStart
                        ? `intro-${chapter}`
                        : "reading"
              }
              className="sheet-main"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            >
              {askStyle || showStyles ? (
                <StylePicker
                  onDone={() => {
                    setPanel(null);
                    // Picked on the way into the first read: carry on into it.
                    if (reader.get().askStyle) play();
                  }}
                />
              ) : showChapters ? (
                <ChapterPicker onPick={() => setPanel(null)} />
              ) : panel === "type" ? (
                <TypePanel guided={guided} />
              ) : completed !== null ? (
                <ChapterComplete index={completed} onDone={close} />
              ) : atChapterStart ? (
                <ChapterIntro />
              ) : (
                // The Text panel: the paragraph around the current word, highlighted. Tapping a word
                // jumps there; tapping anywhere else carries on reading. Under the reading view otherwise.
                <div className="context-wrap" onClick={play}>
                  <ContextView />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <Scrubber />

          <div className="transport">
            <button
              className="transport-button chapter"
              onClick={() => stepChapter(-1)}
              disabled={chapter === 0 && atStart}
              aria-label="Previous chapter"
            >
              <ChapterBackIcon size={24} />
            </button>
            <button className="transport-button" onClick={() => stepSentence(-1)} aria-label="Previous sentence">
              <BackIcon size={34} />
            </button>
            <button className="transport-button main" onClick={toggle} aria-label={playing ? "Pause" : "Read"}>
              {playing ? <PauseIcon size={46} /> : <PlayIcon size={46} />}
            </button>
            <button className="transport-button" onClick={() => stepSentence(1)} aria-label="Next sentence">
              <ForwardIcon size={34} />
            </button>
            <button
              className="transport-button chapter"
              onClick={() => stepChapter(1)}
              disabled={chapter === book.chapters.length - 1}
              aria-label="Next chapter"
            >
              <ChapterForwardIcon size={24} />
            </button>
          </div>

          <SpeedControl />

          <div className="sheet-footer">
            <button
              className={`footer-button font-button ${panel === "type" ? "on" : ""}`}
              onClick={() => togglePanel("type")}
              aria-label={`Text: ${FONT_NAMES[font]}. Tap to change the font and size.`}
            >
              <span className={`font-${font}`}>Aa</span>
              <span className="font-name">{FONT_NAMES[font] ?? FONT_NAMES.sans}</span>
            </button>
            <button
              className={`footer-button font-button ${showStyles ? "on" : ""}`}
              onClick={() => togglePanel("styles")}
              aria-label={`Reading style: ${style.name}. Tap to change.`}
            >
              <RhythmIcon size={20} />
              <span className="font-name">{style.name}</span>
            </button>
            <button
              className={`icon-button footer-button ${panel === "text" ? "on" : ""}`}
              onClick={() => togglePanel("text")}
              aria-label="Show the text around this word"
            >
              <TextIcon size={22} />
            </button>
            <button
              className={`icon-button footer-button ${showChapters ? "on" : ""}`}
              onClick={() => togglePanel("chapters")}
              aria-label="Chapters"
            >
              <ListIcon size={22} />
            </button>
          </div>
        </div>
        <ReadingOverlay shown={reading} />
      </motion.section>
    </>
  );
}

/** The fastest the speed line goes backwards: enough to scan back a paragraph, not to blur past it. */
const MAX_REVERSE = 400;
/** Speeds this close to zero snap to it, so stopping is easy to hit. */
const SNAP = 30;
/** A haptic tick every this many wpm the line passes. */
const TICK_EVERY = 50;
/** Room kept between the fastest speed and the edge of the screen. */
const EDGE_PX = 72;
const MOVE_THRESHOLD = 8;

/** How long the gesture hint stays up after reading starts. */
const HINT_MS = 2600;

interface SpeedGesture {
  y: number;
  base: number;
  rate: number;
  moved: boolean;
  /** Screen pixels per wpm: the fastest speed sits just above the bottom edge. */
  scale: number;
}

/**
 * While reading, everything else steps away: the word sits alone in the middle of the sheet, with a
 * hairline of chapter progress. The whole sheet is the touch surface. Tap to pause. Drag, and the speed
 * shows as a line: the middle of the screen is 0 wpm, below it is forwards, faster the lower it goes,
 * and above it is backwards. Letting go keeps a forward speed, stops at 0, and after reading backwards
 * carries on at the speed you had before.
 */
function ReadingOverlay({ shown }: { shown: boolean }) {
  const playing = useStore(reader, (s) => s.playing);
  const rate = useStore(reader, (s) => s.rate);
  const guided = useStore(library, (s) => (s.settings.guide ?? "flash") !== "flash");
  const gesture = useRef<SpeedGesture | null>(null);
  const suppressClick = useRef(false);
  const [hint, setHint] = useState(false);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    if (!playing) return setHint(false);
    setHint(true);
    const timer = setTimeout(() => setHint(false), HINT_MS);
    return () => clearTimeout(timer);
  }, [playing]);

  const end = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.moved) return;
    suppressClick.current = true;
    setLiveRate(null);
    if (g.rate > 0) setWpm(Math.round(g.rate / 10) * 10);
    else if (g.rate === 0) pause();
    // Reading backwards is a detour: on release, carry on at the speed you had before.
  };

  return (
    <div
      className={`reading-overlay ${shown ? "visible" : ""} ${shown && !playing ? "paused" : ""} ${guided ? "guided-overlay" : ""}`}
      aria-hidden={!shown}
      onPointerDown={(e) => {
        suppressClick.current = false;
        if (!reader.get().playing) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const base = library.get().settings.wpm;
        const scale = (e.currentTarget.clientHeight / 2 - EDGE_PX) / MAX_WPM;
        gesture.current = { y: e.clientY, base, rate: base, moved: false, scale };
        setScale(scale);
        setHint(false);
      }}
      onPointerMove={(e) => {
        const g = gesture.current;
        if (!g) return;
        // Down is faster (screen y grows downwards), up slows down, through 0 and on into reverse.
        const dy = e.clientY - g.y;
        if (!g.moved && Math.abs(dy) < MOVE_THRESHOLD) return;
        g.moved = true;
        const raw = Math.min(MAX_WPM, Math.max(-MAX_REVERSE, g.base + (dy - Math.sign(dy) * MOVE_THRESHOLD) / g.scale));
        const next = Math.abs(raw) < SNAP ? 0 : Math.round(raw);
        // A tick for every step the line passes, for snapping onto 0, and for reaching either end.
        const step = (r: number) => (r === 0 ? 0 : Math.sign(r) * Math.ceil(Math.abs(r) / TICK_EVERY));
        if (step(next) !== step(g.rate) || ((next === MAX_WPM || next === -MAX_REVERSE) && next !== g.rate)) haptic();
        g.rate = next;
        setLiveRate(next);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onClick={() => {
        if (!suppressClick.current) toggle();
      }}
    >
      <div className="reading-word">{guided ? <GuidedReading /> : <WordDisplay />}</div>
      <SpeedLines rate={rate} scale={scale} />
      <div className={`reading-hint ${hint ? "shown" : ""}`}>Tap to pause · drag ↓ faster, ↑ slower and back</div>
      <ChapterHairline />
    </div>
  );
}

/** The speed gesture on screen: a fixed line at 0 wpm across the middle, and the speed you're dragging. */
function SpeedLines({ rate, scale }: { rate: number | null; scale: number }) {
  const shown = rate !== null;
  // Keep the last position while fading out, rather than jumping back to the middle.
  const last = useRef(0);
  if (rate !== null) last.current = rate;
  const r = last.current;
  const label = r === 0 ? "Stop" : r > 0 ? `${r} wpm` : `${-r} wpm back`;
  return (
    <div className={`speed-lines ${shown ? "shown" : ""}`} aria-hidden>
      <div className="speed-line zero">
        <span>0</span>
      </div>
      <div
        className={`speed-line current ${r < 0 ? "reverse" : ""} ${r === 0 ? "stop" : ""}`}
        style={{ transform: `translateY(${r * scale}px)` }}
      >
        <span>{label}</span>
      </div>
    </div>
  );
}

function ChapterHairline() {
  const fraction = useStore(reader, (s) => {
    const total = s.content?.[s.chapter]?.words.length ?? 0;
    return total ? Math.round(((s.word + 1) / total) * 400) / 400 : 0;
  });
  return (
    <div className="chapter-hairline">
      <div style={{ transform: `scaleX(${fraction})` }} />
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
      <span className="speed-end">{MIN_WPM}</span>
      <Slider label="Words per minute" value={wpm} min={MIN_WPM} max={MAX_WPM} step={10} onChange={setWpm} />
      <span className="speed-end">{MAX_WPM}</span>
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
