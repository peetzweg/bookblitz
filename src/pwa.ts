import { useSyncExternalStore } from "react";
import { registerSW } from "virtual:pwa-register";
import { reader } from "./reader/reader";
import { library, showToast } from "./store/library";
import { createStore } from "./store/store";

/** The browser's install prompt (Chrome, Edge, Android); not in the DOM typings yet. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaState {
  /** Running from the home screen rather than in a browser tab. */
  installed: boolean;
  /** Chrome/Android offered an install prompt we can show on our own button. */
  canPrompt: boolean;
}

const standalone = () =>
  matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const pwa = createStore<PwaState>({ installed: standalone(), canPrompt: false });

let installPrompt: InstallPromptEvent | undefined;

/** How often a long-running app (one that stays open in the background for days) checks for updates. */
const CHECK_EVERY_MS = 60 * 60 * 1000;
/** Right after launch a reload is no worse than the page loading, so an update found by then is applied. */
const LAUNCH_WINDOW_MS = 10_000;
const launchedAt = performance.now();
let updateWaiting = false;

/**
 * Updates install themselves, like a website, but the reload that swaps the new version in only
 * happens when it can't interrupt anything: just after launch, or once you've left the app (reading
 * pauses and saves when the page is hidden). Never mid-chapter, and never during an import.
 */
function applyUpdateIfSafe() {
  if (!updateWaiting || library.get().importing > 0) return;
  const justLaunched = performance.now() - launchedAt < LAUNCH_WINDOW_MS && !reader.get().open;
  if (document.visibilityState === "hidden") {
    // Give the progress save that leaving triggers a moment to land first.
    setTimeout(() => document.visibilityState === "hidden" && updateServiceWorker(true), 500);
  } else if (justLaunched) {
    updateServiceWorker(true);
  }
}

const updateServiceWorker = registerSW({
  onNeedRefresh() {
    updateWaiting = true;
    applyUpdateIfSafe();
  },
  onOfflineReady: () => showToast("Ready to use offline"),
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    // Installed apps are rarely reloaded, so look for a new version whenever the app comes back to
    // the front, and every so often while it stays open.
    const check = () => navigator.onLine && registration.update().catch(() => {});
    setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
  },
});

document.addEventListener("visibilitychange", applyUpdateIfSafe);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event as InstallPromptEvent;
  pwa.set({ canPrompt: true });
});

window.addEventListener("appinstalled", () => {
  installPrompt = undefined;
  pwa.set({ installed: true, canPrompt: false });
});

export async function promptInstall() {
  if (!installPrompt) return;
  await installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  installPrompt = undefined;
  pwa.set({ canPrompt: false, installed: outcome === "accepted" });
}

/**
 * iOS has no install prompt, only Share > Add to Home Screen. `navigator.standalone` exists only in
 * iOS Safari, which makes it a capability check rather than user-agent sniffing.
 */
export const isIosSafari = "standalone" in navigator;

export function usePwa<S>(selector: (state: PwaState) => S): S {
  return useSyncExternalStore(pwa.subscribe, () => selector(pwa.get()));
}
