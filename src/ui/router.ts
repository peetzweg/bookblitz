import { useSyncExternalStore } from "react";

export type Route = { name: "library" } | { name: "book"; id: string };

function parse(hash: string): Route {
  const match = hash.match(/^#\/book\/(.+)$/);
  return match ? { name: "book", id: decodeURIComponent(match[1]) } : { name: "library" };
}

let current = parse(location.hash);
const listeners = new Set<() => void>();
window.addEventListener("hashchange", () => {
  current = parse(location.hash);
  listeners.forEach((l) => l());
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

let navigatedInApp = false;

export function navigate(route: Route) {
  navigatedInApp = true;
  location.hash = route.name === "book" ? `#/book/${encodeURIComponent(route.id)}` : "#/";
}

export function goBack() {
  // Pop history when we got here from inside the app, so the browser back stack stays tidy.
  if (navigatedInApp) history.back();
  else location.replace("#/");
}
