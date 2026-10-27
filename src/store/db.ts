import { openDB, type DBSchema } from "idb";

export interface ChapterMeta {
  title: string;
  words: number;
}

export interface BookMeta {
  id: string;
  title: string;
  author: string;
  /**
   * Cover image bytes. Stored as plain bytes rather than a Blob: Safari's IndexedDB can fail to store
   * Blobs ("Error preparing Blob/File data"), which aborted the whole import.
   */
  coverData?: ArrayBuffer;
  coverType?: string;
  /** Covers from before `coverData`; read-only, never written any more. */
  cover?: Blob;
  /** Dominant cover colour as "r g b", used to tint the reader. */
  tint?: string;
  chapters: ChapterMeta[];
  totalWords: number;
  addedAt: number;
  openedAt: number;
}

export interface ChapterContent {
  words: string[];
  paras: number[];
}

export interface Progress {
  chapter: number;
  word: number;
  updatedAt: number;
  /** Reached the last word, or marked as finished by hand. */
  finished?: boolean;
}

/** Apple's system faces (SF Pro, New York, SF Pro Rounded) and Apple Books' reading faces. */
export type ReaderFont = "sans" | "serif" | "iowan" | "charter" | "athelas" | "rounded";

export interface Settings {
  wpm: number;
  font: ReaderFont;
  lastBookId?: string;
  /** Set once the sample book has been offered, so deleting it doesn't bring it back. */
  sampleAdded?: boolean;
}

export const DEFAULT_SETTINGS: Settings = { wpm: 350, font: "sans" };

interface Schema extends DBSchema {
  books: { key: string; value: BookMeta };
  content: { key: string; value: ChapterContent[] };
  progress: { key: string; value: Progress };
  settings: { key: "settings"; value: Settings };
}

const dbPromise = openDB<Schema>("bookblitz", 1, {
  upgrade(db) {
    db.createObjectStore("books", { keyPath: "id" });
    db.createObjectStore("content");
    db.createObjectStore("progress");
    db.createObjectStore("settings");
  },
  // Let go when another page (an old tab, a page Safari kept in its back-forward cache) needs the
  // database, so neither side ends up waiting on the other forever.
  blocking(_current, _blocked, event) {
    (event.target as IDBDatabase).close();
  },
});

/** Closes this page's connection, which releases a stuck transaction without losing any data. */
export async function closeDatabase() {
  const open = await Promise.race([dbPromise, new Promise<undefined>((r) => setTimeout(r, 1000))]).catch(() => undefined);
  open?.close();
}

/**
 * Deletes the whole local database. The last resort when Safari's storage for this site gets stuck and
 * reads never return.
 */
export async function resetDatabase() {
  await closeDatabase();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase("bookblitz");
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

/** A storage call that hasn't answered by now is stuck, not slow. */
const STUCK_AFTER_MS = 6000;
let onStuck: () => void = () => {};

/** Called when any storage call hangs. Safari can wedge its IndexedDB so calls never settle and never fail. */
export function onStorageStuck(callback: () => void) {
  onStuck = callback;
}

function watch<T>(promise: Promise<T>): Promise<T> {
  const timer = setTimeout(() => onStuck(), STUCK_AFTER_MS);
  return promise.finally(() => clearTimeout(timer));
}

const calls = {
  async books() {
    return (await dbPromise).getAll("books");
  },
  async book(id: string) {
    return (await dbPromise).get("books", id);
  },
  async putBook(meta: BookMeta, content?: ChapterContent[]) {
    const tx = (await dbPromise).transaction(["books", "content"], "readwrite");
    await tx.objectStore("books").put(meta);
    if (content) await tx.objectStore("content").put(content, meta.id);
    await tx.done;
  },
  async content(id: string) {
    return (await dbPromise).get("content", id);
  },
  async deleteBook(id: string) {
    const tx = (await dbPromise).transaction(["books", "content", "progress"], "readwrite");
    await Promise.all([
      tx.objectStore("books").delete(id),
      tx.objectStore("content").delete(id),
      tx.objectStore("progress").delete(id),
      tx.done,
    ]);
  },
  async allProgress() {
    const d = await dbPromise;
    const [keys, values] = await Promise.all([d.getAllKeys("progress"), d.getAll("progress")]);
    return Object.fromEntries(keys.map((k, i) => [k, values[i]])) as Record<string, Progress>;
  },
  async putProgress(id: string, progress: Progress) {
    return (await dbPromise).put("progress", progress, id);
  },
  async deleteProgress(id: string) {
    return (await dbPromise).delete("progress", id);
  },
  async settings(): Promise<Settings> {
    return { ...DEFAULT_SETTINGS, ...(await (await dbPromise).get("settings", "settings")) };
  },
  async putSettings(settings: Settings) {
    return (await dbPromise).put("settings", settings, "settings");
  },
};

type Calls = typeof calls;

/** Every storage call, watched for hangs. */
export const db = Object.fromEntries(
  Object.entries(calls).map(([name, call]) => [name, (...args: never[]) => watch((call as (...a: never[]) => Promise<unknown>)(...args))]),
) as Calls;
