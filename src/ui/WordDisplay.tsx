import { reader } from "../reader/reader";
import { framePivot } from "../reader/rsvp";
import { useStore } from "../store/store";

/** The frame the reader is on: one word, or a short phrase in phrase styles. */
export function WordDisplay() {
  const text = useStore(reader, (s) => s.content?.[s.chapter]?.words.slice(s.word, s.frameEnd).join(" ") ?? "");
  return <WordView text={text} />;
}

/**
 * Swift Read-style display. The focus letter is centred on a fixed point and the rest of the text
 * hangs off either side of it, so nothing on screen moves between frames: not the focus letter, not the
 * guides, not the box height (long text shrinks inside a fixed-height row).
 */
export function WordView({ text }: { text: string }) {
  const pivot = framePivot(text);
  // Shrink very long frames so they don't run off the screen.
  const scale = Math.min(1, 13 / Math.max(text.length, 1));

  return (
    <div className="rsvp" style={{ "--word-scale": scale } as React.CSSProperties}>
      <div className="rsvp-guide top" />
      <div className="rsvp-word" aria-live="off">
        <span className="rsvp-anchor">
          <span className="rsvp-before">{text.slice(0, pivot)}</span>
          <span className="rsvp-focus">{text.charAt(pivot)}</span>
          <span className="rsvp-after">{text.slice(pivot + 1)}</span>
        </span>
      </div>
      <div className="rsvp-guide bottom" />
    </div>
  );
}
