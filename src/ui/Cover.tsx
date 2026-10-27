import { useEffect, useState } from "react";
import type { BookMeta } from "../store/db";

const urls = new WeakMap<Blob, string>();

function coverUrl(blob: Blob) {
  let url = urls.get(blob);
  if (!url) {
    url = URL.createObjectURL(blob);
    urls.set(blob, url);
  }
  return url;
}

/** Book cover, or a generated one for EPUBs that ship without art. */
export function Cover({ book, className = "" }: { book: BookMeta; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [book.cover]);

  if (book.cover && !failed) {
    return <img className={`cover ${className}`} src={coverUrl(book.cover)} alt="" draggable={false} onError={() => setFailed(true)} />;
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
