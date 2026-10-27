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
/** How long after a fresh start a found update may still reload the app, if you haven't touched it yet. */
const LAUNCH_WINDOW_MS = 15_000;
const launchedAt = performance.now();
/** Any tap, click or key press since launch: from then on the session is yours and isn't reloaded. */
let touched = false;
for (const type of ["pointerdown", "keydown"]) {
  window.addEventListener(type, () => (touched = true), { capture: true, once: true });
}

/**
 * Updates only ever arrive on a fresh start, never by interrupting a session. This script only runs
 * on a fresh start (coming back from the background resumes the page without re-running it), so:
 *
 * - An update found in the first moments of a launch, before you've touched anything, is swapped in
 *   with a reload that looks like the app finishing loading.
 * - Otherwise the new version just waits. The browser switches to it on its own the next time the
 *   app starts fresh, which on a phone is whenever the system has closed it in the background.
 */
const updateServiceWorker = registerSW({
  onNeedRefresh() {
    const fresh = performance.now() - launchedAt < LAUNCH_WINDOW_MS;
    if (fresh && !touched && !reader.get().open && library.get().importing === 0) updateServiceWorker(true);
  },
  onOfflineReady: () => showToast("Ready to use offline"),
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    // Installed apps are rarely restarted, so look for a new version whenever the app comes back to
    // the front, and every so often while it stays open. Found versions wait for the next fresh start.
    const check = () => navigator.onLine && registration.update().catch(() => {});
    setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
  },
});

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
