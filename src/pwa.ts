import { useSyncExternalStore } from "react";
import { registerSW } from "virtual:pwa-register";
import { showToast } from "./store/library";
import { createStore } from "./store/store";

/** The browser's install prompt (Chrome, Edge, Android); not in the DOM typings yet. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaState {
  /** A new version is downloaded and waiting. */
  updateReady: boolean;
  /** Running from the home screen rather than in a browser tab. */
  installed: boolean;
  /** Chrome/Android offered an install prompt we can show on our own button. */
  canPrompt: boolean;
}

const standalone = () =>
  matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const pwa = createStore<PwaState>({ updateReady: false, installed: standalone(), canPrompt: false });

let installPrompt: InstallPromptEvent | undefined;

const updateServiceWorker = registerSW({
  onNeedRefresh: () => pwa.set({ updateReady: true }),
  onOfflineReady: () => showToast("Ready to use offline"),
});

export function applyUpdate() {
  updateServiceWorker(true);
}

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
