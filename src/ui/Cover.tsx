import { useEffect, useState } from "react";
import type { BookMeta } from "../store/db";

const urls = new Map<string, string>();

function coverUrl(book: BookMeta): string | undefined {
  let url = urls.get(book.id);
  if (!url) {
    const blob = book.coverData ? new Blob([book.coverData], { type: book.coverType }) : book.cover;
    if (!blob) return;
    url = URL.createObjectURL(blob);
    urls.set(book.id, url);
  }
  return url;
}

/** Book cover, or a generated one for EPUBs that ship without art. */
export function Cover({ book, className = "" }: { book: BookMeta; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [book.id]);

  const src = coverUrl(book);
  if (src && !failed) {
    return <img className={`cover ${className}`} src={src} alt="" draggable={false} onError={() => setFailed(true)} />;
  }
  const hue = [...book.title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <div
      className={`cover cover-generated ${className}`}
      style={{ background: `linear-gradient(160deg, hsl(${hue} 45% 42%), hsl(${(hue + 40) % 360} 55% 22%))` }}
    >
      <span className="cover-generated-title">{book.title}</span>
      <span className="cover-generated-author">{book.author}</span>
    </div>
  );
}
