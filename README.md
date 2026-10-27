<img src="assets/icon.svg" width="64" height="64" alt="">

# bookblitz

Speed-read your own EPUBs, one word at a time. Local first: books are parsed in the browser and kept in
IndexedDB, and nothing is uploaded. Laid out like Apple Music, with a library, album-style book pages and a Now
Reading sheet. See [PLAN.md](PLAN.md).

```sh
pnpm install
pnpm dev      # http://localhost:5173, also on your LAN for testing on a phone
pnpm build    # static site in dist/
```

The share card and video (`public/og.png`, `public/og.mp4`) are rendered from `scripts/og/card.html`, reading the
sample passage with the app's own timing: `scripts/og/render.sh` (needs Chrome and ffmpeg). Canonical and share
links use the production domain Vercel or Netlify reports at build time; set `SITE_URL` to override.
