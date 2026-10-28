<p align="center">
  <img src="public/favicon.svg" width="96" height="96" alt="">
</p>

<h1 align="center">bookblitz</h1>

<p align="center">
  <strong>Speed-read your own EPUBs, one word at a time.</strong><br>
  Local first. Bring your own books. Works offline.
</p>

<p align="center">
  <a href="https://peetzweg.github.io/bookblitz/"><strong>Open bookblitz →</strong></a>
</p>

<p align="center">
  <a href="https://ko-fi.com/peetzweg">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/support_me_on_kofi_beige.png">
      <img src="docs/support_me_on_kofi_dark.png" width="200" alt="Support me on Ko-fi">
    </picture>
  </a>
</p>

<p align="center">
  <img src="docs/demo.gif" width="720" alt="The opening lines of Alice in Wonderland flashing one word at a time in the bookblitz reader, each word's focus letter in green on a fixed mark">
  <br>
  <sub>The opening of <em>Alice in Wonderland</em> at 300 words per minute, timed by the app's own reader.</sub>
</p>

bookblitz is a speed reader for books you already have. Drop in an EPUB and read it one word at a time,
with the focus letter pinned in place so your eyes never move. It's an installable web app that feels at home
on a phone: a library like Apple Music's, a book page like an album, and a reader that slides up like Now
Playing.

## Your books stay yours

- **EPUB first.** Import from Files, iCloud Drive or your computer. EPUBs are parsed in your
  browser.
- **Local first.** Your library, covers, reading progress and settings live in your browser's storage
  (IndexedDB). There's no account and no server, and nothing is uploaded.
- **Offline.** Once it has loaded, or once it's on your Home Screen, bookblitz works with no connection:
  on a plane, on the underground, anywhere.

## Reading

- **Reading styles timed from research.** Flow (one word, with extra time for long words and sentence
  ends), Phrases (short words ride along with the next one) and Calm. A taste test on first launch helps
  you pick one. The reasoning and sources are in [docs/research/speed-reading.md](docs/research/speed-reading.md).
- **Guided reading (experimental).** Or keep the text on the page and let a guide pace your eyes through it:
  a highlight, a pen-like pacer, sentence or line focus, or a teleprompter scroll, all on the same timing.
  The research is in [docs/research/guided-reading.md](docs/research/guided-reading.md).
- **A steady focus point.** The recognition letter sits on a fixed mark, so nothing on screen moves
  between words.
- **Chapters are sessions.** Each chapter opens on a title card and ends on a short celebration, with the
  next chapter ready when you are.
- **Drag to change speed.** While reading, drag up to go faster and down to slow down. Keep going down to
  read backwards. Tap to pause and see the word in its paragraph.
- **Never lose your place.** Progress saves as you read, when you pause and when you close the app.

**Keyboard:** <kbd>Space</kbd> play/pause · <kbd>↑</kbd> <kbd>→</kbd> faster · <kbd>↓</kbd> <kbd>←</kbd> slower ·
<kbd>Shift</kbd>+<kbd>←</kbd>/<kbd>→</kbd> previous/next sentence · <kbd>Esc</kbd> close the reader

## Install it

- **iPhone and iPad:** open the link in Safari, tap Share, then *Add to Home Screen*. The Home Screen app
  keeps its own library, separate from Safari's, so import your books there.
- **Android and desktop Chrome or Edge:** use *Install* in the address bar or in the in-app banner.

## Develop

```sh
pnpm install
pnpm dev      # http://localhost:5173, also on your LAN for testing on a phone
pnpm build    # static site in dist/
pnpm preview  # serve the build, service worker included
```

Vite, React and TypeScript, with plain CSS. [`motion`](https://motion.dev) drives the sheet,
[`idb`](https://github.com/jakearchibald/idb) wraps IndexedDB, [`fflate`](https://github.com/101arrowz/fflate) unzips
EPUBs, and [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app) generates the service worker and icons.

| Path | What's there |
| --- | --- |
| `src/epub/` | EPUB parsing: spine, table of contents, cover, text |
| `src/reader/` | The reading engine: frame clock, timing per reading style, focus letter |
| `src/store/` | IndexedDB and the library store |
| `src/ui/` | Screens, the reader sheet, transitions |
| `docs/research/` | Research briefs behind the timing and the word-transition experiments |
| `scripts/og/` | Renders the share image, video and README demo using the app's own timing |

**Deploys:** every push to `main` builds to GitHub Pages ([workflow](.github/workflows/pages.yml)). The build
reads `BASE_PATH` (where the app is served from) and `SITE_URL` (used for canonical and share links). Both
fall back to sensible defaults on Vercel and Netlify.

## Support

bookblitz is free, has no ads and no tracking, and is built by one person. If it helps you read more, you can
[buy me a coffee on Ko-fi](https://ko-fi.com/peetzweg) or [sponsor me on GitHub](https://github.com/sponsors/peetzweg).

## Credits

The bundled sample, *Alice's Adventures in Wonderland* by Lewis Carroll, comes from
[Project Gutenberg](https://www.gutenberg.org/ebooks/11) and is in the public domain.

## License

[MIT](LICENSE)
