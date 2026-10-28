# Guided reading: pacers, highlights and sweeps over normal running text

Research brief for a "lab" of guided-reading modes in bookblitz. RSVP stays as it is (`src/reader/rsvp.ts`, see [speed-reading.md](speed-reading.md)). The new modes keep the chapter on the page as normal running text and move something through it to guide the eye.
Compiled 2026-10-28. Every claim has a link. Each one is tagged:

- **[R]** research-backed: a peer-reviewed study, a review, or an eye-movement finding.
- **[I]** implementation convention: what shipping apps and extensions do. No published evidence behind the specific behaviour.
- **[D]** derived here: our own calculation or judgment from the above. Treat it as a starting value to tune.

---

## TL;DR

1. **No guided technique has been shown to make skilled adults read faster at the same comprehension.** [R] The speed-reading review concludes there is no shortcut: less time on the text means less is understood ([Rayner et al. 2016, PSPI](https://doi.org/10.1177/1529100615623267)). Trained speed readers behave like skimmers ([Just, Carpenter & Masson 1982, via Wikipedia's summary of Just & Carpenter 1987](https://en.wikipedia.org/wiki/Speed_reading)). What a guide *can* do is set a steady pace, keep your place, and hold attention. Sell the lab as "pace and focus", not "triple your speed".
2. **Guided modes have one structural advantage over RSVP: you can look back.** [R] Blocking regressions lowers comprehension ([Schotter, Tran & Rayner 2014](https://doi.org/10.1177/0956797614531148)). A pacer over a static page leaves every earlier word visible. Do not dim or hide text the guide has already passed.
3. **Highlighting by meaning units beats highlighting by visual lines, on preference.** [R] Hover-highlighting of sentences and paragraphs was rated more attention-sustaining than static text. Line-by-line highlighting "divided users". None of them changed speed or comprehension (n = 80, [Vatány et al. 2026](https://doi.org/10.34314/8j37se94)). Phrase-level cues help average readers' comprehension in static text ([Jandreau & Bever 1992](https://psycnet.apa.org/doi/10.1037/0021-9010.77.2.143)).
4. **Bionic Reading does not work** [R] ([Snell 2024](https://doi.org/10.1016/j.actpsy.2024.104304); registered eye-tracking study, n = 90, [Parker et al. 2026](https://doi.org/10.1098/rsos.250177); [Readwise, n = 1,916](https://blog.readwise.io/bionic-reading-results/)). **BeeLine's gradients have mixed-to-negative independent evidence** ([Koornneef & Kraal 2022](https://doi.org/10.1016/j.chbr.2022.100197)). Leave both out of the lab, or keep them only as controls.
5. **Drive every guide from the existing timing model.** [D] Use the same per-word weights and punctuation pauses as Flow/Phrases (`timing.ts`), mapped onto the laid-out words. The guide then slows on long words and stops at sentence ends, which is the best-supported timing rule we have (speed-reading.md §1).
6. **Lab shortlist (§4): Phrase hop, Pen sweep, Sentence spotlight, Line focus, Auto-scroll, Fixation hops.** Defaults are 240–300 wpm.

---

## 1. The techniques, what users see, and who ships them

On a ≈375 pt phone with ≈20 pt side padding and a ≈19.5 px serif, a line holds about **34–38 characters, so 6 words** [D]. English averages 4.6–4.8 letters per word, plus a space ([Brysbaert 2019](https://doi.org/10.1016/j.jml.2019.104047)). At 300 wpm that is **≈1.2 s per line, ≈50 lines/min**.

| Technique | What the user sees | How motion is timed | Who ships it | Tag |
| --- | --- | --- | --- | --- |
| **Hand / pen pacer (meta-guiding)** | A finger or capped pen moving under each line, with the eyes kept just above the tip | Continuous sweep under the line. Wood's "Reading Dynamics" used a zigzag motion of the hand down the page ([Britannica](https://www.britannica.com/topic/Reading-Dynamics)). Ferriss's PX drill: at most **1 s per line**, then **½ s per line** ([Ferriss 2009](https://tim.blog/2009/07/30/speed-reading-and-accelerated-learning/)) | Courses (Evelyn Wood, PX project), not apps | I |
| **"Start one word in, stop one word before the edge"** | The same pen, but it starts on word 2 and stops at the penultimate word. Later 2 words in, then 3+ | One line per second, inset 1 word, then 2, then 3 ([Ferriss 2009](https://tim.blog/2009/07/30/speed-reading-and-accelerated-learning/)). The idea is that parafoveal vision picks up the edges | Ferriss / PX project | I |
| **Digital pacer (moving highlight or underline at a set wpm)** | A marker moving through text that stays put | Outread's "Guide" (formerly "Highlighting") moves a highlighter along the page. Speed and "marker size" (characters highlighted) are adjustable, up to 1,500 wpm, and you can tap to jump or use "Go Back" ([App Store](https://apps.apple.com/app/id778846279), [TNW 2014](https://thenextweb.com/news/outread)). Spreeder's 2025 app has a "Pacer Mode ... with guided scrolling" next to RSVP and chunk modes ([App Store](https://apps.apple.com/us/app/-/id6748313372)). The "Pacer speed reading" extension "guides your eyes across as well as down lines of text" ([Chrome Web Store](https://chromewebstore.google.com/detail/pacer-speed-reading/jcofnjnjaijcgkcdklddpokkdmdnmckn)). AceReader offers eye-pacing drills ([Cathy Duffy review](https://www.cathyduffyreviews.com/homeschool-reviews-core-curricula/phonics-reading/reading-skills-supplements/acereader-review)). None of these documents its line-return or punctuation behaviour. | Outread, Spreeder, Pacer, AceReader | I |
| **Chunk highlight in place** | 2–4 words tinted on the page, hopping forward | Discrete hops at wpm × words-per-chunk. Outread's marker size is the chunk width | Outread (marker size), RSVP apps' "chunk" modes (not in place) | I |
| **Karaoke highlight (TTS sync)** | The current word highlighted, the current sentence underlined | Hops driven by speech timestamps. iOS Spoken Content offers *Words*, *Sentences*, or both, as underline or background ([AbilityNet guide](https://mcmw.abilitynet.org.uk/how-to-use-speak-selection-to-read-text-aloud-in-ios-18-on-your-iphone-or-ipad)). Speechify and Immersive Reader do the same | iOS, Speechify, Immersive Reader | I |
| **Line focus / reading ruler** | A band of 1, 3 or 5 lines at full contrast, the rest dimmed or masked | Manual (arrow keys), not paced ([Microsoft](https://support.microsoft.com/en-gb/topic/use-line-focus-in-immersive-reader-for-office-for-the-web-and-onenote-815d5ae2-9291-4d57-b6d5-780280da27c7)). Helperbird's Focus Ruler lets you set band height, width, tint, and dimming ([Helperbird](https://www.helperbird.com/features/focus-ruler/)) | Immersive Reader (Edge, Word, OneNote), Helperbird | I |
| **Sentence / paragraph spotlight** | The current sentence at full ink, the rest faded | Advances per sentence, by hover in the study (others at 30% transparency, [Vatány et al. 2026](https://doi.org/10.34314/8j37se94)) or per TTS sentence | iOS sentence highlight; research prototypes | R/I |
| **Auto-scroll / teleprompter** | The page drifts up continuously, with a reading line or window | Pixels per second. Horizontal "Times Square" scrolling was tested against RSVP ([Kang & Muter 1989](https://doi.org/10.1080/01449298908914536)) | Teleprompter apps, Spreeder's "guided scrolling", e-reader auto-scroll | R/I |
| **BeeLine Reader** | Each line fades from one colour to another, and the next line starts in the colour the last one ended in | Static, not paced. The gradient is meant to pull the eye to the right next line ([App Store](https://apple.co/2pdOFPo), [Zero Project](https://zeroproject.org/view/project/f4b93de3-ad4a-ec11-8c62-000d3ab5a6d0)) | BeeLine, also built into Blackboard Ally ([docs](https://help.blackboard.com/Ally/Ally_for_LMS/Administrator/Communication_and_Adoption_Toolkit/BeeLine_Reader)) | I |
| **Bionic Reading** | The first part of each word in bold | Static. "Fixation" (1–5) sets how much is bold, "saccade" sets how often, plus opacity ([developer docs](https://developer.bionic-reading.com/framework/Classes/BionicReadingSettings.html)) | Bionic Reading apps and API, many clones | I |
| **Fixation-point marks** | 2–3 faint dots or ticks per line, where the eye should land | Static, or hop dot to dot at the pacer rate. Fixation count per line is the training variable (the "saccade" setting in Bionic, the PX inset drill) | Speed-reading courses; no dedicated app found | I |
| **Narrow columns** | Short lines | Static | Default on any phone | R |

## 2. Evidence

| Technique | Finding | Tag |
| --- | --- | --- |
| Speed reading in general | No evidence that guide- or training-based methods double or triple speed with good comprehension. Saccades take about 10% of reading time, so removing eye movement can't save much, and "readers who spend less time on material necessarily understand it less well" ([PSPI 2016](https://doi.org/10.1177/1529100615623267); [APS summary](https://www.psychologicalscience.org/news/releases/speed-reading-promises-are-too-good-to-be-true-scientists-find.html)). Trained speed readers reached ≈700 wpm against skimmers' ≈600 and readers' ≈240. On detail questions and hard text they did as badly as the skimmers (Just, Carpenter & Masson 1982, summarised in [Wikipedia: Speed reading](https://en.wikipedia.org/wiki/Speed_reading)). | R (negative) |
| Hand / pen pacer | **No controlled study of finger or pen pacing in adult reading found.** Wood and Ferriss report speed-ups (Ferriss: "386%" from one 3-hour session), but neither published a sample or a comprehension measure ([Ferriss 2009](https://tim.blog/2009/07/30/speed-reading-and-accelerated-learning/), [Britannica](https://www.britannica.com/biography/Evelyn-Wood)). The closest evidence is indirect: tracing with a finger lowered extraneous load and improved recall when learning from diagrams ([Ginns & King 2021](https://doi.org/10.1007/s11423-021-09997-0)). That is a different task. | — / R (indirect) |
| Digital pacers | **No eye-tracking or comprehension study of a moving pacer found.** Older work found a *compressed-speech* pacer raised reading rate without loss of comprehension after 10 sessions (cited in [patent US4457720](https://patents.justia.com/patent/4457720)'s background; primary not retrieved). The pacer-patent background itself calls earlier "controlled reading devices" only of "limited" use. | — |
| Margin inset (start one word in) | Untested. It is consistent with perceptual-span data, though: the span reaches only 3–4 letters left of fixation but 14–15 to the right, so a fixation on word 2 still covers some of word 1 ([PSPI](https://doi.org/10.1177/1529100615623267), p. 11). It does not cover a whole word to the *left*, so the inset relies on the previous fixation and on guessing. | R → D |
| Chunk / phrase highlight in place | Phrase-cued static text: extra space at phrase boundaries improved comprehension in average (not good) college readers ([Jandreau & Bever 1992](https://psycnet.apa.org/doi/10.1037/0021-9010.77.2.143)). Syntactically cued text improved oral reading fluency in developing readers ([LeVasseur et al. 2006](https://www.cambridge.org/core/journals/applied-psycholinguistics/article/syntactically-cued-text-facilitates-oral-reading-fluency-in-developing-readers/49D41A8EF948352C852B647237540E57)). The cascaded visual-syntactic format (VSTF) reported large gains, but in the developers' own trials ([Walker et al. 2005](https://experts.umn.edu/en/publications/visual-syntactic-text-formatting-a-new-method-to-enhance-online-r/)). In RSVP, phrase chunks of ≈15 characters matched page speed at equal comprehension ([Öquist 2006](https://smartlib.umri.ac.id/assets/uploads/files/8572d-relev-res.pdf); speed-reading.md §2). | R (small, mostly static or RSVP) |
| Karaoke / synced highlight | With TTS, sentence or word highlighting was **preferred** over none. Comprehension did not change (aphasia, n = 25, [PMC7959096](https://pmc.ncbi.nlm.nih.gov/articles/PMC7959096)). In children, reading skill mattered more than highlighting ([CAST summary](https://cisl.cast.org/research/read-aloud)). | R (preference only) |
| Line / sentence / paragraph highlight | Hover-driven highlighting, others at 30% transparency, n = 80: **no difference in speed or comprehension**. Sentence and paragraph highlighting scored higher on perceived attention. Line-by-line "divided users" ([Vatány et al. 2026](https://doi.org/10.34314/8j37se94)). | R |
| Line guide / ruler | A physical line guide with stand magnifiers (low-vision readers) *cut* speed by ≈6 wpm and made returning to the next line harder, yet 48% preferred it ([QUT](https://eprints.qut.edu.au/19629)). No study of Immersive Reader's line focus found. Microsoft frames it as a dyslexia aid ([Microsoft](https://support.microsoft.com/en-gb/topic/use-line-focus-in-immersive-reader-for-office-for-the-web-and-onenote-815d5ae2-9291-4d57-b6d5-780280da27c7)). | R (weak, negative for speed) |
| Auto-scroll | Smooth horizontal scrolling matched multi-word RSVP comprehension at 100–300 wpm and was **preferred** over stepped scrolling and RSVP ([Kang & Muter 1989](https://doi.org/10.1080/01449298908914536), [abstract](https://web-archive.southampton.ac.uk/cogprints.org/1971/1/Abs1989.htm)). In vertical auto-scroll, gaze sat on the bottom line of a 4-line window and the centre of a 7-line window. The 4-line window had a slower comfortable speed, and the span did not extend below the current line ([Yamashita & Morita 2023](https://www.jstage.jst.go.jp/article/vision/35/3/35_87/_article/-char/en)). RSVP beat scrolling when sitting and lost to it when walking ([Rzayev et al. 2018](https://doi.org/10.1145/3173574.3173619)). | R |
| BeeLine gradients | In 6–9-year-olds, BeeLine helped speed only with long lines and tight spacing. It was *slower* on well-set text, may have hurt third-graders' comprehension, and was rated harder ([Koornneef & Kraal 2022](https://doi.org/10.1016/j.chbr.2022.100197)). The vendor's speed claims are unpublished ([Behavioral Scientist](https://behavioralscientist.org/speed-reading-apps-open-research-questions/)). | R (negative/mixed) |
| Bionic Reading | No reading-time difference over 100 paragraphs ([Snell 2024](https://doi.org/10.1016/j.actpsy.2024.104304)). n = 1,916: 325 vs 328 wpm, 88% comprehension in both ([Readwise](https://blog.readwise.io/bionic-reading-results/)). Eye tracking (n = 90): it shifts first landing toward the start of 8-letter words, but there is no change in gaze, skipping or sentence time, and plain text was rated more readable ([Parker et al. 2026](https://doi.org/10.1098/rsos.250177)). | R (negative) |
| Short lines | Short lines on a small e-reader sped up some dyslexic readers by 27%, cut regressions by more than half, and cost nothing in comprehension ([Schneps et al. 2013a](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3734020/), [2013b](https://doaj.org/article/f5229dc27a5a47a881e605bef86ca805)). For typical readers, ≈55 cpl gave the best comprehension ([Dyson & Haselgrove 2001](https://doi.org/10.1006/ijhc.2001.0458)). A phone already gives ≈36 cpl, so no extra narrowing is needed. | R |
| Line returns | Return sweeps undershoot. A corrective saccade follows **52% of return sweeps in adults** (68% in children). Line-initial landings further from the margin need correcting more often. Undersweep fixations give a preview of line-initial words (Parker et al. 2019, cited in [Parker, Slattery & Kirkby 2020](https://eprints.bournemouth.ac.uk/33155/)). | R |

**Bottom line** [R → D]: the guided techniques are low-risk. Unlike RSVP, they keep the page, regressions, and normal saccades. That probably avoids RSVP's blink suppression and higher workload ([Benedetto et al. 2015](https://doi.org/10.1016/j.chb.2014.12.043)), though that is a hypothesis. Their measured benefit is preference and sustained attention, not speed. The meaningful lab question is which one makes it *pleasant to hold a pace* through a chapter.

## 3. Implementation parameters (phone, ≈36 cpl, ≈6 words/line)

### 3.1 One clock for all guides [D]

```
for each laid-out word i:  dur_i = weight_i × base           // Flow/Phrases weights, base = 60000/wpm
                           pause_i = clause/sentence/paragraph pause after i (with ms floors)
line return (word i ends a visual line):  pause_i += max(0.35 × base, 120 ms)
guide position at time t = (word index, fraction f ∈ [0,1] through that word)
```

- Measure word boxes from the rendered DOM (`Range.getClientRects()`) after layout and after every font or resize change. Words split across lines are rare without hyphenation. If you hyphenate, treat each fragment as its own word, with the weight split by letters.
- **Line returns** [R → D]: never animate the guide back across the line. Jump it to the start of the next line, then **hold** for the return pause before it moves on. That pause is the time for the undershoot and corrective saccade (Parker, Slattery & Kirkby 2020). If a punctuation pause already falls at the line end, use the larger of the two; don't add both.
- **Punctuation** [R/I]: the guide *stops* during clause, sentence and paragraph pauses (Masson 1983 and Castelhano & Muter 2001 via speed-reading.md §1.1). A sentence-end stop is also the natural moment to make a hop visible.
- **Ramp** [I]: reuse the RSVP ramp (≈56% speed rising to 100% over 6 frames) on start and after any jump. Tap pauses. Tap a word to move the guide there. Keep "back to sentence start".
- **Context** [R]: don't fade text the guide has passed below ≈70% opacity. Regressions need it (Schotter 2014).
- **Rendering** [I/D]: move one absolutely positioned element per guide with `transform` in a `requestAnimationFrame` loop, using `performance.now()` against the precomputed schedule. Don't restyle spans per word, and don't animate layout.

### 3.2 Per-technique parameters

| Technique | Motion | Style | Context | Default wpm (range) | Notes |
| --- | --- | --- | --- | --- | --- |
| **Phrase hop** | Discrete hops per phrase chunk (the Phrases chunk rule: leading function words + one content word, ≤16 chars). Hop = 120 ms cross-fade. | Background tint (accent at ≈18% alpha), radius 4 px, padded ±2 px | All text at full ink | **300** (220–500) | Chunks of ≈12–15 chars mean ≈2.5–3 hops per line, close to the 7–9-letter mean saccade (PSPI). This is in-place S-PTP. |
| **Pen sweep** | Continuous: `x = left_i + f × width_i`, linear inside each word. Speed follows weights, so the pen dwells on long words and stops at punctuation. | 2–3 px bar, ≈2.5 em long, 3 px below the baseline, accent colour, centred on x. A "pen tip", not a growing underline. | Full ink | **280** (180–600) | Optional **inset** (Ferriss): 0 or 1 word. With 1, the pen skips the first and last word of each line in *space*, but they keep their *time* inside the adjacent words. Don't offer 2+: with 6 words a line, almost nothing would be left. |
| **Sentence spotlight** | Advances one sentence at a time, after the sentence's summed duration + pause. Long sentences (>2 lines) also get a faint pen sweep inside. | Current sentence 100%, others ≈35% opacity (Vatány used 30%) | Previous sentence ≈60% | **260** (180–400) | The best-liked unit in Vatány. It is also the iOS TTS convention. |
| **Line focus** | Window advances one line at a time, with a 150 ms ease-out slide, after the line's summed duration + return pause | Window of **3 lines** (current in the middle) at 100%, others ≈30–35% | The line above is in the window | **260** (180–400) | Also allow manual mode (tap or volume key to step). Line-level was the *divisive* unit in Vatány, so it is a lab candidate rather than a default. |
| **Auto-scroll** | Continuous per-pixel scroll at `v = lineHeight × (wpm / wordsPerLine) / 60` px/s, with `wordsPerLine` measured per chapter. Smooth v with a low-pass over the next ≈2 lines of weights, so it slows into dense text, but never stop-start at punctuation (only sentence ends with pause > 400 ms ease to a 30% speed). | A thin reading line at ≈40% of viewport height, with optional 2-line soft fade top and bottom | Full ink | **240** (150–400) | Kang & Muter: smooth beats stepped. Yamashita: a central reading line beats a bottom line. Drag to nudge, and lift to resume. |
| **Fixation hops** | 3 marks per line at ≈1/6, 1/2 and 5/6 of the line (≈12 chars apart). Hop timing = the summed duration of the words each mark covers. | 4 px dot above the x-height, 40% ink, with the active one at 100% | Full ink | **320** (250–600) | Training mode. 2 marks per line would mean ≈18-char jumps, past the 14–15-char right span (PSPI), so it is skimming. Mark it so. |

**Sweep vs hop** [D from R]: the eye can't read static text by smooth pursuit. It reads by saccades whatever the guide does (PSPI). So a smooth sweep works as a *pace-setter* the eye jumps along to, while a hop works as a *target*. Ship one of each (Pen sweep, Phrase hop) and let the lab decide. Smooth motion is still the right choice when the *text itself* moves (Kang & Muter).

**Defaults** [D]: average silent reading is 238 wpm for non-fiction and 260 for fiction ([Brysbaert 2019](https://doi.org/10.1016/j.jml.2019.104047)). Comprehension holds to ≈350 wpm in RSVP (speed-reading.md §4.1). Set each guide's default just above natural pace, so it pulls a little without forcing skimming. Show the same "effective wpm" readout as RSVP, computed from the real schedule.

## 4. Recommendation: the lab

Ordered by how promising each one is for comfortable, sustained, faster-than-unaided reading:

1. **Phrase hop** — *"Your eyes hop phrase to phrase on the real page."* It combines the best-supported RSVP finding (phrase chunks + punctuation pauses) with the page's ability to look back. It reuses the Phrases chunker and timing.
2. **Pen sweep** — *"A pen under the line, the classic speed-reading pacer, slowing for long words and stopping at full stops."* It's the most recognisable technique, with an optional one-word inset (Ferriss) as a stretch drill.
3. **Sentence spotlight** — *"One sentence lit at a time."* Meaning-unit highlighting was the best-liked in the only controlled comparison (Vatány 2026), and it's the calmest mode for dense books.
4. **Auto-scroll** — *"The page drifts past a reading line; you just keep up."* Smooth scrolling was preferred to RSVP and matched it on comprehension (Kang & Muter 1989), and it is hands-free.
5. **Line focus** — *"Three lines in focus, the rest of the page fades."* It is cheap, familiar from Immersive Reader, and doubles as a manual-step accessibility mode. The evidence on speed is weak.
6. **Fixation hops** — *"Three landing points per line: train fewer, longer jumps."* This is a drill, not a reading mode. Label it as such.

**Not in the lab** [R]: Bionic Reading (three null or negative studies), BeeLine gradients (negative or mixed in the only independent study, plus it's a static overlay, not a guide; at most an optional toggle on top of Pen sweep), and narrower columns (the phone already gives ≈36 cpl).

**What's in the app (Settings → Guided reading).** The lab ships a little wider than this list, so the
owner can feel the differences before cutting down. All guides share the reader's clock: Flow, Phrases or
Calm timing, punctuation pauses, and a line-return hold of max(0.35 × word slot, 120 ms) at the start of
each line (§3.1).

| In the app | From this brief |
| --- | --- |
| Highlight | Phrase hop (word by word with Flow and Calm, phrase by phrase with Phrases) |
| Pacer | Pen sweep, without the inset option for now |
| Hops | Fixation hops, drawn as two or three tinted spans per line instead of dots |
| Sentence | Sentence spotlight (others at 32%) |
| Line focus | Line focus, three-line window |
| Cover | The Evelyn Wood "card" that hides what you've read. Breaks finding 2 (no looking back) on purpose, as a control |
| Scroll | Auto-scroll past a fixed reading line, moving with the pacer rather than at a smoothed rate |
| Colour gradient, Bold word starts | BeeLine and Bionic Reading, as toggles on top of any guide, as controls |

**What to log for the cut** [D]: the settled wpm per mode, minutes per session before the reader pauses or quits, taps on "back" or on earlier words (a regression proxy, Schotter 2014), and a one-tap "felt easy / felt rushed" rating after each chapter. Expect differences in comfort, not in comprehension (Vatány 2026).

---

## Sources

Research
- Rayner, Schotter, Masson, Potter & Treiman (2016). So much to read, so little time. *PSPI* 17(1):4–34. https://doi.org/10.1177/1529100615623267
- Schotter, Tran & Rayner (2014). Don't believe what you read (only once). *Psych. Science* 25(6). https://doi.org/10.1177/0956797614531148
- Vatány, Nguyen, Illés & Bessemans (2026). Evaluating interactive highlighting techniques in digital reading. *Visible Language* 60(1):58–83. https://doi.org/10.34314/8j37se94
- Snell (2024). No, Bionic Reading does not work. *Acta Psychologica* 247:104304. https://doi.org/10.1016/j.actpsy.2024.104304
- Parker, Lee, Wang & Joseph (2026). Does the selective bolding of characters within words…? *Royal Society Open Science* 13(9). https://doi.org/10.1098/rsos.250177
- Koornneef & Kraal (2022). Does BeeLine Reader's gradient-coloured font improve the readability of digital texts for beginning readers? *CHB Reports* 6:100197. https://doi.org/10.1016/j.chbr.2022.100197
- Kang & Muter (1989). Reading dynamically displayed text. *Behaviour & IT* 8(1):33–42. https://doi.org/10.1080/01449298908914536
- Yamashita & Morita (2023). Vertical gaze position when reading text scrolling vertically at a comfortable speed. *VISION* 35(3):87–97. https://www.jstage.jst.go.jp/article/vision/35/3/35_87/_article/-char/en
- Jandreau & Bever (1992). Phrase-spaced formats improve comprehension in average readers. *J. Applied Psych.* 77(2):143–146. https://psycnet.apa.org/doi/10.1037/0021-9010.77.2.143
- LeVasseur, Macaruso, Palumbo & Shankweiler (2006). Syntactically cued text facilitates oral reading fluency in developing readers. *Applied Psycholinguistics* 27(3). https://www.cambridge.org/core/journals/applied-psycholinguistics/article/syntactically-cued-text-facilitates-oral-reading-fluency-in-developing-readers/49D41A8EF948352C852B647237540E57
- Walker, Schloss, Fletcher, Vogel & Walker (2005). Visual-syntactic text formatting. *Reading Online* 8(6). https://experts.umn.edu/en/publications/visual-syntactic-text-formatting-a-new-method-to-enhance-online-r/
- Schneps et al. (2013). Shorter lines facilitate reading in those who struggle. *PLoS ONE* 8(8). https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3734020/ · E-readers are more effective than paper for some with dyslexia. *PLoS ONE* 8(9). https://doaj.org/article/f5229dc27a5a47a881e605bef86ca805
- Dyson & Haselgrove (2001). The influence of reading speed and line length on the effectiveness of reading from screen. *IJHCS* 54:585–612. https://doi.org/10.1006/ijhc.2001.0458
- Parker, Slattery & Kirkby (2020). Undersweep-fixations during reading in adults and children. *JECP* 192:104788. https://eprints.bournemouth.ac.uk/33155/
- Ginns & King (2021). Pointing and tracing enhance computer-based learning. *ETR&D* 69(3):1387–1403. https://doi.org/10.1007/s11423-021-09997-0
- Text-to-speech highlighting in aphasia (2021). https://pmc.ncbi.nlm.nih.gov/articles/PMC7959096 · CAST read-aloud research summary: https://cisl.cast.org/research/read-aloud
- Low-vision line guide with stand magnifiers (QUT). https://eprints.qut.edu.au/19629
- Brysbaert (2019). How many words do we read per minute? *JML* 109:104047. https://doi.org/10.1016/j.jml.2019.104047
- Benedetto et al. (2015). RSVP in reading: the case of Spritz. *CHB* 45:352–358. https://doi.org/10.1016/j.chb.2014.12.043
- Rzayev, Woźniak, Dingler & Henze (2018). Reading on smart glasses. *CHI '18*. https://doi.org/10.1145/3173574.3173619
- Öquist (2006). *Evaluating Readability on Mobile Devices*. https://smartlib.umri.ac.id/assets/uploads/files/8572d-relev-res.pdf

Apps, docs, other
- Ferriss (2009), PX project: https://tim.blog/2009/07/30/speed-reading-and-accelerated-learning/
- Evelyn Wood / Reading Dynamics: https://www.britannica.com/topic/Reading-Dynamics · https://www.britannica.com/biography/Evelyn-Wood
- Outread: https://apps.apple.com/app/id778846279 · Spreeder app: https://apps.apple.com/us/app/-/id6748313372 · Pacer extension: https://chromewebstore.google.com/detail/pacer-speed-reading/jcofnjnjaijcgkcdklddpokkdmdnmckn
- Microsoft Immersive Reader line focus: https://support.microsoft.com/en-gb/topic/use-line-focus-in-immersive-reader-for-office-for-the-web-and-onenote-815d5ae2-9291-4d57-b6d5-780280da27c7
- Helperbird Focus Ruler: https://www.helperbird.com/features/focus-ruler/
- iOS Spoken Content highlighting: https://mcmw.abilitynet.org.uk/how-to-use-speak-selection-to-read-text-aloud-in-ios-18-on-your-iphone-or-ipad
- BeeLine Reader: https://apple.co/2pdOFPo · https://behavioralscientist.org/speed-reading-apps-open-research-questions/
- Bionic Reading settings: https://developer.bionic-reading.com/framework/Classes/BionicReadingSettings.html · Readwise test: https://blog.readwise.io/bionic-reading-results/
- Pacer patent US4457720 (background on controlled-reading devices): https://patents.justia.com/patent/4457720
