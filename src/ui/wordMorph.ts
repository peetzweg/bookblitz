import { framePivot } from "../reader/rsvp";

/**
 * The bridge between the big centred word and its place in the paragraph. Pausing shrinks the word down
 * into the text where it belongs; playing lifts it back out. A copy of the word flies with a
 * transform, while the real one on each end stays hidden until it lands, so the eye can follow it.
 */

const DURATION_MS = 340;
/** Strong ease-in-out: this is movement across the screen, not an entrance. */
const EASE = "cubic-bezier(0.77, 0, 0.175, 1)";

let inFlight: { animation: Animation; cleanup: () => void } | undefined;

interface Box {
  left: number;
  top: number;
  height: number;
  fontSize: number;
}

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The big word in the reading overlay: where its text starts, and its size. */
function overlayWord(sheet: HTMLElement): { box: Box; el: HTMLElement } | undefined {
  const el = sheet.querySelector<HTMLElement>(".reading-word");
  const anchor = el?.querySelector<HTMLElement>(".rsvp-anchor");
  const before = el?.querySelector<HTMLElement>(".rsvp-before");
  if (!el || !anchor || !before) return;
  const a = anchor.getBoundingClientRect();
  const b = before.getBoundingClientRect();
  // `before` hangs off the anchor's left edge; an empty one has no width, so the text starts at the anchor.
  const left = b.width ? b.left : a.left;
  return { el, box: { left, top: a.top, height: a.height, fontSize: parseFloat(getComputedStyle(anchor).fontSize) } };
}

/** The highlighted word in the paragraph. */
function paragraphWord(sheet: HTMLElement): { box: Box; els: HTMLElement[] } | undefined {
  const els = [...sheet.querySelectorAll<HTMLElement>(".ctx-current")];
  if (!els.length) return;
  const r = els[0].getBoundingClientRect();
  const box = sheet.querySelector<HTMLElement>(".context")?.getBoundingClientRect();
  // Scrolled out of sight (it shouldn't be, but don't fly to somewhere invisible).
  if (box && (r.bottom < box.top || r.top > box.bottom)) return;
  return { els, box: { left: r.left, top: r.top, height: r.height, fontSize: parseFloat(getComputedStyle(els[0]).fontSize) } };
}

/**
 * Flies `text` between the overlay and the paragraph. `toParagraph` is the pause direction. Call after
 * the DOM shows the new state (both ends must be laid out); it's a no-op if either end is missing.
 */
export function morphWord(sheet: HTMLElement, text: string, toParagraph: boolean) {
  // A new pause or play mid-flight: land the old copy immediately, then start from where things are now.
  if (inFlight) {
    const previous = inFlight;
    inFlight = undefined;
    previous.animation.cancel();
    previous.cleanup();
  }
  if (reducedMotion() || !text) return;

  const big = overlayWord(sheet);
  const small = paragraphWord(sheet);
  if (!big || !small) return;
  const from = toParagraph ? big.box : small.box;
  const to = toParagraph ? small.box : big.box;
  // The big word hides straight away in both directions (on pause its overlay is fading out anyway);
  // the paragraph's highlight hides only when it's the destination.
  // Only the text row hides, so the guides stay put.
  const bigText = big.el.querySelector<HTMLElement>(".rsvp-word") ?? big.el;
  const hidden: HTMLElement[] = toParagraph ? [bigText, ...small.els] : [bigText];

  const anchor = big.el.querySelector<HTMLElement>(".rsvp-anchor")!;
  // Drawn exactly like the big word, focus letter included, so nothing changes as it takes off.
  const copy = document.createElement("span");
  copy.className = "word-morph";
  const pivot = framePivot(text);
  const focus = document.createElement("span");
  focus.textContent = text.charAt(pivot);
  focus.style.color = getComputedStyle(big.el.querySelector(".rsvp-focus") ?? anchor).color;
  copy.append(text.slice(0, pivot), focus, text.slice(pivot + 1));
  Object.assign(copy.style, {
    left: `${from.left}px`,
    top: `${from.top}px`,
    fontSize: `${from.fontSize}px`,
    lineHeight: `${from.height}px`,
    fontFamily: getComputedStyle(anchor).fontFamily,
    fontWeight: getComputedStyle(anchor).fontWeight,
    color: getComputedStyle(anchor).color,
  });
  // On <body>: the sheet has a transform, which would make a fixed child position relative to it.
  document.body.appendChild(copy);
  for (const el of hidden) el.style.opacity = "0";

  // Scale to the destination's type size, and line the vertical centres up.
  const scale = to.fontSize / from.fontSize;
  const dx = to.left - from.left;
  const dy = to.top + to.height / 2 - (from.top + (from.height * scale) / 2);
  const animation = copy.animate([{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(${scale})` }], {
    duration: DURATION_MS,
    easing: EASE,
    fill: "forwards",
  });
  let landed = false;
  const cleanup = () => {
    if (landed) return;
    landed = true;
    for (const el of hidden) el.style.opacity = "";
    if (toParagraph) {
      // Landed on the same word: a short cross-fade into the highlight.
      copy.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: "ease-out", fill: "forwards" }).finished.finally(() => copy.remove());
    } else {
      // Reading has already moved on by now, so cross-fading would show two different words at once.
      copy.remove();
    }
    if (inFlight?.animation === animation) inFlight = undefined;
  };
  inFlight = { animation, cleanup };
  animation.finished.catch(() => {}).finally(cleanup);
}
