#!/usr/bin/env bash
# Renders the share image and video into public/ (og.png, 1200×630, and og.mp4), plus the README demo
# docs/demo.gif. The video reads the sample passage
# read word by word with the app's own timing. Needs Google Chrome and ffmpeg.
# Run from the repo root: scripts/og/render.sh
set -euo pipefail

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
CARD="file://$PWD/scripts/og/card.html"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

shot() { # shot <out.png> <query>
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1200,630 --screenshot="$1" "$CARD?$2" 2>/dev/null
}

POSTER_PIVOT=$(npx -y tsx -e 'import { framePivot } from "./src/reader/rsvp"; console.log(framePivot("Wonderland"))')
shot public/og.png "w=Wonderland&p=$POSTER_PIVOT"

npx -y tsx scripts/og/frames.ts > "$WORK/frames.json"
COUNT=$(node -e 'console.log(require(process.argv[1]).length)' "$WORK/frames.json")
: > "$WORK/list.txt"
for ((i = 0; i < COUNT; i++)); do
  read -r TEXT PIVOT MS < <(node -e 'const f=require(process.argv[1])[process.argv[2]]; console.log(encodeURIComponent(f.text), f.pivot, f.ms)' "$WORK/frames.json" "$i")
  shot "$WORK/$i.png" "w=$TEXT&p=$PIVOT"
  # The last frame holds a beat longer before the video loops.
  ((i == COUNT - 1)) && MS=$((MS + 1200))
  printf "file '%s'\nduration %s\n" "$WORK/$i.png" "$(node -e "console.log($MS/1000)")" >> "$WORK/list.txt"
done
# The concat demuxer ignores the last entry's duration unless the file is listed once more.
printf "file '%s'\n" "$WORK/$((COUNT - 1)).png" >> "$WORK/list.txt"

ffmpeg -y -loglevel error -f concat -safe 0 -i "$WORK/list.txt" \
  -vf "fps=30,format=yuv420p" -c:v libx264 -preset slow -crf 24 -tune stillimage -movflags +faststart -an public/og.mp4
ls -la public/og.png public/og.mp4

# The README demo: just the reader, cropped from the video. GitHub plays GIFs inline, but not repo videos.
ffmpeg -y -loglevel error -i public/og.mp4 \
  -vf "crop=1200:250:0:140,scale=800:-1:flags=lanczos,fps=20,split[a][b];[a]palettegen=max_colors=32:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle" \
  -loop 0 docs/demo.gif
ls -la docs/demo.gif
