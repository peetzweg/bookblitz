import { strFromU8, unzipSync } from "fflate";

export interface ParsedChapter {
  title: string;
  words: string[];
  /** Word indices at which a new paragraph starts. */
  paras: number[];
}

export interface ParsedBook {
  title: string;
  author: string;
  cover?: Blob;
  chapters: ParsedChapter[];
}

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
}

interface TocEntry {
  file: string;
  fragment?: string;
  title: string;
}

/** Chapters shorter than this get folded into the next one (title pages, "Part One", ...). */
const MIN_CHAPTER_WORDS = 15;

const BLOCK = new Set([
  "p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "ul", "ol", "blockquote", "section",
  "article", "header", "footer", "aside", "br", "tr", "td", "th", "dt", "dd", "figcaption",
  "pre", "hr", "table", "figure", "nav",
]);
const SKIP = new Set(["script", "style", "head", "sup", "rt", "rp", "svg", "math", "noscript"]);

export function parseEpub(data: ArrayBuffer, fallbackTitle: string): ParsedBook {
  const files = unzipSync(new Uint8Array(data));
  const read = (path: string): string | undefined => {
    const bytes = files[path] ?? files[decodeURIComponent(path)];
    return bytes ? strFromU8(bytes) : undefined;
  };

  const container = read("META-INF/container.xml");
  if (!container) throw new Error("Not an EPUB: META-INF/container.xml is missing");
  const opfPath = xml(container).getElementsByTagNameNS("*", "rootfile")[0]?.getAttribute("full-path");
  const opfText = opfPath && read(opfPath);
  if (!opfPath || !opfText) throw new Error("Not an EPUB: package document is missing");

  const opf = xml(opfText);
  const opfDir = dirname(opfPath);

  const meta = opf.getElementsByTagNameNS("*", "metadata")[0];
  const title = text(meta?.getElementsByTagNameNS("*", "title")[0]) || fallbackTitle;
  const author = text(meta?.getElementsByTagNameNS("*", "creator")[0]) || "Unknown Author";

  const manifest = new Map<string, ManifestItem>();
  for (const el of Array.from(opf.getElementsByTagNameNS("*", "item"))) {
    const id = el.getAttribute("id");
    const href = el.getAttribute("href");
    if (!id || !href) continue;
    manifest.set(id, {
      id,
      href: resolve(opfDir, href),
      mediaType: el.getAttribute("media-type") ?? "",
      properties: el.getAttribute("properties") ?? "",
    });
  }

  const spineEl = opf.getElementsByTagNameNS("*", "spine")[0];
  const spine = Array.from(opf.getElementsByTagNameNS("*", "itemref"))
    .filter((el) => el.getAttribute("linear") !== "no")
    .map((el) => manifest.get(el.getAttribute("idref") ?? ""))
    .filter((item): item is ManifestItem => !!item);

  const toc = readToc(manifest, spineEl?.getAttribute("toc"), read);
  const cover = readCover(opf, manifest, files);

  // Group TOC entries per file so each document knows where its chapters start.
  const tocByFile = new Map<string, TocEntry[]>();
  for (const entry of toc) {
    const list = tocByFile.get(entry.file) ?? [];
    list.push(entry);
    tocByFile.set(entry.file, list);
  }

  const builder = new ChapterBuilder();
  for (const item of spine) {
    const source = read(item.href);
    if (!source) continue;
    const doc = html(source, item.mediaType);
    const entries = tocByFile.get(item.href) ?? [];
    const anchors = new Map<string, string>();
    for (const entry of entries) {
      if (entry.fragment) anchors.set(entry.fragment, entry.title);
      else builder.start(entry.title);
    }
    if (!builder.current) {
      const heading = doc.querySelector("h1, h2, h3")?.textContent?.trim();
      builder.start(heading || "Opening");
    }
    builder.walk(doc.body ?? doc.documentElement, anchors);
    builder.flush();
  }

  return { title, author, cover, chapters: builder.finish() };
}

class ChapterBuilder {
  chapters: ParsedChapter[] = [];
  current: ParsedChapter | undefined;
  private buffer = "";

  start(title: string) {
    this.flush();
    if (this.current && this.current.words.length === 0) {
      this.current.title = title;
      return;
    }
    this.current = { title, words: [], paras: [] };
    this.chapters.push(this.current);
  }

  walk(node: Node, anchors: Map<string, string>) {
    if (node.nodeType === Node.TEXT_NODE) {
      this.buffer += node.nodeValue ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.localName.toLowerCase();
    if (SKIP.has(tag)) return;
    if (el.getAttributeNS("http://www.idpf.org/2007/ops", "type") === "noteref") return;

    const id = el.getAttribute("id");
    const anchorTitle = id ? anchors.get(id) : undefined;
    if (anchorTitle) {
      anchors.delete(id!);
      this.start(anchorTitle);
    }

    const block = BLOCK.has(tag);
    if (block) this.flush();
    for (const child of Array.from(el.childNodes)) this.walk(child, anchors);
    if (block) this.flush();
  }

  /** Ends the current paragraph. */
  flush() {
    const words = tokenize(this.buffer);
    this.buffer = "";
    if (!words.length || !this.current) return;
    this.current.paras.push(this.current.words.length);
    this.current.words.push(...words);
  }

  finish(): ParsedChapter[] {
    this.flush();
    const out: ParsedChapter[] = [];
    let carry: ParsedChapter | undefined;
    for (const chapter of this.chapters) {
      if (!chapter.words.length) continue;
      const merged = carry ? concat(carry, chapter) : chapter;
      carry = undefined;
      if (merged.words.length < MIN_CHAPTER_WORDS) carry = merged;
      else out.push(merged);
    }
    if (carry) {
      const last = out.pop();
      out.push(last ? concat(last, carry, last.title) : carry);
    }
    return out;
  }
}

function concat(a: ParsedChapter, b: ParsedChapter, title = b.title): ParsedChapter {
  return {
    title,
    words: [...a.words, ...b.words],
    paras: [...a.paras, ...b.paras.map((p) => p + a.words.length)],
  };
}

export function tokenize(input: string): string[] {
  return input
    .replace(/­/g, "") // soft hyphens
    .replace(/([—–])(?=\S)/g, "$1 ") // break "word—word" after the dash
    .split(/\s+/)
    .filter(Boolean);
}

function readToc(
  manifest: Map<string, ManifestItem>,
  ncxId: string | null | undefined,
  read: (path: string) => string | undefined,
): TocEntry[] {
  const navItem = [...manifest.values()].find((item) => item.properties.split(/\s+/).includes("nav"));
  const navSource = navItem && read(navItem.href);
  if (navItem && navSource) {
    const doc = html(navSource, navItem.mediaType);
    const navs = Array.from(doc.getElementsByTagName("nav"));
    const nav =
      navs.find((n) => (n.getAttributeNS("http://www.idpf.org/2007/ops", "type") ?? n.getAttribute("epub:type")) === "toc") ??
      navs[0];
    const entries = nav ? Array.from(nav.getElementsByTagName("a")).map((a) => toEntry(navItem.href, a.getAttribute("href"), text(a))) : [];
    const valid = entries.filter((e): e is TocEntry => !!e);
    if (valid.length) return valid;
  }

  const ncxItem = (ncxId && manifest.get(ncxId)) || [...manifest.values()].find((i) => i.mediaType === "application/x-dtbncx+xml");
  const ncxSource = ncxItem && read(ncxItem.href);
  if (!ncxItem || !ncxSource) return [];
  return Array.from(xml(ncxSource).getElementsByTagNameNS("*", "navPoint"))
    .map((point) => {
      const label = text(point.getElementsByTagNameNS("*", "text")[0]);
      const src = point.getElementsByTagNameNS("*", "content")[0]?.getAttribute("src");
      return toEntry(ncxItem.href, src, label);
    })
    .filter((e): e is TocEntry => !!e);
}

function toEntry(base: string, href: string | null | undefined, title: string): TocEntry | undefined {
  if (!href || !title) return;
  const [path, fragment] = href.split("#");
  return { file: path ? resolve(dirname(base), path) : base, fragment: fragment || undefined, title: cleanTitle(title) };
}

/** Some TOCs prefix a chapter with its illustration caption: "“So it was.” CHAPTER XIX." → "CHAPTER XIX." */
function cleanTitle(title: string): string {
  const match = title.match(/^.+?[.!?”"’]\s+((?:chapter|letter|book|part|volume)\s+[\divxlc]+\b.*)$/i);
  return match ? match[1] : title;
}

function readCover(opf: Document, manifest: Map<string, ManifestItem>, files: Record<string, Uint8Array>): Blob | undefined {
  const items = [...manifest.values()];
  const metaCoverId = Array.from(opf.getElementsByTagNameNS("*", "meta"))
    .find((m) => m.getAttribute("name") === "cover")
    ?.getAttribute("content");
  const item =
    items.find((i) => i.properties.split(/\s+/).includes("cover-image")) ??
    (metaCoverId ? manifest.get(metaCoverId) : undefined) ??
    items.find((i) => i.mediaType.startsWith("image/") && /cover/i.test(i.id + i.href));
  if (!item || !item.mediaType.startsWith("image/")) return;
  const bytes = files[item.href] ?? files[decodeURIComponent(item.href)];
  return bytes ? new Blob([bytes as Uint8Array<ArrayBuffer>], { type: item.mediaType }) : undefined;
}

function xml(source: string): Document {
  return new DOMParser().parseFromString(source, "application/xml");
}

function html(source: string, mediaType: string): Document {
  if (mediaType === "application/xhtml+xml") {
    const doc = new DOMParser().parseFromString(source, "application/xhtml+xml");
    if (!doc.getElementsByTagName("parsererror").length) return doc;
  }
  return new DOMParser().parseFromString(source, "text/html");
}

function text(el: Element | undefined): string {
  return el?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i + 1);
}

function resolve(dir: string, href: string): string {
  const parts = (dir + decodeURIComponent(href)).split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") out.pop();
    else if (part !== "." && part !== "") out.push(part);
  }
  return out.join("/");
}
