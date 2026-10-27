import { motion } from "motion/react";
import { useState } from "react";
import { openBook } from "../reader/reader";
import { estimateMs, formatDuration } from "../reader/rsvp";
import type { BookMeta, Progress } from "../store/db";
import { addSampleBook, bookStatus, library, percentRead, resetLibrary, retryLibrary, type BookStatus } from "../store/library";
import { useStore } from "../store/store";
import { Cover } from "./Cover";
import { takeOff } from "./coverFlight";
import { BookIcon, CheckCircleIcon, GearIcon, PlayIcon, PlusIcon } from "./icons";
import { InstallCard } from "./InstallCard";
import { openBookPage, openSettings } from "./router";

type Filter = "all" | BookStatus;

const FILTERS: { value: Filter; label: string; empty: string }[] = [
  { value: "all", label: "All", empty: "" },
  { value: "reading", label: "Reading", empty: "Nothing in progress. Pick a book and start reading." },
  { value: "new", label: "Unread", empty: "You've started every book in your library." },
  { value: "finished", label: "Finished", empty: "Books you finish show up here." },
];

/** "Recently Added" only earns its place once it would show something the grid doesn't. */
const SHELF_MIN_BOOKS = 4;

export function Library({ onAdd }: { onAdd: () => void }) {
  const books = useStore(library, (s) => s.books);
  const progress = useStore(library, (s) => s.progress);
  const ready = useStore(library, (s) => s.ready);
  const stuck = useStore(library, (s) => s.stuck);
  const importing = useStore(library, (s) => s.importing);
  const wpm = useStore(library, (s) => s.settings.wpm);
  const [filter, setFilter] = useState<Filter>("all");

  const status = (b: BookMeta) => bookStatus(progress[b.id]);
  const reading = books.filter((b) => status(b) === "reading");
  const recentlyAdded = [...books].sort((a, b) => b.addedAt - a.addedAt).slice(0, 12);
  const filtered = filter === "all" ? books : books.filter((b) => status(b) === filter);

  return (
    <main className="page">
      <header className="large-title-bar">
        <h1 className="large-title">Library</h1>
        <div className="title-actions">
          <button className="icon-button tint" onClick={openSettings} aria-label="Settings">
            <GearIcon size={22} />
          </button>
          <button className="icon-button tint" onClick={onAdd} aria-label="Add EPUB">
            <PlusIcon size={22} />
          </button>
        </div>
      </header>

      {ready && books.length > 0 && <InstallCard />}

      {stuck && !ready && (
        <section className="empty">
          <h2>Your library isn’t loading</h2>
          <p>Safari’s storage for this site seems to be stuck. Trying again keeps your books. If that doesn’t help, clear it and add your EPUBs again.</p>
          <button className="pill-button filled" onClick={retryLibrary}>
            Try Again
          </button>
          <button
            className="text-button destructive"
            onClick={() => {
              if (confirm("Clear all books and reading progress saved on this device?")) resetLibrary();
            }}
          >
            Clear and Start Over
          </button>
        </section>
      )}

      {ready && books.length === 0 && !importing && (
        <section className="empty">
          <BookIcon size={56} className="empty-icon" />
          <h2>Add your first book</h2>
          <p>Pick EPUBs from Files or iCloud Drive. They’re copied into the app, so your books and progress stay on this device.</p>
          <button className="pill-button filled" onClick={onAdd}>
            Add EPUB
          </button>
          <button className="text-button tint" onClick={addSampleBook}>
            Try Alice in Wonderland
          </button>
        </section>
      )}

      {reading.length > 0 && (
        <section className="section">
          <h2 className="section-title">Currently Reading</h2>
          <div className={`carousel ${reading.length === 1 ? "single" : ""}`}>
            {reading.map((book) => (
              <ReadingCard key={book.id} book={book} progress={progress[book.id]} wpm={wpm} />
            ))}
          </div>
        </section>
      )}

      {books.length >= SHELF_MIN_BOOKS && (
        <section className="section">
          <h2 className="section-title">Recently Added</h2>
          <div className="shelf">
            {recentlyAdded.map((book) => (
              <BookTile key={book.id} book={book} progress={progress[book.id]} wpm={wpm} slot="shelf" />
            ))}
          </div>
        </section>
      )}

      {(books.length > 0 || importing > 0) && (
        <section className="section">
          <h2 className="section-title">All Books</h2>
          {books.length > 1 && <Segmented value={filter} onChange={setFilter} />}
          <div className="grid">
            {filtered.map((book) => (
              <BookTile key={book.id} book={book} progress={progress[book.id]} wpm={wpm} slot="grid" />
            ))}
            {importing > 0 && (
              <div className="tile">
                <div className="cover cover-loading" />
                <div className="tile-title">Importing…</div>
              </div>
            )}
          </div>
          {filtered.length === 0 && !importing && <p className="filter-empty">{FILTERS.find((f) => f.value === filter)?.empty}</p>}
        </section>
      )}
    </main>
  );
}

function Segmented({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  return (
    <div className="segmented" role="tablist">
      {FILTERS.map((f) => (
        <button key={f.value} role="tab" aria-selected={value === f.value} className="segment" onClick={() => onChange(f.value)}>
          {value === f.value && (
            <motion.span layoutId="segment-indicator" className="segment-indicator" transition={{ type: "spring", bounce: 0, duration: 0.3 }} />
          )}
          <span className="segment-label">{f.label}</span>
        </button>
      ))}
    </div>
  );
}

function ReadingCard({ book, progress, wpm }: { book: BookMeta; progress: Progress; wpm: number }) {
  const chapter = book.chapters[progress.chapter];
  const pct = percentRead(book, progress);
  const left = estimateMs(book.totalWords * (1 - pct), wpm);
  return (
    <div
      className="reading-card pressable"
      style={{ "--tint": book.tint ?? "70 70 80" } as React.CSSProperties}
      onClick={(e) => openBookPage(book.id, e.currentTarget.querySelector<HTMLElement>(".cover"))}
    >
      <Cover book={book} className="reading-card-cover" coverKey={`card:${book.id}`} />
      <div className="reading-card-body">
        <div className="reading-card-kicker">
          Chapter {progress.chapter + 1} of {book.chapters.length}
        </div>
        <div className="reading-card-title">{book.title}</div>
        <div className="reading-card-chapter">{chapter?.title}</div>
        <div className="bar reading-card-bar">
          <div className="bar-fill" style={{ width: `${pct * 100}%` }} />
        </div>
        <div className="reading-card-footer">
          <div className="reading-card-stats">
            {Math.max(1, Math.round(pct * 100))}% · {formatDuration(left, true)} left
          </div>
          <button
            className="round-button light"
            aria-label={`Resume ${book.title}`}
            onClick={(e) => {
              e.stopPropagation();
              takeOff(e.currentTarget.closest(".reading-card")?.querySelector<HTMLElement>(".cover"));
              openBook(book.id);
            }}
          >
            <PlayIcon size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function BookTile({ book, progress, wpm, slot }: { book: BookMeta; progress?: Progress; wpm: number; slot: string }) {
  const status = bookStatus(progress);
  const pct = percentRead(book, progress);
  const detail =
    status === "finished"
      ? "Finished"
      : status === "reading"
        ? `${Math.max(1, Math.round(pct * 100))}% · ${formatDuration(estimateMs(book.totalWords * (1 - pct), wpm), true)} left`
        : `New · ${formatDuration(estimateMs(book.totalWords, wpm), true)}`;

  return (
    <button
      className={`tile pressable ${status}`}
      onClick={(e) => openBookPage(book.id, e.currentTarget.querySelector<HTMLElement>(".cover"))}
    >
      <div className="tile-cover">
        <Cover book={book} coverKey={`${slot}:${book.id}`} />
        {status === "reading" && (
          <div className="cover-progress">
            <div className="cover-progress-fill" style={{ width: `${Math.max(pct, 0.03) * 100}%` }} />
          </div>
        )}
        {status === "finished" && <CheckCircleIcon size={26} className="cover-badge" />}
      </div>
      <div className="tile-title">
        {status === "new" && <span className="new-dot" aria-label="Unread" />}
        {book.title}
      </div>
      <div className="tile-subtitle">{book.author}</div>
      <div className="tile-status">{detail}</div>
    </button>
  );
}
