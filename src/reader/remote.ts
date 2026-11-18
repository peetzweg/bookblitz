import { library } from "../store/library";
import { pause, play, reader, stepSentence } from "./reader";

/**
 * Headphone and lock-screen controls, through the Media Session API: play/pause on the headphones
 * pauses and resumes reading, and next/previous (a double or triple press on AirPods) jump a sentence.
 *
 * Browsers only route those buttons to a page that is playing audio, so while reading, a silent clip
 * loops. The catch: on iPhone that takes over the audio, so music from another app stops. That's why
 * it can be turned off in Settings.
 */

let audio: HTMLAudioElement | undefined;

const enabled = () => library.get().settings.headphoneControls !== false && "mediaSession" in navigator;

/** One second of silence as an 8 kHz, 8-bit mono WAV. */
function silentWav(): string {
  const samples = 8000;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, "data");
  view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8-bit audio is unsigned: 128 is silence
  return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
}

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio(silentWav());
  audio.loop = true;
  // Taking the headphones out pauses the audio by itself; pause reading with it.
  audio.addEventListener("pause", () => {
    if (reader.get().playing && enabled()) pause();
  });
  const session = navigator.mediaSession;
  session.setActionHandler("play", () => play());
  session.setActionHandler("pause", () => pause());
  session.setActionHandler("stop", () => pause());
  session.setActionHandler("nexttrack", () => stepSentence(1));
  session.setActionHandler("previoustrack", () => stepSentence(-1));
  return audio;
}

function describe() {
  const { book, chapter } = reader.get();
  if (!book) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: book.chapters[chapter]?.title ?? book.title,
    artist: book.author,
    album: book.title,
  });
}

let wasPlaying = false;
let lastChapter = -1;
reader.subscribe(() => {
  const { playing, chapter, book } = reader.get();
  if (!book) {
    audio?.pause();
    wasPlaying = false;
    return;
  }
  if (playing === wasPlaying && chapter === lastChapter) return;
  wasPlaying = playing;
  lastChapter = chapter;
  if (!enabled()) return;
  describe();
  const a = ensureAudio();
  // Called from the tap that started reading, so the browser lets it play.
  if (playing) a.play().catch(() => {});
  else if (!a.paused) a.pause();
  navigator.mediaSession.playbackState = playing ? "playing" : "paused";
});

// Turned off in Settings: let go of the audio, so other apps' music can play again.
library.subscribe(() => {
  if (!enabled() && audio && !audio.paused) audio.pause();
});
