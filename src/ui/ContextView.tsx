import { useLayoutEffect, useMemo, useRef } from "react";
import { reader, seek } from "../reader/reader";
import { useStore } from "../store/store";

const PARAGRAPHS_BEFORE = 3;
const PARAGRAPHS_AFTER = 4;

/** The text around the current word, shown while paused. Tap any word to jump there. */
export function ContextView() {
  const content = useStore(reader, (s) => s.content);
  const chapter = useStore(reader, (s) => s.chapter);
  const word = useStore(reader, (s) => s.word);
  const scroller = useRef<HTMLDivElement>(null);

  const chapterContent = content?.[chapter];
  const paragraphIndex = useMemo(() => {
    const paras = chapterContent?.paras ?? [];
    let lo = 0;
    let hi = paras.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (paras[mid] <= word) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }, [chapterContent, word]);

  useLayoutEffect(() => {
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>(".ctx-current");
    if (box && el) box.scrollTop = el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2;
  }, [paragraphIndex, chapter]);

  if (!chapterContent) return null;
  const { words, paras } = chapterContent;
  const first = Math.max(0, paragraphIndex - PARAGRAPHS_BEFORE);
  const last = Math.min(paras.length - 1, paragraphIndex + PARAGRAPHS_AFTER);

  const blocks = [];
  for (let p = first; p <= last; p++) {
    const start = paras[p];
    const end = p + 1 < paras.length ? paras[p + 1] : words.length;
    const spans = [];
    for (let i = start; i < end; i++) {
      spans.push(
        <span
          key={i}
          className={i === word ? "ctx-word ctx-current" : i < word ? "ctx-word ctx-read" : "ctx-word"}
          onClick={(e) => {
            e.stopPropagation();
            seek(chapter, i);
          }}
        >
          {words[i]}
        </span>,
        " ",
      );
    }
    blocks.push(<p key={p}>{spans}</p>);
  }

  return (
    <div className="context" ref={scroller}>
      {blocks}
    </div>
  );
}
