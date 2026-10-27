import { parseEpub } from "../epub/parse";
import { db, DEFAULT_SETTINGS, type BookMeta, type Progress, type Settings } from "./db";
import { createStore } from "./store";

interface LibraryState {
  ready: boolean;
  books: BookMeta[];
  progress: Record<string, Progress>;
  settings: Settings;
  importing: number;
  toast?: string;
}

export const library = createStore<LibraryState>({
  ready: false,
  books: [],
  progress: {},
  settings: DEFAULT_SETTINGS,
  importing: 0,
});

export async function loadLibrary() {
  const [books, progress, settings] = await Promise.all([db.books(), db.allProgress(), db.settings()]);
  library.set({ ready: true, books: sortBooks(books, progress), progress, settings });
}

function sortBooks(books: BookMeta[], progress: Record<string, Progress>) {
  const recency = (b: BookMeta) => Math.max(b.openedAt, b.addedAt, progress[b.id]?.updatedAt ?? 0);
  return [...books].sort((a, b) => recency(b) - recency(a));
}

export async function importFiles(files: FileList | File[]) {
  const list = Array.from(files);
  if (!list.length) return;
  navigator.storage?.persist?.().catch(() => {});

  let added = 0;
  let duplicates = 0;
  const failures: string[] = [];
  for (const file of list) {
    library.set((s) => ({ importing: s.importing + 1 }));
    try {
      const data = await file.arrayBuffer();
      const id = await hash(data);
      const existing = await db.book(id);
      if (existing) duplicates++;
      else {
        const parsed = parseEpub(data, file.name.replace(/\.epub$/i, ""));
        if (!parsed.chapters.length) throw new Error("no readable text was found in it");
        const meta: BookMeta = {
          id,
          title: parsed.title,
          author: parsed.author,
          cover: parsed.cover,
          tint: parsed.cover ? await dominantColor(parsed.cover).catch(() => undefined) : undefined,
          chapters: parsed.chapters.map((c) => ({ title: c.title, words: c.words.length })),
          totalWords: parsed.chapters.reduce((n, c) => n + c.words.length, 0),
          addedAt: Date.now(),
          openedAt: 0,
        };
        await db.putBook(meta, parsed.chapters.map(({ words, paras }) => ({ words, paras })));
        added++;
      }
    } catch (err) {
      console.error(err);
      const reason = err instanceof Error ? err.message : String(err);
      failures.push(`Couldn't add “${file.name}”: ${reason}`);
    } finally {
      library.set((s) => ({ importing: s.importing - 1 }));
    }
  }
  await loadLibrary();
  // A failure is the message worth reading, so it wins over "Added".
  if (failures.length) showToast(failures.length === 1 ? failures[0] : `${failures.length} books couldn't be added. ${failures[0]}`, 6000);
  else if (added) showToast(added === 1 ? "Added to Library" : `Added ${added} books`);
  else if (duplicates) showToast(duplicates === 1 ? "Already in your Library" : "Those are already in your Library");
}

/** Public-domain book bundled with the app, so a new library has something to read. */
export async function addSampleBook() {
  updateSettings({ sampleAdded: true });
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}samples/alice-in-wonderland.epub`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    await importFiles([new File([blob], "alice-in-wonderland.epub", { type: "application/epub+zip" })]);
  } catch (err) {
    console.error(err);
    showToast("Couldn't load the sample book");
  }
}

export async function removeBook(id: string) {
  await db.deleteBook(id);
  const { settings } = library.get();
  if (settings.lastBookId === id) updateSettings({ lastBookId: undefined });
  await loadLibrary();
}

export type BookStatus = "new" | "reading" | "finished";

export function percentRead(book: BookMeta, progress?: Progress): number {
  if (!progress || !book.totalWords) return 0;
  if (progress.finished) return 1;
  const before = book.chapters.slice(0, progress.chapter).reduce((n, c) => n + c.words, 0);
  return Math.min(1, (before + progress.word) / book.totalWords);
}

export function bookStatus(progress?: Progress): BookStatus {
  if (progress?.finished) return "finished";
  return progress && (progress.chapter > 0 || progress.word > 0) ? "reading" : "new";
}

/** Marks a book finished, or resets it to unread. */
export async function setFinished(book: BookMeta, finished: boolean) {
  if (finished) {
    const chapter = book.chapters.length - 1;
    saveProgress(book.id, { chapter, word: book.chapters[chapter].words - 1, updatedAt: Date.now(), finished: true });
  } else {
    library.set((s) => {
      const { [book.id]: _, ...progress } = s.progress;
      return { progress };
    });
    await db.deleteProgress(book.id);
  }
}

export function saveProgress(id: string, progress: Progress) {
  library.set((s) => ({ progress: { ...s.progress, [id]: progress } }));
  db.putProgress(id, progress);
}

export async function markOpened(id: string) {
  const book = await db.book(id);
  if (!book) return;
  book.openedAt = Date.now();
  await db.putBook(book);
  library.set((s) => ({ books: sortBooks(s.books.map((b) => (b.id === id ? book : b)), s.progress) }));
}

export function updateSettings(patch: Partial<Settings>) {
  const settings = { ...library.get().settings, ...patch };
  library.set({ settings });
  db.putSettings(settings);
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(message: string, durationMs = 2400) {
  library.set({ toast: message });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => library.set({ toast: undefined }), durationMs);
}

/** Content hash, so re-importing the same file keeps its progress. */
async function hash(data: ArrayBuffer): Promise<string> {
  if (crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // crypto.subtle is missing on insecure origins (e.g. a LAN IP during development).
  let h = 0x811c9dc5;
  const bytes = new Uint8Array(data);
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193);
  return `fnv${(h >>> 0).toString(16)}${bytes.length.toString(16)}`;
}

async function dominantColor(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const size = 24;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  let r = 0, g = 0, b = 0, total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [pr, pg, pb] = [data[i], data[i + 1], data[i + 2]];
    // Weight saturated pixels higher so a white border doesn't wash the colour out.
    const weight = 0.15 + (Math.max(pr, pg, pb) - Math.min(pr, pg, pb)) / 255;
    r += pr * weight;
    g += pg * weight;
    b += pb * weight;
    total += weight;
  }
  return [r, g, b].map((c) => Math.round(c / total)).join(" ");
}
