import { DEFAULT_STYLE, STYLES, type StyleId } from "../reader/timing";
import { library, updateSettings } from "../store/library";
import { useStore } from "../store/store";
import { CheckIcon } from "./icons";
import { FONT_NAMES, FONTS } from "./fonts";
import { Slider } from "./Slider";
import { WordDisplay } from "./WordDisplay";

const MIN_TEXT_SIZE = 0.8;
const MAX_TEXT_SIZE = 1.5;

const STYLE_ORDER: StyleId[] = ["flow", "phrases", "calm"];

/**
 * The reader's Aa panel, everything about how reading looks in one place: text size, font and reading
 * style, with the word you're on (or a few lines, for guided reading) as the preview.
 */
export function TypePanel({ guided }: { guided: boolean }) {
  const font = useStore(library, (s) => s.settings.font);
  const size = useStore(library, (s) => s.settings.textSize ?? 1);
  const style = useStore(library, (s) => s.settings.style ?? DEFAULT_STYLE);
  return (
    <div className="type-panel">
      <div className="type-preview">{guided ? <GuidedPreview /> : <WordDisplay />}</div>
      <div className="type-size">
        <span className="type-size-small" aria-hidden>
          A
        </span>
        <Slider
          label="Text size"
          value={Math.round(size * 100)}
          min={MIN_TEXT_SIZE * 100}
          max={MAX_TEXT_SIZE * 100}
          step={5}
          onChange={(v) => updateSettings({ textSize: v / 100 })}
        />
        <span className="type-size-large" aria-hidden>
          A
        </span>
      </div>
      <div className="type-size-value">{Math.round(size * 100)}%</div>
      <div className="type-fonts" role="radiogroup" aria-label="Font">
        {FONTS.map((f) => (
          <button
            key={f}
            role="radio"
            aria-checked={f === font}
            className={`type-font pressable ${f === font ? "selected" : ""}`}
            onClick={() => updateSettings({ font: f })}
          >
            <span className={`type-font-sample font-${f}`}>Aa</span>
            <span className="type-font-name">{FONT_NAMES[f]}</span>
            {f === font && <CheckIcon size={14} className="type-font-check" />}
          </button>
        ))}
      </div>
      <div className="type-heading">Reading style</div>
      <div className="type-styles" role="radiogroup" aria-label="Reading style">
        {STYLE_ORDER.map((id) => (
          <button
            key={id}
            role="radio"
            aria-checked={id === style}
            className={`type-style pressable ${id === style ? "selected" : ""}`}
            onClick={() => updateSettings({ style: id, styleChosen: true })}
          >
            <span className="type-style-name">{STYLES[id].name}</span>
            <span className="type-style-tagline">{STYLES[id].tagline}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GuidedPreview() {
  return (
    <p className="guided-text type-guided-sample">
      Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do.
    </p>
  );
}
