import { isIosSafari, promptInstall, usePwa } from "../pwa";
import { DEFAULT_STYLE, STYLES } from "../reader/timing";
import { closeBook, reader, setWpm } from "../reader/reader";
import { addSampleBook, library, resetLibrary, showToast, updateSettings } from "../store/library";
import { useStore } from "../store/store";
import { CheckIcon, ChevronLeftIcon } from "./icons";
import { FONT_NAMES, FONTS } from "./fonts";
import { goBack } from "./router";
import { Slider } from "./Slider";
import { SamplePlayer, StylePicker } from "./StylePicker";
import { INTENSITIES, TRANSITION_GROUPS, TRANSITIONS } from "./transitions";

declare const __APP_VERSION__: string;
declare const __COMMIT__: string;

const RESEARCH_URL = "https://github.com/peetzweg/bookblitz/blob/main/docs/research/speed-reading.md";

/** iOS-style grouped settings. The reading style is the same live taste test as the onboarding. */
export function Settings() {
  const settings = useStore(library, (s) => s.settings);
  const hasSample = useStore(library, (s) => s.books.some((b) => /^Alice.s Adventures in Wonderland$/.test(b.title)));
  const installed = usePwa((s) => s.installed);
  const canPrompt = usePwa((s) => s.canPrompt);
  const style = STYLES[settings.style ?? DEFAULT_STYLE] ?? STYLES[DEFAULT_STYLE];
  const font = settings.font;

  // The reader font class goes on the page, so every preview here reads in your font.
  return (
    <main className={`page settings-page reader-font-${font}`}>
      <header className="nav-bar scrolled">
        <button className="nav-back tint" onClick={goBack}>
          <ChevronLeftIcon size={22} />
          Library
        </button>
        <div className="nav-title" style={{ opacity: 1 }}>
          Settings
        </div>
        <div className="nav-spacer" />
      </header>

      <h2 className="settings-heading">Speed</h2>
      <section className="settings-group padded">
        <div className="settings-speed">
          <span className="speed-end">100</span>
          <Slider label="Words per minute" value={settings.wpm} min={100} max={1000} step={10} onChange={setWpm} />
          <span className="speed-end">1000</span>
        </div>
        <div className="settings-row-split">
          <span>{settings.wpm} words per minute</span>
          {settings.wpm !== style.defaultWpm && (
            <button className="link-button" onClick={() => setWpm(style.defaultWpm)}>
              Use {style.name}'s {style.defaultWpm}
            </button>
          )}
        </div>
      </section>

      <h2 className="settings-heading">Reading style</h2>
      <section className="settings-group padded">
        <StylePicker embedded />
      </section>
      <p className="settings-footnote">
        Each style plays the sample at your speed.{" "}
        <button
          className="link-button"
          onClick={() => {
            updateSettings({ styleChosen: false });
            showToast("You'll see the intro next time you start reading");
          }}
        >
          Show the intro again
        </button>
      </p>

      <h2 className="settings-heading">Word transitions · Experimental</h2>
      <section className="settings-group padded lab-section">
        <TransitionLab />
      </section>
      <p className="settings-footnote">
        How one word hands over to the next. Give each a minute at your speed; the one you pick is used in the reader too, so
        try it on a real chapter. Cut is the classic.
      </p>

      <h2 className="settings-heading">Font</h2>
      <section className="settings-group">
        {FONTS.map((f) => (
          <button key={f} className="settings-row pressable" onClick={() => updateSettings({ font: f })}>
            <span className={`font-${f} settings-font-sample`}>{FONT_NAMES[f]}</span>
            {font === f && <CheckIcon size={18} className="tint" />}
          </button>
        ))}
      </section>

      <h2 className="settings-heading">Library</h2>
      <section className="settings-group">
        {!installed && (canPrompt || isIosSafari) && (
          <button
            className="settings-row pressable"
            onClick={() =>
              canPrompt ? promptInstall() : showToast("In Safari, tap Share, then Add to Home Screen", 5000)
            }
          >
            <span>Add to Home Screen</span>
          </button>
        )}
        {!hasSample && (
          <button className="settings-row pressable" onClick={addSampleBook}>
            <span>Add Alice in Wonderland</span>
          </button>
        )}
        <button
          className="settings-row pressable destructive"
          onClick={() => {
            if (!confirm("Remove all books, reading progress and settings from this device? This can't be undone.")) return;
            if (reader.get().book) closeBook();
            resetLibrary();
          }}
        >
          <span>Reset bookblitz…</span>
        </button>
      </section>

      <h2 className="settings-heading">About</h2>
      <section className="settings-group">
        <a className="settings-row pressable" href={RESEARCH_URL} target="_blank" rel="noreferrer">
          <span>How the reading styles are timed</span>
          <span className="settings-value">›</span>
        </a>
        <div className="settings-row">
          <span>Version</span>
          <span className="settings-value">
            {__APP_VERSION__} ({__COMMIT__})
          </span>
        </div>
      </section>
    </main>
  );
}

/** Live preview plus the variants; picking one applies it straight away, here and in the reader. */
function TransitionLab() {
  const current = useStore(library, (s) => s.settings.transition ?? "cut");
  const intensity = useStore(library, (s) => s.settings.transitionIntensity ?? "noticeable");
  return (
    <div className="style-picker embedded">
      <div className="style-preview">
        <SamplePlayer transition={current} />
      </div>
      <div className="segmented lab-intensity" role="radiogroup" aria-label="Intensity">
        {INTENSITIES.map((level) => (
          <button
            key={level.id}
            role="radio"
            aria-selected={intensity === level.id}
            className="segment"
            onClick={() => updateSettings({ transitionIntensity: level.id })}
          >
            {intensity === level.id && <span className="segment-indicator" />}
            <span className="segment-label">{level.name}</span>
          </button>
        ))}
      </div>
      {TRANSITION_GROUPS.map((group) => (
        <div key={group.name} className="lab-group">
          <div className="lab-group-name">{group.name}</div>
          <div className="style-options" role="radiogroup" aria-label={`${group.name} transitions`}>
            {group.ids.map((id) => (
              <button
                key={id}
                role="radio"
                aria-checked={current === id}
                className={`style-option pressable ${current === id ? "selected" : ""}`}
                onClick={() => updateSettings({ transition: id })}
              >
                <span className="style-option-text">
                  <span className="style-option-name">{TRANSITIONS[id].name}</span>
                  <span className="style-option-tagline">{TRANSITIONS[id].description}</span>
                </span>
                <span className="style-check">{current === id && <CheckIcon size={16} />}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
