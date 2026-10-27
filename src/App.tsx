import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { openBook, reader } from "./reader/reader";
import { addSampleBook, importFiles, library, loadLibrary, retryLibrary } from "./store/library";
import { useStore } from "./store/store";
import { BookPage } from "./ui/BookPage";
import { Library } from "./ui/Library";
import { Settings } from "./ui/Settings";
import { MiniPlayer } from "./ui/MiniPlayer";
import { NowReading } from "./ui/NowReading";
import { savedScroll, useRoute } from "./ui/router";

export function App() {
  const route = useRoute();
  const sheetOpen = useStore(reader, (s) => s.open);
  const toast = useStore(library, (s) => s.toast);
  // Once the library is up, a hang is shown as a banner; before that, Library shows a full screen.
  const storageStuck = useStore(library, (s) => s.stuck && s.ready);
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
      // The "Continue Reading" home-screen shortcut opens straight into the reader.
      const resume = new URLSearchParams(location.search).has("resume");
      if (resume) history.replaceState(null, "", location.pathname + location.hash);
      // Otherwise bring back the last book in the mini player, like Apple Music does after a restart.
      if (settings.lastBookId) openBook(settings.lastBookId, { open: resume });
    });
  }, []);

  // Layout effect so it runs inside a View Transition's update, before the new page is captured:
  // the library comes back where you left it, so a cover can morph back into its own tile.
  useLayoutEffect(() => {
    window.scrollTo(0, savedScroll(route));
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
        {route.name === "book" ? (
          <BookPage id={route.id} />
        ) : route.name === "settings" ? (
          <Settings />
        ) : (
          <Library onAdd={pickFiles} />
        )}
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
      {storageStuck && (
        <div className="storage-banner" role="alert">
          <span>Storage isn’t responding, so changes aren’t being saved.</span>
          <button className="pill-button filled" onClick={retryLibrary}>
            Try Again
          </button>
        </div>
      )}
      {dropping && <div className="drop-overlay">Drop EPUB to add</div>}
    </>
  );
}
