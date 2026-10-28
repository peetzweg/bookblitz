# RSVP speed reading: timing, chunking, ORP, and which flavours to ship

Research brief for bookblitz's reading engine (`src/reader/rsvp.ts`, `src/reader/timing.ts`).
Compiled 2026-10-27. Every claim has a link. Each one is tagged:

- **[R]** research-backed: a peer-reviewed study, a review, or an eye-movement model fitted to data.
- **[I]** implementation convention: what shipping or open-source readers do. No published evidence behind the specific number.
- **[D]** derived here: our own calculation or judgment from the above. Treat it as a starting value to tune.

---

## TL;DR

1. **Long words really are under-timed today.** [D] The current bonus starts at 9 letters and adds 0.07 per letter, so a 12-letter word gets ×1.28. The Spritz patent gives 8–13 letters ×1.3 and 14+ ×1.6. jetzt gives 12–13 letters ×2.0. Öquist's adaptive RSVP, which scales time with characters, gives about ×2.2 relative to a 5-letter word. Start the bonus at 6 letters and use +0.10 per letter.
2. **Sentence pauses are the best-supported timing rule.** [R] Without them, RSVP comprehension drops ([Masson 1983](https://doi.org/10.3758/BF03196973), summarised in [Rayner et al. 2016, PSPI](https://doi.org/10.1177/1529100615623267)). Make them longer for long sentences (the Spritz patent does) and give them a floor in milliseconds so they don't vanish at high speed.
3. **The ORP claim is mostly marketing.** [R] The optimal viewing position effect is real, but small. Pinning the word at a fixed point mainly helps by keeping the eye near that position. The current ORP table already matches the Spritz patent. Keep it.
4. **Chunking 2–3 words is reasonable, but the evidence is thin.** [R] It is roughly neutral for comprehension. Phrase-segmented chunks of about 12–15 characters do best. Function words should lean forward onto the next content word.
5. **Comprehension holds up to about 350 wpm** [R] in RSVP and falls off above that. RSVP roughly halves blink rate and raises workload. Back-to-sentence and a context view on pause are the right mitigations, and the app already has both.
6. **Ship three flavours: Flow (default), Phrases, Calm.** Parameters are in §5, in the shape of the existing `ReadingStyle` interface.

---

## 1. Per-word timing

### 1.1 What the research says

| Factor | Finding | Tag |
| --- | --- | --- |
| Overall model | Readers set their pace word by word, not in advance. Word identification is the main thing that decides when the eyes move ([Rayner et al. 2016, PSPI](https://doi.org/10.1177/1529100615623267), §"Models of eye movement control"). That is why fixed-rate RSVP feels wrong. | R |
| Word frequency | Frequency is "a ubiquitous and robust influence" on word recognition (PSPI §"Word recognition"). Its effect on reading time is roughly linear in log frequency. Predictability has a logarithmic effect over six orders of magnitude ([Smith & Levy 2013](https://doi.org/10.1016/j.cognition.2013.02.013)). | R |
| Frequency magnitude | E-Z Reader uses lexical stage L1 = α1 − α2·ln(freq) − α3·pred, with α1 = 104 ms, α2 = 3.5 ms, α3 = 39 ms, and L2 = 0.34·L1 ([Reichle et al. 2013, Table 2 and Eqs. 1–3](https://clok.uclan.ac.uk/22385/1/22385.pdf)). That works out to about **11 ms per log10 unit (one Zipf point)** of frequency. At 300 wpm (200 ms per word) that is about 5% of a word slot per Zipf point. | R → D |
| Word length | In E-Z Reader, lexical time is multiplied by **1.15^(mean letter distance from fixation)** ([Reichle et al. 2013, Eq. 2](https://clok.uclan.ac.uk/22385/1/22385.pdf)). With fixation at the ORP, a 12-letter word costs about ×1.34 and a 16-letter word about ×1.6, relative to a 5-letter word (computed in §1.3). This is a *lower bound* for RSVP: normal readers also preview the next word and refixate long words, and RSVP allows neither (PSPI §"Saccades", §"RSVP-based technologies"). | R → D |
| Text-level length | Reading rate scales inversely with mean word length. Expected wpm = 238 × 4.6 / mean word length. In letters per second, the effect of text difficulty on reading rate largely disappears ([Brysbaert 2019](https://doi.org/10.1016/j.jml.2019.104047), [PDF](https://www.gwern.net/doc/psychology/linguistics/2019-brysbaert.pdf)). Reading time is roughly proportional to letters. | R |
| Sentence and clause wrap-up | Extra integration happens at the ends of clauses and sentences (Just & Carpenter 1980; Warren et al. 2009, cited in PSPI). Most meaning is still built incrementally, so the brain does not wait for punctuation (PSPI, critique of Spritz's "The Science" page). | R |
| Pauses in RSVP | Masson (1983) inserted blank windows of 500 or 1000 ms at sentence boundaries. Performance improved with either duration ([Masson 1983](https://doi.org/10.3758/BF03196973), as summarised in [Öquist 2006, p. 18](https://smartlib.umri.ac.id/assets/uploads/files/8572d-relev-res.pdf) and PSPI p. 22). PSPI's two key caveats on RSVP are that removing sentence pauses hurts comprehension, and that speeding up beyond normal rates hurts comprehension. | R |
| Punctuation pauses and preference | Punctuation pauses improved preference for RSVP. A version with a completion meter, punctuation pauses, and pauses at clause boundaries was significantly preferred to plain RSVP ([Castelhano & Muter 2001](https://doi.org/10.1080/01449290110069400), abstract via [CogPrints](https://web-archive.southampton.ac.uk/cogprints.org/1934/index.html)). | R |
| Adaptive vs fixed timing | Content-adaptive RSVP, where time grows with characters, lowered NASA-TLX task load on long texts compared with fixed RSVP, with no loss in speed or comprehension. Context-adaptive RSVP added frequency weights of 0.6–1.2 and sentence-position scaling. It reduced frustration, but raised temporal demand, probably because "the variations in exposure time were too large" ([Öquist 2006, pp. 23–29](https://smartlib.umri.ac.id/assets/uploads/files/8572d-relev-res.pdf); [Öquist & Goldstein 2003](https://doi.org/10.1016/S0953-5438(03)00039-0)). **The lesson is to adapt, but not too much.** | R |

### 1.2 What implementations actually do

All values below are multiples of the base interval 60000/wpm unless marked as milliseconds. "Replace" means the value replaces the word's time. "Add" means it is added on top.

| Reader | Length | Short / frequent words | Clause `, ; :` | Sentence `. ! ?` | Paragraph | Other |
| --- | --- | --- | --- | --- | --- | --- |
| **Spritz patent** ([US8903174B2](https://patents.google.com/patent/US8903174B2/en), FIG. 6) | ≤7 letters ×1.0, 8–13 ×1.3, ≥14 ×1.6. Length excludes punctuation. Words over 13 letters are split into two hyphenated halves; "approximately two-thirds of the users preferred the hyphenated technique". | — | — | A blank element after the sentence: ×1.0 if the sentence has ≤7 words, ×2.2 if 8–22, ×3.3 if >22 | not specified | **Normalised:** time = multiplier × (ut / mean multiplier), so the average rate matches the set wpm. "9 feet" (number plus unit) is shown as one element. Optional speed ramp at start. In practice Spritz set to 250 wpm delivered about 225 wpm ([Benedetto et al. 2015](https://tsw.it/wp-content/uploads/Rapid-serial-visual-presentation-in-reading-The-case-of-Spritz-1.pdf), §2.3). |
| **OpenSpritz** ([spritz.js L107–138](https://github.com/Miserlou/OpenSpritz/blob/27db9046e2bb363a86de34f4ea1a6e829bc47133/spritz.js#L107-L138)) | Over 8 characters: shown 3× (×3.0) | — | Words containing `,` `:` `-` `(`: ×3.0 | Plus 3 blank frames (×4.0 total) | — | Crude: duplicates frames. [spray](https://github.com/chaimpeck/spray) copies this logic. |
| **squirt** ([squirt.js L168–190](https://github.com/cameron/squirt/blob/660bbc41bb299d49a0460598eaa532d09db29f95/squirt.js#L168-L190)) | Over 11 characters: ×1.5 | **Under 4 characters: ×1.2 (more time, not less)** | ×2 (replace) | ×3 (replace) | ×3.5 (replace) | No ramp; plays a "3 2 1" countdown first. "Mr./Mrs./Ms." are exempt from the sentence pause. Rewinding 10 s resumes with a sentence pause. Default 400 wpm. |
| **jetzt** ([exec.js L13–39](https://github.com/ds300/jetzt/blob/0f2fdfc1fa96a11745ca4838804505c607f30533/modules/exec.js#L13-L39), [config.js L53–63](https://github.com/ds300/jetzt/blob/0f2fdfc1fa96a11745ca4838804505c607f30533/modules/config.js#L53-L63)) | 6–7 ×1.2, 8–9 ×1.4, 10–11 ×1.8, 12–13 ×2.0. Words over 13 characters (or over 9 with a hyphen) are split into ⌈len/8⌉ parts ([parse.js L17–40](https://github.com/ds300/jetzt/blob/0f2fdfc1fa96a11745ca4838804505c607f30533/modules/parse.js#L17-L40)). | — | `end_clause` ×1.8 (replace) | `end_sentence` ×2.2, plus `start_sentence` ×1.3 on the next word | `end_paragraph` ×2.8, plus `start_paragraph` ×2.0 | Punctuation modifiers *replace* the length multiplier. "Previous sentence" goes back 5 words, then to the sentence start ([L152](https://github.com/ds300/jetzt/blob/0f2fdfc1fa96a11745ca4838804505c607f30533/modules/exec.js#L148-L158)). Default 400 wpm. |
| **speedread** (pasky, [L51–56, L126–144](https://github.com/pasky/speedread/blob/375214f3dcff0082770f26b3e503ac299a41c6d4/speedread#L51-L56)) | 0.9 + 0.04·√len | Optional `-m` mode joins adjacent words of ≤3 characters each (×1.2). The author notes "it did not work well for pasky so far". | ×2 (+len) | ×3 (+len) | — | First word gets at least 0.2 s "to focus". Default 250 wpm. |
| **Sprint Reader** ([engine.js](https://github.com/anthonynosek/sprint-reader-chrome/blob/84f69f854f5829d3f1bed31aab4c2ee7b1216aae/src/engine.js#L839-L960), [defaults](https://github.com/anthonynosek/sprint-reader-chrome/blob/84f69f854f5829d3f1bed31aab4c2ee7b1216aae/src/reader.js#L459-L473)) | "Word length" mode: time proportional to characters, normalised to the wpm. Words over 17 characters are hyphenated into segments of at least 6 characters. | "Word frequency" mode: duration linear in Shannon information (−log₂ p, from SUBTLEX-US), from **40 ms (most frequent) to 300 ms (rarest)**. This ignores wpm. | Blank of **250 ms** (absolute) | Blank of **450 ms** | Blank of **700 ms** | Pauses are absolute milliseconds and do not scale with wpm. Chunk size gives duration × words per slide. Can show the sentence when paused. Default 400 wpm. |
| **Spreeder** ([help](https://helpdesk.ereflect.com/portal/en/kb/articles/advanced-settings)) | "Speed variability: slows down for longer chunks and speeds up for shorter ones", keeping average wpm constant | — | Punctuation pauses, only at group size 1 | — | — | Values not published. |
| **SwiftRead** ([help](https://swiftread.helpscoutdocs.com/article/22-micro-pauses-controlling-how-swiftread-pauses-while-reading)) | "Pause slightly longer on long words or numbers" | — | Micro-pause | Micro-pause | Micro-pause | Closed source; values not published. Offers "words at a time" chunking. |
| **Reedy** ([store listing](https://chrome.google.com/webstore/detail/reedy/ihbdojmggkmjbhfflnchljfkgdhokffj)) | — | — | "Smart slow down at punctuation marks" | — | — | Closed source; no values. |
| **Öquist adaptive RSVP** ([2006, Eq. 1–3](https://smartlib.umri.ac.id/assets/uploads/files/8572d-relev-res.pdf)) | t = (nwords + nchars) / (davg · wpm/60), with davg = 7.8 for Swedish. Linear in characters plus 1 per word. | Context mode: × mean frequency weight (0.6–1.2, from log-normal frequency) | — | A blank, or a delay at the sentence boundary | — | Context mode: t3 = (t2 + t2·tanh(swrd/savg))/2, with savg = 11.5. Words late in a sentence get more time. |
| **bookblitz today** (`rsvp.ts`) | Over 8 letters: +0.07 per letter, capped at +0.7 | — | ×1.5 | ×2.2 | ×2.6 | Digits +0.3. Ramp over 5 words. |

Nothing found from Gwern on RSVP timing. He only hosts the Brysbaert 2019 PDF.

### 1.3 Length scaling compared (multiplier relative to a 5-letter word)

| Letters | E-Z Reader acuity term [R→D] | Spritz [I] | jetzt [I] | Öquist (n+1)/6 [R→D] | bookblitz now | **Proposed Flow** |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | 0.90 | 1.0 | 1.0 | 0.67 | 1.0 | **0.85** |
| 6 | 1.01 | 1.0 | 1.2 | 1.17 | 1.0 | **1.1** |
| 8 | 1.13 | 1.3 | 1.4 | 1.50 | 1.0 | **1.3** |
| 10 | 1.20 | 1.3 | 1.8 | 1.83 | 1.14 | **1.5** |
| 12 | 1.34 | 1.3 | 2.0 | 2.17 | 1.28 | **1.7** |
| 14 | 1.42 | 1.6 | 1.0 (bug) | 2.50 | 1.42 | **1.9** |
| 16 | 1.60 | 1.6 | 1.0 (bug) | 2.83 | 1.56 | **2.1** |

The E-Z Reader column uses the current ORP table: a mean of |i − orp| over the letters, then 1.15^d, normalised to 5 letters. Öquist's column is normalised to a 5-letter word using English davg ≈ 6 (mean 4.6–4.8 letters plus a space). The proposed curve, 1 + 0.1·(n − 5), sits between the eye-movement lower bound and Öquist's character-proportional upper bound. It matches Spritz at 8 letters and exceeds it for longer words. That fixes the "long words need more time" complaint.

### 1.4 Numbers, punctuation, paragraphs

- **Numbers.** [I] No reading study found on digit timing. Spritz keeps a number and its unit together ("9 feet"). Sprint Reader keeps decimals and thousands groups together. SwiftRead pauses longer on numbers. Count digits as letters for the length term, add +0.4, and keep `9 feet` / `3.5 kg` / `1,000` as one frame.
- **Clause vs sentence.** [R] Wrap-up exists at both, and is larger at sentence ends (PSPI). [I] Implementations put clause pauses at +0.5 to +1.0 word slots and sentence pauses at +1.2 to +3.
- **Sentence length.** [I] The Spritz patent explicitly grows the sentence pause with sentence length (×1.0 / 2.2 / 3.3 for ≤7 / 8–22 / >22 words). It states that "a longer pause between sentences is beneficial for comprehension of longer sentences". This fits wrap-up theory, but no published data supports it.
- **Absolute floors.** [R→D] Masson's sentence blanks were 500–1000 ms. Integration time doesn't shrink just because the word rate goes up. Sprint Reader uses absolute pauses for this reason [I]. Pure multipliers make the sentence pause 133 ms at 900 wpm. Use max(multiplier × base, floor).
- **Blank vs hold.** [R/I] Masson and Spritz insert a *blank* after the sentence. squirt and jetzt keep the word on screen. A blank marks the boundary unambiguously. It may also give the eye a natural moment to blink (see §4.2; that part is a hypothesis).
- **Sentence-initial words.** [I] jetzt slows the first word of a sentence (×1.3) and of a paragraph (×2.0). Öquist does the opposite: early words get *less* time, because new information comes late. The evidence conflicts, so don't add a sentence-start bonus. Re-ramp after pauses instead (§4.3).
- **Abbreviations.** [I] squirt exempts "Mr./Mrs./Ms." from the sentence pause. Worth doing for a short list (Mr, Mrs, Ms, Dr, St, vs, e.g, i.e, etc).

### 1.5 What this means for the current constants

- The length bonus is the weakest of every implementation surveyed, and it starts late (9+ letters). Words of 6–8 letters, about 17% of tokens in non-fiction (Mill, Darwin) and 6% in *Alice*, get nothing. This explains the complaint. [D]
- Sentence ×2.2 (that is, +1.2) and clause ×1.5 (+0.5) sit inside the range of implementations. They are fine as multipliers, but they have no floor at high speed. [D]
- `AVERAGE_WEIGHT = 1.22` is too high for today's rules. Measured mean weights are *Alice* 1.147, Mill's *On Liberty* 1.100, Darwin's *Origin* 1.111 (script in §5.5). Compute the estimate from the actual frames instead of a constant. [D]

---

## 2. Chunking (2–3 words per flash)

### 2.1 Evidence

| Study | What was compared | Result | Tag |
| --- | --- | --- | --- |
| [Cocklin, Ward, Chen & Juola 1984](https://doi.org/10.3758/BF03198304), *Mem. & Cog.* 12(5) | RSVP segment sizes; idea units vs arbitrary chunks, at about 300 wpm | Comprehension was best for segments of **about 12 character spaces** (2–3 words). Idea-unit (phrase) segmentation averaged 13 characters and improved comprehension "a little but not significantly" (per [Öquist 2006, p. 18](https://smartlib.umri.ac.id/assets/uploads/files/8572d-relev-res.pdf); full text not retrieved). | R |
| Juola, Ward & McNamara 1982 (via [Öquist 2006, p. 18](https://smartlib.umri.ac.id/assets/uploads/files/8572d-relev-res.pdf)) | RSVP windows of 5, 10, or 15 characters at about 300 wpm vs page | No significant comprehension differences | R |
| [Öquist 2006](https://smartlib.umri.ac.id/assets/uploads/files/8572d-relev-res.pdf), study 3 (12 subjects) | Page, Buffered, 25-character Chunked, and one-word RSVP, self-paced | Speed: Page 240 wpm, Chunked 202, Word 177. Comprehension not significantly different. One-word RSVP "reduce[d] eye movements significantly, but... decreased reading speed and increased task load". | R |
| Öquist 2006, study 5 (16 subjects) | Page vs one-word RSVP vs **Segmented PTP**: phrase-segmented chunks of at most 18 and about 15 characters on average, "function words... displayed in the same chunk as the content word" | Speed: Page 258, **S-PTP 254**, RSVP 184 wpm. Comprehension 90% in all three. S-PTP task load was about equal to Page. | R |
| [Chen & Chien 2007](https://ijdesign.org/index.php/IJDesign/article/view/36/8) (Chinese, dual task) | Character vs word vs line chunks | Word (0.84) and one-line (0.83) beat character-by-character (0.78). Word vs line made no difference. Comprehension on day 1 was lower (0.71) than on days 2–8 (0.83–0.85), which argues for practice. | R |
| speedread `-m` ([L202](https://github.com/pasky/speedread/blob/375214f3dcff0082770f26b3e503ac299a41c6d4/speedread#L202)) | Joins pairs of ≤3-letter words | Author: "did not work well" | I |

**Bottom line** [R]: chunking does not hurt comprehension. Phrase-aware chunks of about 12–15 characters are the best-supported form. Self-paced readers read faster with them (Öquist S-PTP was about 38% faster than one-word RSVP). The gain comes from fewer, more natural units, not from cramming more words in. Arbitrary 25-character chunks did not help. Function words are the natural glue: in normal reading, "the" is skipped 50% or more of the time and about 30% of saccades skip a word (PSPI p. 9).

### 2.2 How implementations group words

- **Spritz patent** [I]: normally one word. Two words for number plus unit. Words over 13 letters are split into two halves.
- **Sprint Reader / SwiftRead / Spreeder** [I]: N words per flash. Sprint Reader gives duration = base × words in the slide. Spreeder adjusts time by chunk length so average wpm stays constant.
- **Öquist S-PTP** [R]: hand-made phrase segmentation at clause and phrase boundaries, maximum 18 characters. Function words go with the content word that follows them.
- **bookblitz `buildFrames`**: greedy, up to `maxWords` words / `maxChars` characters. It stops at punctuation and hands *trailing* function words to the next frame. A simulation on *Alice* gives 2.0 words per frame (with `maxChars` 15), but it produces splits like `went straight | on like | a tunnel`. A "leading function words + one content word" rule (Öquist's description) gives `the Rabbit | actually | took | a watch | … | and looked | at it,` and `of the exertions | of the popular | party,`. That is about 1.6 words per frame, and it reads as phrases (simulation in §5.5). [D]

---

## 3. The ORP / fixation point

- **What's real** [R]: the *optimal viewing position* (OVP). Isolated words are recognised fastest when fixated between the beginning and the middle of the word ([O'Regan et al. 1984](https://doi.org/10.1037/0096-1523.10.2.250); [Brysbaert & Nazir 2005](https://doi.org/10.1111/j.1467-9817.2005.00266.x)). The Spritz patent quotes O'Regan: about **20 ms added per letter** of deviation from the OVP ([US8903174B2](https://patents.google.com/patent/US8903174B2/en)).
- **How much it matters** [R]: PSPI calls the OVP effect "small, on the order of only a few milliseconds", and even smaller in running text. "People are not incapable of recognizing words if they do not fixate the OVP". The benefit of Spritz-style alignment is that, compared with left-justified RSVP, the eye stays near the OVP ([Rayner et al. 2016](https://doi.org/10.1177/1529100615623267), pp. 15–16, 26). The ORP is not a special point where meaning starts. Spritz's "80% of time is spent moving the eyes" is wrong: saccades take about 10% of reading time (PSPI p. 26).
- **Where to put it** [R+I]: about 25–35% into the word.
  - The Spritz patent's Table I gives 1 letter → 1st, 2–5 → 2nd, 6–9 → 3rd, 10–13 → 4th, 14+ → 5th, which is an average ratio of 0.265. It was "empirically tested... with 20 subjects". The pixel method allows 0.20–0.45 of the word width.
  - OpenSpritz uses the same table. Sprint Reader uses 1 → 1st, 2–4 → 2nd, 5–9 → 3rd, 10+ → 4th. squirt is more central: ⌊n/2⌋ − 1.
  - **bookblitz's `orpIndex` already implements the Spritz table. Keep it.**
- **Long words** [R/I]: with fixation at letter 4–5, a 13+ letter word puts 9 or more letters to the right, beyond the roughly 7–8 letter span where words can be identified. The Spritz patent cites Rayner (1995): comprehension is lower above 13 characters. Hence their split at 13 letters (and jetzt's). This is a second reason to give long words more time, or to split them.
- **Multi-word frames** [D]: no study tested ORP placement for chunks. Place the pivot at about 40% of the frame's width. That is inside Spritz's 0.20–0.45 range and leaves more of the frame to the right, the direction the perceptual span favours (3–4 letters to the left of fixation, 14–15 to the right; PSPI p. 11).

---

## 4. Comprehension, fatigue, and what helps

### 4.1 Comprehension and realistic speeds

| Source | Finding | Tag |
| --- | --- | --- |
| [Brysbaert 2019](https://doi.org/10.1016/j.jml.2019.104047) (190 studies, 18,573 readers) | Silent reading: **238 wpm non-fiction (range 175–300), 260 wpm fiction (range 200–320)** | R |
| [Rayner et al. 2016, PSPI](https://doi.org/10.1177/1529100615623267) | RSVP matches normal reading when total time is equal. Sped up, "comprehension and memory suffered": detailed recall dropped as rates went from 200 to 400 to 600 wpm (Potter et al. 1980), and performance fell about 50% at higher rates (Juola et al. 1982). Doubling or tripling speed with good comprehension is "not supported". | R |
| [Di Nocera, Ricciardi & Juola 2018](https://doi.org/10.1504/IJHFE.2018.096118) (n = 209) | **No comprehension difference from normal reading at 250, 300, or 350 wpm. Significantly lower at 400 and 450.** | R |
| Ricciardi et al. 2020 ([abstract](https://inderscience.com/offers.php?id=109594)) | With Spritz, comprehension trouble appears above about 250 wpm even for short texts | R |
| [Acklin & Papesh 2017](https://doi.org/10.5406/amerjpsyc.130.2.0183) | 700 and 1000 wpm RSVP: worse comprehension than static text | R |
| [Schotter, Tran & Rayner 2014](https://doi.org/10.1177/0956797614531148) ([PDF](http://faculty.cas.usf.edu/eschotter/papers/Schotter_Tran_Rayner_2014_PsychSci.pdf)) | A trailing mask that makes regression impossible lowered comprehension (b = −0.92, p < .001). This was **not limited to ambiguous sentences**. 10–15% of normal saccades are regressions. | R |
| [Benedetto et al. 2015](https://doi.org/10.1016/j.chb.2014.12.043) ([PDF](https://tsw.it/wp-content/uploads/Rapid-serial-visual-presentation-in-reading-The-case-of-Spritz-1.pdf)), n = 60, 25 min, Spritz at 250 nominal (about 225 actual) | Literal comprehension **60% vs 72%** (traditional reading). Inferential 44% vs 48% (not significant). **Blinks 4.67 vs 8.5 per minute.** Raw-TLX workload **59 vs 46**. Overall speed with pauses 209 vs 200 wpm (not significant). | R |
| [Rzayev et al. 2018](https://doi.org/10.1145/3173574.3173619) (smart glasses) | RSVP gave higher comprehension than scrolling while *sitting*, lower while *walking* | R |

**Realistic bands for long-form reading** [D from R]: about 250–350 wpm nominal is comprehension-safe. 400+ is skimming. 600+ is gist only. Self-paced RSVP readers in studies chose about 180–260 wpm.

### 4.2 Fatigue

[R] RSVP roughly halves blink rate (Benedetto). Saccades normally trigger blinks, and sustained visual attention suppresses them. Fewer blinks is a marker of visual fatigue and dry eye. Workload is higher too (Benedetto; Öquist study 1 found higher NASA-TLX on long texts for fixed RSVP).
[D] Mitigations, none tested in RSVP:
- Blank or dimmed frames in sentence and paragraph pauses. These are natural moments to blink.
- Chapters as sessions (already in the plan).
- A gentle "take a breather" suggestion after about 15 minutes of continuous play.

### 4.3 What helps

| Feature | Evidence | Tag |
| --- | --- | --- |
| Pauses at sentence ends | Masson 1983; PSPI's main caveat | **R** |
| Pauses at punctuation and clauses, plus a completion meter | Castelhano & Muter 2001 (preference); Rahman & Muter 1999 via Öquist (completion meter) | **R** (preference) |
| Moderate adaptive timing (length) | Öquist content-adaptive: lower task load on long texts | **R** |
| Large adaptive swings | Öquist context-adaptive (0.6–1.2 frequency weights plus position): temporal demand went up | **R** (caution) |
| Going back | Regressions support comprehension (Schotter 2014). PSPI endorses a "go back" button but notes restart-the-sentence is crude. Muter et al. 1988 (via Öquist) found that permitting regressions slowed reading, and that regressions back to the sentence start were the most common kind. Eye-tracking auto-pause and backtrack on a smartwatch beat a touch UI ([Dingler et al. 2016](https://doi.org/10.1145/2971763.2971794)). | **R** |
| Context view | Sprint Reader shows the sentence when paused [I]. Öquist's Buffered RSVP (three lines of context) was not better [R]. A context view *on pause* is cheap and harmless. Constant context is not supported. | I / R |
| Ramp-up at start | Spritz patent (optional initial lower speed), squirt countdown, speedread's minimum 0.2 s on the first word. No study found. | **I** |
| Practice | Chen & Chien 2007: comprehension was lower on day 1 than on days 2–8 | **R** |

bookblitz already does the important ones: sentence and clause pauses, back by sentence, context with the current word highlighted when paused, a progress line, and a ramp.

---

## 5. Recommendation

### 5.1 Common rules (all flavours)

**Revised 2026-10-28** after reading on a phone: long and hyphenated words still flashed by too quickly.
The length cap was 1.2 (so everything from 17 letters up got the same ×2.2), and a hyphenated word was
timed as one word, though "well-to-do" is three (jetzt splits such words; Spritz hyphenates long ones,
§1.2). The cap is now 1.8 (2.2 for Calm), and each further part of a compound adds `perPart`. At 350 wpm:
"daisy-chain" 257 → 317 ms, "well-to-do" 223 → 343 ms, "self-consciousness" 377 → 437 ms. Even rhythm no
longer shortens long words, only short words, numbers and commas. The reader's clock also stopped
carrying the overshoot of one frame into the next as a fraction (a fraction of a long pause could be
most of a short word); it now carries at most 34 ms.

```
base         = 60000 / wpm                                   // ms
n            = letters + digits in the word (no punctuation)
wordWeight   = (n <= 3 ? shortWord : 1)
             + min(max(0, n - lengthFrom) * perLetter, maxLengthBonus)
             + (parts - 1) * perPart                         // parts of a hyphenated compound
             + (hasDigit ? digits : 0)
frameWeight  = Σ wordWeight over the frame (function words inside a multi-word frame use functionWord)
             , at least minFrameWeight
pause        = paragraph end  ? paragraphPause
             : sentence end   ? sentencePause * sentenceScale(wordsInSentence)
             : clause end     ? clausePause
             : 0
sentenceScale(w) = w <= 7 ? 0.67 : w <= 22 ? 1.0 : 1.45      // Spritz 1.0/2.2/3.3, flattened [I→D]
displayMs    = frameWeight * base * ramp
pauseMs      = max(pause * base, pauseFloorMs[kind]) * ramp  // show blank or dimmed during pauseMs
```

- Sentence end means `. ! ? …` after trailing closers, excluding a small abbreviation list. Clause means `, ; : — –`. The paragraph pause replaces the sentence pause; it does not stack.
- **Ramp** (keep the current shape, `1 + 0.8 × remaining/rampFrames`, which starts at about 56% speed): [I] re-ramp with half the frames after a pause longer than 1.5 s, and after any back or forward jump.
- **Speed label** [D]: keep wpm as the pace for a plain 4–5-letter word, so the slider feels predictable. Compute "time left" from real frame weights per chapter instead of `AVERAGE_WEIGHT`. (The alternative is Spritz/Spreeder-style normalisation, dividing weights by the chapter's mean so "300 wpm" means 300 words a minute. That is honest, but short words then flash faster than the user expects.)
- **Back** [R/I]: back goes to the start of the current sentence. If you are fewer than 3 words in, it goes to the previous sentence (jetzt-style). Re-ramp afterwards.
- **Long-word split** (optional, phase 2) [I]: words of 14 or more letters are split into hyphenated parts of at least 6 letters (Spritz, jetzt). Each part is timed by its own length. Skip this if hyphenation quality is poor for the book's language. The length bonus already covers these words.

### 5.2 The three flavours, as `ReadingStyle` values

| Field | **Flow** (default) | **Phrases** | **Calm** |
| --- | --- | --- | --- |
| tagline | One word at a time; long words and sentence ends get the time they need | Short words ride with the next word, so you read in phrases | Slower, with generous pauses, for dense or unfamiliar text |
| default wpm (range) | **300** (200–500) | **340** (250–600) | **260** (150–350) |
| maxWords / maxChars | 1 / 40 | 3 / 16 | 1 / 40 |
| chunk rule | — | leading function words + **one** content word; never cross `, ; : . ! ?` or a paragraph end; number + next word ("9 feet") if ≤ maxChars | — |
| shortWord (≤3 letters) | 0.85 | 0.85 alone; **functionWord 0.5** inside a phrase | 1.0 |
| lengthFrom / perLetter / maxLengthBonus | **5 / 0.10 / 1.8** | 5 / 0.10 / 1.8 | **4 / 0.12 / 2.2** |
| perPart (each further part of a hyphenated word) | 0.35 | 0.35 | 0.45 |
| digits | 0.4 | 0.4 | 0.6 |
| minFrameWeight | — | 1.0 | — |
| clausePause / sentencePause / paragraphPause (added, × base) | **0.6 / 1.5 / 2.5** | 0.6 / 1.5 / 2.5 | **1.0 / 2.2 / 3.5** |
| sentenceScale | yes | yes | yes |
| pauseFloorMs clause / sentence / paragraph | 90 / 250 / 450 | 90 / 250 / 450 | 150 / 400 / 700 |
| pivot | `orpIndex` table | `orpIndex` for single words; letter nearest **0.4 × frame length** for multi-word frames | `orpIndex` table |
| rampFrames | 6 | 4 | 8 |
| rare-word bonus (phase 2) | off | off | on: `+min(0.2, 0.055 × max(0, 4.5 − zipf))` for n ≥ 4 |
| measured mean weight per word (no floors) | 1.15–1.17 | 1.02–1.05 | 1.35–1.37 |
| **effective throughput at default wpm** | **≈ 260 wpm** | **≈ 330 wpm, at ≈ 1.5–1.6 words/frame** | **≈ 190 wpm** |

How the values were chosen:

- **Flow**: the length curve and its justification are in §1.3. The pauses fall inside the range of implementations and are a little more generous than today's (sentence +1.5 vs +1.2, paragraph +2.5 vs +1.6), backed by Masson's 500–1000 ms. Floors only bind above about 360 wpm. The default of 300 wpm sits in the middle of the band where comprehension is no worse than normal reading (Di Nocera 2018). Effective throughput of about 260 wpm matches average fiction reading.
- **Phrases**: the chunk rule follows Öquist's S-PTP segmentation. Frames stay at or under 16 characters, in line with Cocklin's 12–15 and S-PTP's maximum of 18. Function-word weight 0.5 reflects how often they are skipped in normal reading. The default wpm is higher because the S-PTP self-paced speed was about 38% above one-word RSVP at equal comprehension. Simulated per-word cost is 1.02–1.05, at 1.5–1.6 words per frame.
- **Calm**: for non-fiction, second-language reading, or tired eyes. Pauses roughly match squirt's and Sprint Reader's, and the floors sit in Masson's range. The rare-word bonus is derived from E-Z Reader (about 11 ms per Zipf point, ≈ 0.055 of a 200 ms slot), capped at +0.2 to avoid Öquist's "variations too large" problem. It needs a frequency list, such as SUBTLEX-US Zipf values (Sprint Reader bundles a SUBTLEX-US list). Keep it to about 30k entries, rounded to 0.5 Zipf, applied only to words of 4+ letters, with unknown words treated as Zipf 2.5.

### 5.3 Omakase: **Flow**

1. **The user's complaint is about word timing, and Flow fixes it directly** with the strongest-supported changes: a length curve between the eye-movement and Öquist bounds, and sentence pauses that scale and have floors.
2. **It is the most robust across languages.** EPUBs can be in any language. Phrases depends on an English function-word list (its fallback is "≤2 letters"), and automatic phrase quality has not been validated. S-PTP was segmented by hand.
3. **It fits the app's identity**: one pinned word and a display that never moves. Chunk widths vary from frame to frame.
4. **Phrases' evidence is promising but small** (one 16-person study for S-PTP, and Cocklin's gain was not significant). Offer it as the "faster" option, not the default. Calm covers dense books.

### 5.4 Next steps / open questions

- Add `pauseFloorMs`, `sentenceScale`, `functionWord`, `minFrameWeight` and `pivotRatio` to `ReadingStyle`. Switch Phrases to the leading-function-word rule. Replace `AVERAGE_WEIGHT` with the measured frame-weight sums.
- A/B test inside the app: let users self-select wpm under each flavour and log the settled wpm and how often they press "back". More back presses than usual are a sign of comprehension trouble (Schotter 2014).
- Not settled by research: the exact sentence-length scaling, ramp shape and length, numbers, start-of-sentence timing, and whether blank or held pauses are better.

### 5.5 Reproducing the calibration numbers

The mean weights were computed with the throwaway Python scripts used for this brief. They reimplement the current `wordWeight` and the proposed flavours over the bundled `public/samples/alice-in-wonderland.epub` (26,504 words, mean 4.06 letters) and Project Gutenberg plain texts of Mill's *On Liberty* (#34901; 52k words, mean 4.74 letters, 17% of words ≥8 letters) and Darwin's *Origin* (#1228; 155k words, mean 4.84 letters). Mean sentence length was 15.8 words for *Alice* and 30–36 for Mill and Darwin. Recompute on real library books before you set `AVERAGE_WEIGHT`-style constants.

---

## Sources

Research
- Rayner, Schotter, Masson, Potter & Treiman (2016). So much to read, so little time. *PSPI* 17(1):4–34. https://doi.org/10.1177/1529100615623267 · [PDF](http://faculty.cas.usf.edu/eschotter/papers/Rayner_Schotter_Masson_Potter_Treiman_2016_PSPI.pdf)
- Schotter, Tran & Rayner (2014). Don't believe what you read (only once). *Psych. Science* 25(6):1218–1226. https://doi.org/10.1177/0956797614531148 · [PDF](http://faculty.cas.usf.edu/eschotter/papers/Schotter_Tran_Rayner_2014_PsychSci.pdf)
- Benedetto et al. (2015). RSVP in reading: the case of Spritz. *Computers in Human Behavior* 45:352–358. https://doi.org/10.1016/j.chb.2014.12.043 · [PDF](https://tsw.it/wp-content/uploads/Rapid-serial-visual-presentation-in-reading-The-case-of-Spritz-1.pdf)
- Di Nocera, Ricciardi & Juola (2018). RSVP: degradation of inferential reading comprehension as a function of speed. *IJHFE* 5(4):293–303. https://doi.org/10.1504/IJHFE.2018.096118
- Ricciardi et al. (2020). Speed reading using Spritz has a cost. *IJHFE* (abstract). https://inderscience.com/offers.php?id=109594
- Acklin & Papesh (2017). Modern speed-reading apps do not foster reading comprehension. *Am. J. Psych.* 130(2):183–199. https://doi.org/10.5406/amerjpsyc.130.2.0183
- Masson (1983). Conceptual processing of text during skimming and rapid sequential reading. *Mem. & Cog.* 11:262–274. https://doi.org/10.3758/BF03196973
- Cocklin, Ward, Chen & Juola (1984). Factors influencing readability of rapidly presented text segments. *Mem. & Cog.* 12(5):431–442. https://doi.org/10.3758/BF03198304
- Castelhano & Muter (2001). Optimizing the reading of electronic text using RSVP. *Behaviour & IT* 20(4):237–247. https://doi.org/10.1080/01449290110069400
- Öquist & Goldstein (2003). Towards an improved readability on mobile devices: evaluating adaptive RSVP. *Interacting with Computers* 15(4):539–558. https://doi.org/10.1016/S0953-5438(03)00039-0
- Öquist (2006). *Evaluating Readability on Mobile Devices*. PhD thesis, Uppsala. Mirror: https://smartlib.umri.ac.id/assets/uploads/files/8572d-relev-res.pdf (third-party host; equations on pp. 24–25)
- Chen & Chien (2007). Effects of RSVP display design on visual performance in dual tasks with small screens. *IJDesign*. https://ijdesign.org/index.php/IJDesign/article/view/36/8
- Brysbaert (2019). How many words do we read per minute? *JML* 109:104047. https://doi.org/10.1016/j.jml.2019.104047 · [PDF](https://www.gwern.net/doc/psychology/linguistics/2019-brysbaert.pdf)
- O'Regan, Lévy-Schoen, Pynte & Brugaillère (1984). Convenient fixation location within isolated words. *JEP:HPP* 10(2):250–257. https://doi.org/10.1037/0096-1523.10.2.250
- Brysbaert & Nazir (2005). Visual constraints in written word recognition: the OVP effect. *J. Research in Reading* 28(3):216–228. https://doi.org/10.1111/j.1467-9817.2005.00266.x
- Reichle et al. (2013). Using E-Z Reader to examine the concurrent development of eye-movement control and reading skill. *Dev. Review* 33:110–149. https://doi.org/10.1016/j.dr.2013.03.001 · [PDF](https://clok.uclan.ac.uk/22385/1/22385.pdf)
- Smith & Levy (2013). The effect of word predictability on reading time is logarithmic. *Cognition* 128:302–319. https://doi.org/10.1016/j.cognition.2013.02.013
- Dingler, Rzayev, Schwind & Henze (2016). RSVP on the go. *ISWC '16*. https://doi.org/10.1145/2971763.2971794
- Rzayev, Woźniak, Dingler & Henze (2018). Reading on smart glasses. *CHI '18*. https://doi.org/10.1145/3173574.3173619

Patents, docs, code
- Spritz: US 8,903,174 B2, Serial text display for optimal recognition apparatus and method. https://patents.google.com/patent/US8903174B2/en
- OpenSpritz `spritz.js`: https://github.com/Miserlou/OpenSpritz/blob/27db9046e2bb363a86de34f4ea1a6e829bc47133/spritz.js
- squirt `squirt.js`: https://github.com/cameron/squirt/blob/660bbc41bb299d49a0460598eaa532d09db29f95/squirt.js#L168-L190
- jetzt: https://github.com/ds300/jetzt/tree/0f2fdfc1fa96a11745ca4838804505c607f30533/modules
- speedread: https://github.com/pasky/speedread/blob/375214f3dcff0082770f26b3e503ac299a41c6d4/speedread
- Sprint Reader: https://github.com/anthonynosek/sprint-reader-chrome/tree/84f69f854f5829d3f1bed31aab4c2ee7b1216aae/src
- spray: https://github.com/chaimpeck/spray
- Spreeder advanced settings: https://helpdesk.ereflect.com/portal/en/kb/articles/advanced-settings
- SwiftRead micro-pauses: https://swiftread.helpscoutdocs.com/article/22-micro-pauses-controlling-how-swiftread-pauses-while-reading
- Reedy (Chrome Web Store): https://chrome.google.com/webstore/detail/reedy/ihbdojmggkmjbhfflnchljfkgdhokffj
