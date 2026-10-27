import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

/** Short commit of the build, shown in Settings so you can tell which version a phone is running. */
const commit = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
})();
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT__: JSON.stringify(commit),
  },
  plugins: [
    react(),
    VitePWA({
      // Ask before swapping in a new version: a silent reload could land mid-chapter.
      registerType: "prompt",
      // Icons, iOS launch screens and their <link> tags are generated from pwa-assets.config.ts.
      pwaAssets: { config: true, overrideManifestIcons: true, includeHtmlHeadLinks: true, injectThemeColor: false },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest,epub}"],
        // Launch screens are large and only read by iOS at install time.
        globIgnores: ["**/apple-splash-*"],
      },
      manifest: {
        id: "/",
        name: "bookblitz",
        short_name: "bookblitz",
        description: "Speed-read your EPUBs, one word at a time.",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        categories: ["books", "education"],
        shortcuts: [{ name: "Continue Reading", short_name: "Continue", url: "/?resume=1" }],
      },
    }),
  ],
});
