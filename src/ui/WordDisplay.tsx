import { reader } from "../reader/reader";
import { orpIndex } from "../reader/rsvp";
import { useStore } from "../store/store";

/** Swift Read-style single word, with the recognition point pinned in place between two guide rules. */
export function WordDisplay() {
  const word = useStore(reader, (s) => s.content?.[s.chapter]?.words[s.word] ?? "");
  const pivot = orpIndex(word);
  const before = word.slice(0, pivot);
  const focus = word.charAt(pivot);
  const after = word.slice(pivot + 1);
  // Shrink very long words so they don't run off the screen.
  const scale = Math.min(1, 13 / Math.max(word.length, 1));

  return (
    <div className="rsvp" style={{ "--word-scale": scale } as React.CSSProperties}>
      <Guide focus={focus} />
      <div className="rsvp-word" aria-live="off">
        <span className="rsvp-before">{before}</span>
        <span className="rsvp-focus">{focus}</span>
        <span className="rsvp-after">{after}</span>
      </div>
      <Guide focus={focus} bottom />
    </div>
  );
}

/** Uses the same grid as the word, with an invisible copy of the focus letter, so the tick sits exactly over it. */
function Guide({ focus, bottom }: { focus: string; bottom?: boolean }) {
  return (
    <div className={`rsvp-guide ${bottom ? "bottom" : "top"}`}>
      <span />
      <span className="rsvp-tick">{focus || " "}</span>
      <span />
    </div>
  );
}
