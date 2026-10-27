import { isIosSafari, promptInstall, usePwa } from "../pwa";
import { library, updateSettings } from "../store/library";
import { useStore } from "../store/store";
import { ShareIcon } from "./icons";

/**
 * Suggests putting the app on the Home Screen: quicker to reach, full screen, and on iOS it also stops
 * Safari from clearing the library after a week away. Android gets a real install button; iOS only has
 * Share > Add to Home Screen, so it gets the steps.
 */
export function InstallCard() {
  const installed = usePwa((s) => s.installed);
  const canPrompt = usePwa((s) => s.canPrompt);
  const dismissed = useStore(library, (s) => s.settings.installHintDismissed);
  if (installed || dismissed || (!canPrompt && !isIosSafari)) return null;

  return (
    <section className="install-card">
      <img className="install-icon" src="/apple-touch-icon-180x180.png" alt="" />
      <div className="install-body">
        <div className="install-title">Add bookblitz to your Home Screen</div>
        {canPrompt ? (
          <div className="install-text">Opens full screen, works offline, and keeps your library safe.</div>
        ) : (
          <div className="install-text">
            Tap <ShareIcon size={15} className="inline-icon" /> Share, then <b>Add to Home Screen</b>. Safari then never clears
            your library.
          </div>
        )}
        {canPrompt && (
          <button className="pill-button filled install-button" onClick={promptInstall}>
            Install
          </button>
        )}
      </div>
      <button className="install-close" aria-label="Dismiss" onClick={() => updateSettings({ installHintDismissed: true })}>
        ×
      </button>
    </section>
  );
}
