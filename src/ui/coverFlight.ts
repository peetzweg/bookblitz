/**
 * The cover flying between the mini player (or a book page) and the Now Reading sheet, like Apple Music's
 * artwork. A copy of the cover is animated from where it was to where it will come to rest, while the
 * real ones on both ends stay hidden.
 *
 * WAAPI rather than Motion's layoutId: the sheet is itself sliding with a spring, so the destination is
 * only known once that slide is accounted for, and a transform-only animation stays on the compositor.
 */

/** Matches the sheet's slide, so the cover arrives together with it. */
const DURATION_MS = 450;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
/** A takeoff with no landing (the sheet never opened) gives the cover back after this. */
const ABANDON_MS = 1200;

interface Flight {
  source: HTMLElement;
  rect: DOMRect;
  abandon: ReturnType<typeof setTimeout>;
}

let pending: Flight | undefined;

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Lifts a cover off its current spot. Call right before the change that should land it elsewhere. */
export function takeOff(source: HTMLElement | null | undefined) {
  cancel();
  if (!source || reducedMotion()) return;
  const rect = source.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  source.style.visibility = "hidden";
  pending = { source, rect, abandon: setTimeout(cancel, ABANDON_MS) };
}

export function hasPendingFlight() {
  return pending !== undefined;
}

/**
 * Lands the pending cover on `target`. `offsetY` is how far the target still is from its resting place,
 * for a target inside something that is itself animating in.
 */
export function land(target: HTMLElement | null | undefined, offsetY = 0) {
  const flight = pending;
  pending = undefined;
  if (!flight) return;
  clearTimeout(flight.abandon);
  if (!target) return void (flight.source.style.visibility = "");

  const resting = target.getBoundingClientRect();
  const to = { left: resting.left, top: resting.top - offsetY, width: resting.width, height: resting.height };
  const from = flight.rect;

  const copy = flight.source.cloneNode(true) as HTMLElement;
  copy.removeAttribute("data-cover-key");
  copy.removeAttribute("data-flight-target");
  Object.assign(copy.style, {
    position: "fixed",
    left: `${to.left}px`,
    top: `${to.top}px`,
    width: `${to.width}px`,
    height: `${to.height}px`,
    margin: "0",
    zIndex: "100",
    pointerEvents: "none",
    transformOrigin: "0 0",
    visibility: "visible",
    viewTransitionName: "none",
  });
  document.body.appendChild(copy);
  target.style.visibility = "hidden";

  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const animation = copy.animate(
    [{ transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})` }, { transform: "none" }],
    { duration: DURATION_MS, easing: EASE },
  );
  animation.finished
    .catch(() => {})
    .finally(() => {
      target.style.visibility = "";
      flight.source.style.visibility = "";
      copy.remove();
    });
}

function cancel() {
  if (!pending) return;
  clearTimeout(pending.abandon);
  pending.source.style.visibility = "";
  pending = undefined;
}
