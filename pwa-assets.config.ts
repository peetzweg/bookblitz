import {
  combinePresetAndAppleSplashScreens,
  defineConfig,
  minimal2023Preset as preset,
} from "@vite-pwa/assets-generator/config";

/** Behind the icon's rounded corners, so the platform's own icon mask never shows a sliver of another colour. */
const ICON_FILL = { background: "#2a8a5c", fit: "contain" } as const;

export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: combinePresetAndAppleSplashScreens(
    {
      ...preset,
      maskable: { ...preset.maskable, padding: 0, resizeOptions: ICON_FILL },
      apple: { ...preset.apple, padding: 0, resizeOptions: ICON_FILL },
    },
    {
      // Launch screens: the icon on the app's own background, light and dark.
      padding: 0.42,
      resizeOptions: { background: "#ffffff", fit: "contain" },
      darkResizeOptions: { background: "#000000", fit: "contain" },
      linkMediaOptions: { log: false, addMediaScreen: true, basePath: "/", xhtml: false },
    },
    [
      "iPhone 17 Pro Max",
      "iPhone 17 Pro",
      "iPhone Air",
      "iPhone 17",
      "iPhone 16 Pro Max",
      "iPhone 16 Pro",
      "iPhone 16 Plus",
      "iPhone 16",
      "iPhone 16e",
      "iPhone 15 Pro Max",
      "iPhone 15 Pro",
      "iPhone 14 Plus",
      "iPhone 13 mini",
      'iPhone SE 4.7"',
      'iPad Air 11"',
      'iPad Pro 11"',
      'iPad Pro 12.9"',
    ],
  ),
  images: ["public/favicon.svg"],
});
