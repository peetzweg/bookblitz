# bookblitz — plan

A local-first speed-reading (RSVP) web app for EPUBs. It works like Apple Music for books:
a library of covers, a book page laid out like an album with its chapters as the tracklist, a mini
player that follows you around, and a full-screen "Now Reading" sheet that shows one word at a time,
the way Swift Read does.

## Principles

- **EPUB first.** The app is about books you own. Reading web articles is a later feature.
- **Local first.** EPUBs are parsed in the browser. Nothing is uploaded. Everything (library, parsed
  text, covers, progress, settings) lives in IndexedDB. Works offline once loaded (PWA).
- **Never lose your place.** Progress saves on pause, on chapter change, every few seconds while
  reading, and when the tab is hidden or closed.
- **Feels native on a phone.** Safe areas, `100dvh`, no tap flash, no sticky hover, press feedback on
  pointer-down, spring-driven sheet you can drag to dismiss, translucent chrome, system font,
  light and dark mode.

## Screens

| Screen | Apple Music analogue | Contents |
| --- | --- | --- |
| Library | Listen Now + Library → Albums | **Currently Reading** carousel (cover-tinted cards with chapter, progress, time left, play), **Recently Added** shelf (once there are 4+ books), **All Books** grid with an All / Reading / Unread / Finished filter |
| Book | Album page | Big cover with finished badge, title, author, progress bar and time left, Resume / From Start (or Start Reading / Read Again), chapter list with checkmarks, the current chapter's progress and per-chapter time |
| Mini player | Mini player bar | Cover, title, chapter, play/pause, thin progress line. Tap to expand |
| Now Reading | Now Playing sheet | RSVP word display, chapter scrubber with elapsed / remaining time, back / play / forward, WPM slider (where volume sits), chapter list button |

## Completion indicators

Every book is in one of three states: **unread**, **reading** or **finished**.

- Grid and shelf: unread books get an accent dot next to the title. Books in progress get a progress line along the bottom of the cover (like Apple TV's Up Next), plus "% · time left". Finished books get a check badge.
- Book page: overall progress bar, checkmarks on chapters you've read, a progress bar under the current chapter, and Mark as Finished / Mark as Unread.
- Reaching the last word marks a book finished, and "Read Again" starts it over.

## Reading engine (Swift Read-style RSVP)

- One word at a time, with the **optimal recognition point** letter in the accent colour, pinned at a
  fixed horizontal position (slightly left of centre) between two guide rules with tick marks.
- Timing per word: `60000 / wpm`, multiplied for punctuation (sentence end ×2.2, clause ×1.5),
  paragraph end ×2.6, long words, and numbers. It ramps up over the first few words after you press play.
- **Chapters are sessions.** Every chapter opens on a full-screen title card ("Chapter 3 of 15", title,
  length) with a Start button. When the last word of a chapter is read, reading stops and a completion
  screen celebrates it, shows book progress, and offers the next chapter as Up Next, which you start
  on purpose. The last chapter ends on a "Book finished" screen.
- **Speed gesture.** While reading, hold the word and drag: down is faster, up is slower. Past a short
  stop zone, up reads backwards, faster the further you go. Letting go carries on forwards: at the new
  speed if you sped up or slowed down, at the previous speed if you went backwards. A tap without
  dragging pauses.
- The chapter name at the top of the reader opens the chapter index (read chapters checked); tap one to jump.
- Tap the word to play or pause. When paused, the surrounding text shows up with the current word
  highlighted, and tapping any word jumps to it.
- Back / forward jump by sentence. Keyboard: space, ← →, ↑ ↓ for WPM.
- Screen Wake Lock is held while reading.

## Reading styles

Three styles, timed from the research brief in [docs/research/speed-reading.md](docs/research/speed-reading.md):
**Flow** (default: one word, time grows from 5 letters, pauses scale with sentence length and have
millisecond floors), **Phrases** (function words ride with the next content word, S-PTP style) and
**Calm** (longer pauses for dense text). The first play shows a taste test where each style reads the
same passage live. Phase 2 from the brief: a rare-word bonus (needs a frequency list) and hyphen-splitting
words of 14+ letters.

## Data model (IndexedDB)

- `books`: id (content hash), title, author, cover blob, chapter list (title + word count), total words, added / last opened
- `content`: id → per-chapter `words[]` and paragraph-start indices (parsed once at import)
- `progress`: bookId → chapter, word, updatedAt
- `settings`: wpm, last book

Re-importing the same file gives the same id, so progress survives.

## EPUB parsing

Unzip with `fflate`, then `container.xml` → OPF → metadata, manifest, spine, and cover. The TOC comes
from the EPUB 3 nav doc, falling back to the EPUB 2 NCX. Spine items the TOC points at start a new chapter.
Other spine items are folded into the chapter before them. Text is pulled from each XHTML body with
paragraph boundaries kept.

## Stack

Vite + React + TypeScript, plain CSS, `motion` for the springs, `idb`, `fflate`, `vite-plugin-pwa`.
It builds to a static site, so it can be hosted anywhere.

## Hosting

Static `dist/`. Options: Netlify (`netlify.toml` included) or the Coolify server (static site / nginx).

## iOS caveat

Safari can evict site storage for sites you haven't visited in 7 days. **Add to Home Screen**
(installed PWAs are exempt), and the app also requests persistent storage.

## Milestones

1. **Draft (this):** import, library, book page, RSVP reader, mini player and sheet, progress, PWA.
2. Polish: bookmarks/highlights, per-book WPM, font/size settings, context-menu delete, reading stats.
3. Later: reading web articles (save a URL, read it like a short book).
4. Optional sync between devices (export/import file first, a server later if it's worth it).
