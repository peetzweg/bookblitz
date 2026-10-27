import { useEffect, useRef, useState } from "react";
import { bookStatus, library, percentRead, removeBook, setFinished } from "../store/library";
import { useStore } from "../store/store";
import { closeBook, openBook, reader, seek } from "../reader/reader";
import { estimateMs, formatDuration } from "../reader/rsvp";
import { Cover } from "./Cover";
import { takeOff } from "./coverFlight";
import { CheckCircleIcon, CheckIcon, ChevronLeftIcon, PlayIcon, RestartIcon } from "./icons";
import { goBack } from "./router";

export function BookPage({ id }: { id: string }) {
  const book = useStore(library, (s) => s.books.find((b) => b.id === id));
  const progress = useStore(library, (s) => s.progress[id]);
  const ready = useStore(library, (s) => s.ready);
  const wpm = useStore(library, (s) => s.settings.wpm);
  const activeChapter = useStore(reader, (s) => (s.book?.id === id ? s.chapter : -1));
  const activeWord = useStore(reader, (s) => (s.book?.id === id ? s.word : 0));
  const playing = useStore(reader, (s) => s.book?.id === id && s.playing);

  const titleRef = useRef<HTMLHeadingElement>(null);
  const [titleHidden, setTitleHidden] = useState(false);
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setTitleHidden(!entry.isIntersecting), {
      rootMargin: "-56px 0px 0px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [book?.id]);

  if (!book) {
    return (
      <main className="page">
        <NavBar title="" showTitle={false} />
        {ready && <p className="muted center">This book isn't in your library anymore.</p>}
      </main>
    );
  }

  const status = bookStatus(progress);
  const loaded = activeChapter >= 0;
  // A finished book has no "current" chapter until you open it again.
  const current = loaded && (playing || status !== "finished") ? activeChapter : status === "reading" ? progress!.chapter : -1;
  const pct = percentRead(book, progress);
  const left = formatDuration(estimateMs(book.totalWords * (1 - pct), wpm));

  /** Opens the reader with this page's cover flying into it. */
  const startReading = (opts?: Parameters<typeof openBook>[1]) => {
    takeOff(document.querySelector<HTMLElement>(".book-cover"));
    return opts ? openBook(book.id, opts) : openBook(book.id);
  };

  const markFinished = (finished: boolean) => {
    if (loaded) {
      const last = book.chapters.length - 1;
      if (finished) seek(last, book.chapters[last].words - 1, false);
      else seek(0, 0, false);
    }
    setFinished(book, finished);
  };

  return (
    <main className="page book-page">
      <NavBar title={book.title} showTitle={titleHidden} />

      <section className="book-hero">
        <div className="book-cover-wrap">
          <Cover book={book} className="book-cover" />
          {status === "finished" && <CheckCircleIcon size={34} className="cover-badge large" />}
        </div>
        <h1 className="book-title" ref={titleRef}>
          {book.title}
        </h1>
        <div className="book-author">{book.author}</div>

        <div className="book-progress">
          {status === "reading" && (
            <>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${pct * 100}%` }} />
              </div>
              <div className="book-meta">
                {Math.max(1, Math.round(pct * 100))}% read · {left} left at {wpm} wpm
              </div>
            </>
          )}
          {status === "finished" && (
            <div className="book-meta finished">
              <CheckIcon size={14} /> Finished · {book.chapters.length} chapters
            </div>
          )}
          {status === "new" && (
            <div className="book-meta">
              {book.chapters.length} chapters · {left} at {wpm} wpm
            </div>
          )}
        </div>

        <div className={`book-actions ${status === "reading" ? "" : "single"}`}>
          {status === "reading" && (
            <>
              <button className="pill-button" onClick={() => startReading()}>
                <PlayIcon size={16} /> Resume
              </button>
              <button className="pill-button" onClick={() => startReading({ chapter: 0, word: 0 })}>
                <RestartIcon size={16} /> From Start
              </button>
            </>
          )}
          {status === "new" && (
            <button className="pill-button filled" onClick={() => startReading({ chapter: 0, word: 0 })}>
              <PlayIcon size={16} /> Start Reading
            </button>
          )}
          {status === "finished" && (
            <button className="pill-button" onClick={() => startReading({ chapter: 0, word: 0 })}>
              <RestartIcon size={16} /> Read Again
            </button>
          )}
        </div>
      </section>

      <ol className="chapter-list">
        {book.chapters.map((chapter, i) => {
          const isCurrent = i === current;
          const read = status === "finished" ? !isCurrent : i < current;
          const wordInChapter = isCurrent && loaded ? activeWord : isCurrent ? (progress?.word ?? 0) : 0;
          const chapterPct = isCurrent ? wordInChapter / Math.max(chapter.words, 1) : 0;
          return (
            <li key={i}>
              <button
                className={`chapter-row pressable ${isCurrent ? "current" : ""} ${read ? "read" : ""}`}
                onClick={() => (isCurrent ? startReading() : startReading({ chapter: i, word: 0 }))}
              >
                <span className="chapter-index">{isCurrent ? <Equalizer playing={playing} /> : i + 1}</span>
                <span className="chapter-main">
                  <span className="chapter-title">{chapter.title}</span>
                  {isCurrent && (
                    <span className="chapter-bar">
                      <i style={{ width: `${Math.max(chapterPct, 0.02) * 100}%` }} />
                    </span>
                  )}
                </span>
                <span className="chapter-time">
                  {read ? (
                    <CheckIcon size={16} className="chapter-check" />
                  ) : isCurrent ? (
                    `${formatDuration(estimateMs(chapter.words - wordInChapter, wpm))} left`
                  ) : (
                    formatDuration(estimateMs(chapter.words, wpm))
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <footer className="book-footer">
        <div className="muted">
          {book.totalWords.toLocaleString()} words · Added {new Date(book.addedAt).toLocaleDateString()}
        </div>
        <div className="footer-actions">
          {status !== "finished" && (
            <button className="text-button tint" onClick={() => markFinished(true)}>
              Mark as Finished
            </button>
          )}
          {status !== "new" && (
            <button className="text-button tint" onClick={() => markFinished(false)}>
              Mark as Unread
            </button>
          )}
        </div>
        <button
          className="text-button destructive"
          onClick={async () => {
            if (!confirm(`Remove “${book.title}” and its reading progress from this device?`)) return;
            if (reader.get().book?.id === book.id) closeBook();
            await removeBook(book.id);
            goBack();
          }}
        >
          Remove from Library
        </button>
      </footer>
    </main>
  );
}

function NavBar({ title, showTitle }: { title: string; showTitle: boolean }) {
  return (
    <header className={`nav-bar ${showTitle ? "scrolled" : ""}`}>
      <button className="nav-back tint" onClick={goBack}>
        <ChevronLeftIcon size={22} />
        Library
      </button>
      <div className="nav-title">{title}</div>
      <div className="nav-spacer" />
    </header>
  );
}

function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className={`equalizer ${playing ? "playing" : ""}`} aria-label={playing ? "Reading" : "Current chapter"}>
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
