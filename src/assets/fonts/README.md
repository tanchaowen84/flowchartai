# Pinned production fonts

Google Fonts started returning a font-file URL format that Next.js 15.2.6's downloader cannot parse (`google/loader.js:122`, extension regex returns null). The 2026-10-14 Plausible release therefore pins the exact 26 WOFF2 files already served by production commit `a352233`.

`pinned-fonts.css` preserves all 55 font-face declarations, weights, display settings, glyph ranges and fallback size metrics. The exported class names and CSS variables in `index.ts` match the original generated classes. Generic fallback families are appended to the four class rules. No font family or typography redesign is introduced, and no Google Fonts API request is needed at build time.

`pinned/manifest.json` records the deployed stylesheet, original public URLs, file sizes and SHA-256 hashes. All font files are under the SIL Open Font License; the four upstream license files are included in `pinned/`. CSS-relative URLs are emitted through the normal Next.js asset pipeline and retain content hashing.

When changing fonts, update the CSS, exports, provenance and licenses together; verify actual loaded font families and asset responses on production.
