/**
 * The frames the share video plays: the Settings sample passage, cut and timed by the real reader
 * (Flow at 300 wpm), so the video reads exactly like the app. Prints JSON for render.sh.
 */
import { tokenize } from "../../src/epub/parse";
import { framePivot } from "../../src/reader/rsvp";
import { buildFrames, frameDurationMs, paragraphEnds, rampFactor, STYLES } from "../../src/reader/timing";

const TEXT =
  "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”";
const WPM = 300;

const words = tokenize(TEXT);
const ends = paragraphEnds([0], words.length);
const style = STYLES.flow;
const starts = buildFrames(words, ends, style);
const frames = starts.map((start, i) => {
  const end = starts[i + 1] ?? words.length;
  const text = words.slice(start, end).join(" ");
  const ms = Math.round(frameDurationMs(words, start, end, ends, style, WPM, rampFactor(i, style)));
  return { text, pivot: framePivot(text), ms };
});
console.log(JSON.stringify(frames));
