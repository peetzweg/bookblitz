import { openDB, type DBSchema } from "idb";

export interface ChapterMeta {
  title: string;
  words: number;
}

export interface BookMeta {
  id: string;
  title: string;
  author: string;
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

/** Apple's system faces: SF Pro, New York, SF Pro Rounded, SF Mono. */
export type ReaderFont = "sans" | "serif" | "rounded" | "mono";

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
});

export const db = {
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
