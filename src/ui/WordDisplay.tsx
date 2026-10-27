import { reader } from "../reader/reader";
import { orpIndex } from "../reader/rsvp";
import { useStore } from "../store/store";

/**
 * Swift Read-style single word. The focus letter is centred on a fixed point and the rest of the word
 * hangs off either side of it, so nothing on screen moves between words: not the focus letter, not the
 * guides, not the box height (long words shrink inside a fixed-height row).
 */
export function WordDisplay() {
  const word = useStore(reader, (s) => s.content?.[s.chapter]?.words[s.word] ?? "");
  const pivot = orpIndex(word);
  // Shrink very long words so they don't run off the screen.
  const scale = Math.min(1, 13 / Math.max(word.length, 1));

  return (
    <div className="rsvp" style={{ "--word-scale": scale } as React.CSSProperties}>
      <div className="rsvp-guide top" />
      <div className="rsvp-word" aria-live="off">
        <span className="rsvp-anchor">
          <span className="rsvp-before">{word.slice(0, pivot)}</span>
          <span className="rsvp-focus">{word.charAt(pivot)}</span>
          <span className="rsvp-after">{word.slice(pivot + 1)}</span>
        </span>
      </div>
      <div className="rsvp-guide bottom" />
    </div>
  );
}
