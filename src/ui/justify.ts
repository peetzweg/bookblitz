/**
 * Optimal line breaking for justified text, after Knuth and Plass ("Breaking Paragraphs into Lines",
 * 1981), the algorithm TeX uses. Greedy breaking (what browsers do) fills each line as far as it goes,
 * which leaves some lines with wide gaps when justified; this looks at the whole paragraph and picks the
 * breaks that keep every line's spacing as even as possible.
 *
 * Simplified: no hyphenation, so only spaces stretch and shrink, and no fitness classes. It's a shortest
 * path over break positions, scored with TeX's badness and demerits.
 */

/** How far a space may stretch and shrink, as a share of its natural width (TeX's defaults, roughly). */
const STRETCH = 0.5;
const SHRINK = 0.33;
/** Cost added to every line, so fewer lines win when spacing is otherwise equal (TeX's \linepenalty). */
const LINE_PENALTY = 10;
/** A line stretched beyond this ratio is allowed only if there's no better way. */
const LOOSE_LIMIT = 3;

/**
 * Where to break a paragraph of words with these widths: the index one past the last word of each line.
 * The last line is set ragged at its natural spacing.
 */
export function breakLines(widths: number[], space: number, lineWidth: number): number[] {
  const n = widths.length;
  if (!n) return [];
  // Prefix sums, so a line's natural width is O(1).
  const sum = [0];
  for (const w of widths) sum.push(sum[sum.length - 1] + w);

  const best = new Array<number>(n + 1).fill(Infinity);
  const from = new Array<number>(n + 1).fill(-1);
  best[0] = 0;
  for (let i = 0; i < n; i++) {
    if (best[i] === Infinity) continue;
    for (let j = i + 1; j <= n; j++) {
      const gaps = j - i - 1;
      const natural = sum[j] - sum[i] + gaps * space;
      const minimum = natural - gaps * space * SHRINK;
      // A single word too wide for the line still has to go somewhere.
      if (minimum > lineWidth && j > i + 1) break;
      let cost: number;
      if (j === n && natural <= lineWidth) {
        cost = 0;
      } else {
        const slack = lineWidth - natural;
        const ratio = gaps === 0 ? (slack >= 0 ? LOOSE_LIMIT : 0) : slack / (gaps * space * (slack >= 0 ? STRETCH : SHRINK));
        const badness = 100 * Math.abs(ratio) ** 3;
        // Lines looser than the limit still count, at a cost that only wins when nothing else fits.
        cost = (LINE_PENALTY + Math.min(badness, 10000)) ** 2 + (ratio > LOOSE_LIMIT ? 1e8 : 0);
      }
      if (best[i] + cost < best[j]) {
        best[j] = best[i] + cost;
        from[j] = i;
      }
    }
  }

  const breaks: number[] = [];
  for (let j = n; j > 0; j = from[j]) breaks.push(j);
  return breaks.reverse();
}
