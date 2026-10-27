# Word transitions in RSVP: what to try, and what to avoid

An experiment, not a settled feature. The question: does softening the hand-over from one word to the
next make RSVP less tiring than a hard cut, without costing legibility?

## What the evidence says

Nothing tests animated transitions directly. These adjacent findings constrain the design:

- **Blank gaps between words don't help.** In one pilot, a 100 ms blank between words made text
  comprehension harder, which the authors put down to attentional masking ([arXiv 2608.20186](https://arxiv.org/pdf/2608.20186)).
  An older study found that longer blank intervals don't reduce how long each word has to be shown to be
  read accurately ([PubMed 1604858](https://www.ncbi.nlm.nih.gov/pubmed/1604858)). A fade-out-then-fade-in that leaves a dim gap is likely to backfire.
- **Overlap costs legibility.** A word that follows another at the same place masks it, and the closer
  together the onsets, the stronger the masking ([backward masking](https://en.wikipedia.org/wiki/Backward_masking)). Two stimuli shown close together can
  also merge perceptually ([temporal integration in masking](https://link.springer.com/article/10.3758/BF03210816)). A full crossfade, with two words superimposed at
  high contrast, is risky.
- **Fatigue in RSVP is tied to suppressed blinking.** Benedetto et al. 2015 compared RSVP with normal reading
  and linked RSVP's sharply reduced blink rate to increased visual fatigue ([record](https://iris.uniroma1.it/handle/11573/923334)). Detection of targets is
  better in the ~300 ms after a blink ([PMC7545084](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7545084/)), which argues for real pauses (sentence ends already have them),
  not for motion between words.
- **Regressions matter for comprehension** ([Schotter et al. 2014](https://journals.sagepub.com/doi/abs/10.1177/0956797614531148)); a transition that hides or blurs the previous word
  faster doesn't change that, which the context view and "back" cover.

## Design rules that follow

1. The incoming word arrives crisp and almost immediately: no blank, at most a brief fade up from
   partial opacity.
2. Only the outgoing word gets the soft treatment, kept faint so it doesn't mask the new one.
3. Nothing takes more than about a third of a word's slot: `clamp(0.33 × 60000/wpm, 45, 110)` ms.
4. Scale around the focus letter so the fixation point never moves; horizontal movement is kept to a
   fraction of an em because it does move the word.

## Variants in the app (Settings → Word transitions)

Sixteen, deliberately wide, in four groups that each push one dimension. The exact keyframes are in
`src/ui/transitions.ts`; under reduced motion only the opacity part plays.

| Group | Variant | What it tests |
| --- | --- | --- |
| Fades | Cut | Baseline: instant swap |
| | Soften | Fade up from partial opacity; old word fades underneath |
| | Dissolve | Full cross-fade, words overlap (breaks the "no overlap" rule on purpose) |
| | Blink | Fade out, gap, fade in (breaks the "no gap" rule on purpose) |
| Depth | Depth | From just in front, recedes into blur |
| | Zoom | Flying through: words grow past you |
| | Recede | Words fall away into the distance |
| | Pop | Springy arrival with overshoot, no exit |
| Motion | Drift | Small slide in reading direction |
| | Ticker | Large horizontal slide, like a news ticker |
| | Rise | Vertical roll, like credits |
| | Flip | Split-flap 3D tilt (rotateX) |
| Blur & afterimage | Focus | Sharpen out of / blur into focus, no movement |
| | Smear | Motion blur: old word stretched and streaked away |
| | Echo | Faint blurred afterimage of the last word |
| | Trail | Afterimages that stream away, leaving a trail |

## Intensity, and Emil Kowalski's frequency gate

The first version kept every transition under a third of a word's slot (about 57 ms at 350 wpm), which
in practice was imperceptible. That matches Emil Kowalski's animation gate: an action seen 100+ times a
day shouldn't animate, and word swaps happen 5–6 times a second, so by that rule Cut is correct. The
open question is perceptual (does a softer hand-over reduce strain?), and that can only be judged at a
strength you can see. The lab therefore has three intensities:

| Intensity | Duration | Amplitude |
| --- | --- | --- |
| Subtle | 33% of a word, 45–110 ms | ×1 (the values above) |
| Noticeable (lab default) | 60% of a word, 90–180 ms | ×2 |
| Strong | 90% of a word, 120–260 ms | ×3 |

Blur stays at or below 16 px (Emil: keep animated blur under 20 px; Safari repaints filters). Soften is
the cheapest (opacity only); Echo is the most expensive (blurred layer held 3× as long). Confirm on a
real phone with a recording before keeping any.

## How to judge

Read a full chapter with each, at your usual speed. Signals worth noting: how tired your eyes feel after
10 minutes, how often you press back or pause, and whether you settle at a higher or lower wpm. If none
beats Cut on those, Cut stays.
