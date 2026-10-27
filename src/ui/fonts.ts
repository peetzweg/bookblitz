import type { ReaderFont } from "../store/db";

/** Reading fonts in the order the reader's Aa button cycles through them. */
export const FONTS: ReaderFont[] = ["sans", "serif", "iowan", "charter", "athelas", "rounded"];

export const FONT_NAMES: Record<ReaderFont, string> = {
  sans: "SF Pro",
  serif: "New York",
  iowan: "Iowan",
  charter: "Charter",
  athelas: "Athelas",
  rounded: "SF Rounded",
};
