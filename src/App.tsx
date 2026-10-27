import { useEffect, useRef, useState } from "react";
import { openBook, reader } from "./reader/reader";
import { addSampleBook, importFiles, library, loadLibrary } from "./store/library";
import { useStore } from "./store/store";
import { BookPage } from "./ui/BookPage";
import { Library } from "./ui/Library";
import { MiniPlayer } from "./ui/MiniPlayer";
import { NowReading } from "./ui/NowReading";
import { useRoute } from "./ui/router";

export function App() {
  const route = useRoute();
  const sheetOpen = useStore(reader, (s) => s.open);
  const toast = useStore(library, (s) => s.toast);
  const fileInput = useRef<HTMLInputElement>(null);
  const [dropping, setDropping] = useState(false);
  // Scale the page around the middle of the viewport, not the middle of the whole document.
  const [origin, setOrigin] = useState("50% 50%");
  useEffect(() => {
    if (sheetOpen) setOrigin(`50% ${window.scrollY + window.innerHeight / 2}px`);
    document.documentElement.classList.toggle("sheet-open", sheetOpen);
  }, [sheetOpen]);

  useEffect(() => {
    loadLibrary().then(() => {
      const { settings, books } = library.get();
      if (!settings.sampleAdded && books.length === 0) addSampleBook();
      // Bring back the last book in the mini player, like Apple Music does after a restart.
      if (settings.lastBookId) openBook(settings.lastBookId, { open: false });
    });
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  useEffect(() => {
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      setDropping(true);
    };
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) setDropping(false);
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setDropping(false);
      if (e.dataTransfer?.files.length) importFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);

  const pickFiles = () => fileInput.current?.click();

  return (
    <>
      <div className={`app ${sheetOpen ? "pushed-back" : ""}`} style={{ transformOrigin: origin }}>
        {route.name === "book" ? <BookPage id={route.id} /> : <Library onAdd={pickFiles} />}
      </div>
      <MiniPlayer />
      <NowReading />
      <input
        ref={fileInput}
        type="file"
        accept=".epub,application/epub+zip"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) importFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {toast && <div className="toast" role="status">{toast}</div>}
      {dropping && <div className="drop-overlay">Drop EPUB to add</div>}
    </>
  );
}
