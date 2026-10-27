import { defineConfig, minimal2023Preset as preset } from "@vite-pwa/assets-generator/config";

// Generate from a full-bleed square: iOS and Android apply their own icon mask.
export default defineConfig({
  preset: {
    ...preset,
    maskable: { ...preset.maskable, padding: 0 },
    apple: { ...preset.apple, padding: 0 },
  },
  images: ["public/icon.svg"],
});
