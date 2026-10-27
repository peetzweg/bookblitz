import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

export type Route = { name: "library" } | { name: "book"; id: string };

/** The cover that morphs between a library tile and the book page. One element carries the name at a time. */
export const COVER_TRANSITION = "book-cover";

function parse(hash: string): Route {
  const match = hash.match(/^#\/book\/(.+)$/);
  return match ? { name: "book", id: decodeURIComponent(match[1]) } : { name: "library" };
}

function href(route: Route) {
  return route.name === "book" ? `#/book/${encodeURIComponent(route.id)}` : "#/";
}

let current = parse(location.hash);
const listeners = new Set<() => void>();
const scrollPositions = new Map<string, number>();
/** Which library cover opened the current book page, so going back morphs into the same one. */
let source: { bookId: string; key: string } | undefined;
let navigatedInApp = false;

function commit(next: Route) {
  scrollPositions.set(href(current), window.scrollY);
  current = next;
  listeners.forEach((l) => l());
}

/** Scroll position to restore for a route; a fresh page starts at the top. */
export function savedScroll(route: Route): number {
  return scrollPositions.get(href(route)) ?? 0;
}

function canTransition() {
  return "startViewTransition" in document && !matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Runs a route change inside a View Transition. `name` gives the morphing cover its transition name on
 * the old page (before) or the new page (after the update), and is removed once the transition ends.
 */
function transition(next: Route, cover: { before?: HTMLElement | null; after?: () => HTMLElement | null }) {
  if (!canTransition()) return commit(next);
  if (cover.before) cover.before.style.viewTransitionName = COVER_TRANSITION;
  let after: HTMLElement | null | undefined;
  const vt = document.startViewTransition(() => {
    flushSync(() => commit(next));
    after = cover.after?.();
    if (after) after.style.viewTransitionName = COVER_TRANSITION;
  });
  vt.finished.finally(() => {
    if (cover.before) cover.before.style.viewTransitionName = "";
    if (after) after.style.viewTransitionName = "";
  });
}

/** Opens a book page; `from` is the cover element that was tapped, so it can morph into the page. */
export function openBookPage(id: string, from?: HTMLElement | null) {
  const key = from?.dataset.coverKey;
  source = key ? { bookId: id, key } : undefined;
  navigatedInApp = true;
  const next: Route = { name: "book", id };
  history.pushState(null, "", href(next));
  transition(next, { before: from });
}

/** On the way back to the library, the cover morphs into the tile it came from. */
function backToLibraryCover(previous: Route) {
  if (previous.name !== "book" || source?.bookId !== previous.id) return null;
  return document.querySelector<HTMLElement>(`[data-cover-key="${CSS.escape(source.key)}"]`);
}

window.addEventListener("popstate", (event) => {
  const previous = current;
  const next = parse(location.hash);
  // iOS's own swipe-back already animated the page; a second animation on top would look broken.
  if ((event as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition) return commit(next);
  transition(next, { after: () => backToLibraryCover(previous) });
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

export function goBack() {
  // Pop history when we got here from inside the app, so the browser back stack stays tidy.
  if (navigatedInApp) return history.back();
  const previous = current;
  const next: Route = { name: "library" };
  history.replaceState(null, "", href(next));
  transition(next, { after: () => backToLibraryCover(previous) });
}
