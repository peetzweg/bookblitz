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

/** Fills %SITE_URL% in index.html, and writes robots.txt plus a sitemap when the origin is known. */
function seo(): Plugin {
  return {
    name: "bookblitz-seo",
    transformIndexHtml: { order: "pre", handler: (html) => html.replaceAll("%SITE_URL%", siteUrl) },
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
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT__: JSON.stringify(commit),
  },
  plugins: [
    react(),
    seo(),
    VitePWA({
      // Ask before swapping in a new version: a silent reload could land mid-chapter.
      registerType: "prompt",
      // Icons, iOS launch screens and their <link> tags are generated from pwa-assets.config.ts.
      pwaAssets: { config: true, overrideManifestIcons: true, includeHtmlHeadLinks: true, injectThemeColor: false },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest,epub}"],
        // Launch screens are large and only read by iOS at install time.
        globIgnores: ["**/apple-splash-*", "**/og.*"],
      },
      manifest: {
        id: "/",
        name: "bookblitz",
        short_name: "bookblitz",
        description: "Speed-read your own EPUBs, one word at a time. Local first: your books stay on your device.",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        categories: ["books", "education"],
        // Shown in Android's and desktop Chrome's richer install dialog.
        screenshots: [{ src: "/og.png", sizes: "1200x630", type: "image/png", form_factor: "wide", label: "The bookblitz reader" }],
        shortcuts: [{ name: "Continue Reading", short_name: "Continue", url: "/?resume=1" }],
      },
    }),
  ],
});
