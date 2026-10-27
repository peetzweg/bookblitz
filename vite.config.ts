import { execSync } from "node:child_process";
import { defineConfig, type Plugin } from "vite";
import pkg from "./package.json" with { type: "json" };

/** Short commit of the build, shown in Settings so you can tell which version a phone is running. */
const commit = (() => {
  // Vercel and Netlify builds may not have the .git directory; both expose the commit instead.
  const fromHost = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.COMMIT_REF;
  if (fromHost) return fromHost.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
})();
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/**
 * The deployed origin, for canonical and share links, which have to be absolute. Set SITE_URL to
 * override; otherwise it's the production domain Vercel or Netlify reports, or empty locally.
 */
const siteUrl = (
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.URL) ??
  ""
).replace(/\/$/, "");

/** Where the app is served from: "/" on Vercel, "/bookblitz/" on GitHub Pages (set by the workflow). */
const base = process.env.BASE_PATH ?? "/";

/** Fills %SITE_URL% in index.html, and writes robots.txt plus a sitemap when the origin is known. */
function seo(): Plugin {
  return {
    name: "bookblitz-seo",
    transformIndexHtml: {
      order: "pre",
      handler: (html) =>
        // Without an origin (local builds) a relative canonical says nothing, and Vite would try to bundle "/".
        (siteUrl ? html : html.replace(/\s*<link rel="canonical"[^>]*>/, "")).replaceAll("%SITE_URL%", siteUrl),
    },
    generateBundle() {
      const robots = ["User-agent: *", "Allow: /", ...(siteUrl ? [`Sitemap: ${siteUrl}/sitemap.xml`] : [])];
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robots.join("\n") + "\n" });
      if (!siteUrl) return;
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${siteUrl}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>
</urlset>
`,
      });
    },
  };
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT__: JSON.stringify(commit),
    __BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    seo(),
    VitePWA({
      // "prompt" so the app decides when to swap in a new version (see src/pwa.ts): only on a fresh
      // start, never in the middle of a session.
      registerType: "prompt",
      // Icons, iOS launch screens and their <link> tags are generated from pwa-assets.config.ts.
      pwaAssets: { config: true, overrideManifestIcons: true, includeHtmlHeadLinks: true, injectThemeColor: false },
      workbox: {
        // No webmanifest here: the plugin adds it itself, and a second entry with another revision makes
        // Workbox reject the whole precache list, which silently leaves the app without offline support.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,epub}"],
        // Launch screens are large and only read by iOS at install time.
        globIgnores: ["**/apple-splash-*", "**/og.*"],
      },
      manifest: {
        id: base,
        name: "bookblitz",
        short_name: "bookblitz",
        description: "Speed-read your own EPUBs, one word at a time. Local first: your books stay on your device.",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        categories: ["books", "education"],
        // Shown in Android's and desktop Chrome's richer install dialog.
        screenshots: [{ src: `${base}og.png`, sizes: "1200x630", type: "image/png", form_factor: "wide", label: "The bookblitz reader" }],
        shortcuts: [{ name: "Continue Reading", short_name: "Continue", url: `${base}?resume=1` }],
      },
    }),
  ],
});
