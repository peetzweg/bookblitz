import { useState } from "react";
import { applyUpdate, checkForUpdate, isIosSafari, promptInstall, usePwa, type UpdateStatus } from "../pwa";
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
import { GUIDE, GUIDE_ORDER } from "./guides";
import { GuidedSample } from "./GuidedReading";

declare const __APP_VERSION__: string;
declare const __COMMIT__: string;
declare const __BUILT_AT__: string;

const UPDATE_NOTE: Partial<Record<UpdateStatus, string>> = {
  checking: "Checking…",
  current: "Up to date",
  ready: "Downloaded",
  failed: "Couldn't check",
};

const REPO_URL = "https://github.com/peetzweg/bookblitz";
const RESEARCH_URL = `${REPO_URL}/blob/main/docs/research/speed-reading.md`;
const KOFI_URL = "https://ko-fi.com/peetzweg";
const SPONSOR_URL = "https://github.com/sponsors/peetzweg";

/** iOS-style grouped settings. The reading style is the same live taste test as the onboarding. */
export function Settings() {
  const settings = useStore(library, (s) => s.settings);
  const hasSample = useStore(library, (s) => s.books.some((b) => /^Alice.s Adventures in Wonderland$/.test(b.title)));
  const installed = usePwa((s) => s.installed);
  const canPrompt = usePwa((s) => s.canPrompt);
  const update = usePwa((s) => s.update);
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

      <h2 className="settings-heading">Guided reading · Experimental</h2>
      <section className="settings-group padded lab-section">
        <GuideLab />
      </section>
      <p className="settings-footnote">
        Instead of flashing words in one place, keep the text on the page and let a guide pace your eyes through it, at your
        speed and with your reading style's pauses. Try each on a real chapter.
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

      <h2 className="settings-heading">Support bookblitz</h2>
      <section className="settings-group">
        <a className="settings-row pressable" href={KOFI_URL} target="_blank" rel="noreferrer">
          <span>Buy me a coffee on Ko-fi</span>
          <span className="settings-value">›</span>
        </a>
        <a className="settings-row pressable" href={SPONSOR_URL} target="_blank" rel="noreferrer">
          <span>Sponsor on GitHub</span>
          <span className="settings-value">›</span>
        </a>
      </section>
      <p className="settings-footnote">Free, with no ads and no tracking, and built by one person.</p>

      <h2 className="settings-heading">About</h2>
      <section className="settings-group">
        <a className="settings-row pressable" href={RESEARCH_URL} target="_blank" rel="noreferrer">
          <span>How the reading styles are timed</span>
          <span className="settings-value">›</span>
        </a>
        <a className="settings-row pressable" href={REPO_URL} target="_blank" rel="noreferrer">
          <span>Source code on GitHub</span>
          <span className="settings-value">›</span>
        </a>
        {/* The commit links to exactly what's running, for reference. */}
        <a
          className="settings-row pressable"
          href={__COMMIT__ === "dev" ? REPO_URL : `${REPO_URL}/commit/${__COMMIT__}`}
          target="_blank"
          rel="noreferrer"
        >
          <span>Version</span>
          <span className="settings-value">
            {__APP_VERSION__} · {__COMMIT__} · {new Date(__BUILT_AT__).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          </span>
        </a>
        {!import.meta.env.DEV && (
          <button
            className="settings-row pressable"
            disabled={update === "checking"}
            onClick={update === "ready" ? applyUpdate : checkForUpdate}
          >
            <span className={update === "ready" ? "tint" : undefined}>
              {update === "ready" ? "Restart to Update" : "Check for Updates"}
            </span>
            {UPDATE_NOTE[update] && <span className="settings-value">{UPDATE_NOTE[update]}</span>}
          </button>
        )}
      </section>
    </main>
  );
}

/** Guide picker with a live preview; the choice applies to the reader straight away. */
function GuideLab() {
  const current = useStore(library, (s) => s.settings.guide ?? "flash");
  const gradient = useStore(library, (s) => !!s.settings.guideGradient);
  const bold = useStore(library, (s) => !!s.settings.guideBold);
  return (
    <div className="style-picker embedded">
      <div className="style-preview guide-preview">
        {current === "flash" ? <SamplePlayer /> : <GuidedSample guide={current} />}
      </div>
      <div className="style-options" role="radiogroup" aria-label="Guide">
        {GUIDE_ORDER.map((id) => (
          <button
            key={id}
            role="radio"
            aria-checked={current === id}
            className={`style-option pressable ${current === id ? "selected" : ""}`}
            onClick={() => updateSettings({ guide: id })}
          >
            <span className="style-option-text">
              <span className="style-option-name">{GUIDE[id].name}</span>
              <span className="style-option-tagline">{GUIDE[id].description}</span>
            </span>
            <span className="style-check">{current === id && <CheckIcon size={16} />}</span>
          </button>
        ))}
      </div>
      <div className="lab-group">
        <div className="lab-group-name">On the page, with any guide</div>
        <div className="style-options">
          <button
            role="switch"
            aria-checked={gradient}
            className={`style-option pressable ${gradient ? "selected" : ""}`}
            onClick={() => updateSettings({ guideGradient: !gradient })}
          >
            <span className="style-option-text">
              <span className="style-option-name">Colour gradient</span>
              <span className="style-option-tagline">
                Each line fades into a colour that the next line starts with, to carry your eye back to the start (BeeLine)
              </span>
            </span>
            <span className="style-check">{gradient && <CheckIcon size={16} />}</span>
          </button>
          <button
            role="switch"
            aria-checked={bold}
            className={`style-option pressable ${bold ? "selected" : ""}`}
            onClick={() => updateSettings({ guideBold: !bold })}
          >
            <span className="style-option-text">
              <span className="style-option-name">Bold word starts</span>
              <span className="style-option-tagline">
                The first half of each word is bold (Bionic Reading). Popular, though studies haven't found it faster
              </span>
            </span>
            <span className="style-check">{bold && <CheckIcon size={16} />}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const SLOW_MOTION = 4;

/** Live preview plus the variants; picking one applies it straight away, here and in the reader. */
function TransitionLab() {
  const current = useStore(library, (s) => s.settings.transition ?? "cut");
  const intensity = useStore(library, (s) => s.settings.transitionIntensity ?? "noticeable");
  // At reading speed most transitions are over in a few frames; slow motion shows what each one does.
  const [slow, setSlow] = useState(false);
  const even = useStore(library, (s) => !!s.settings.evenRhythm);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <div className="style-picker embedded">
      <div className="style-preview">
        <SamplePlayer transition={current} slow={slow ? SLOW_MOTION : 1} />
        <button className={`lab-slowmo ${slow ? "on" : ""}`} aria-pressed={slow} onClick={() => setSlow((v) => !v)}>
          {slow ? "Slow motion · ¼" : "Slow motion"}
        </button>
      </div>
      {reducedMotion && (
        <p className="lab-note">
          Reduce Motion is on in your system settings, so only the fading part of each transition plays: no movement and
          no blur.
        </p>
      )}
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
      <div className="lab-group">
        <div className="lab-group-name">Rhythm</div>
        <div className="style-options">
          <button
            role="switch"
            aria-checked={even}
            className={`style-option pressable ${even ? "selected" : ""}`}
            onClick={() => updateSettings({ evenRhythm: !even })}
          >
            <span className="style-option-text">
              <span className="style-option-name">Even rhythm</span>
              <span className="style-option-tagline">
                A steadier beat: short words and commas get closer to an ordinary word, so words arrive more evenly. Long words
                and sentence ends keep their time. Works with any transition and style
              </span>
            </span>
            <span className="style-check">{even && <CheckIcon size={16} />}</span>
          </button>
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
    </div>
  );
}
