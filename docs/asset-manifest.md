# MONSI AI public asset manifest

## Phase 1 rule

Keep the current product screenshots in WebP and avoid recompressing them again unless a larger original is intentionally replaced. The existing files are already lightweight enough for the public product pages.

## Current repository assets

| Asset | Purpose | Current repo size |
|---|---|---:|
| `lifedash-icon.webp` | LifeDashPro icon | ~14 KB |
| `lifedash-dashboard.webp` | LifeDashPro hero/dashboard | ~10 KB |
| `lifedash-finance.webp` | LifeDashPro finance screenshot | ~8 KB |
| `lifedash-vehicles.webp` | LifeDashPro vehicles screenshot | ~9 KB |
| `balkanvibes-player-current.webp` | Balkan Vibes player screenshot | ~10 KB |
| `balkanvibes-browser-current.webp` | Balkan Vibes browser screenshot | ~12 KB |
| `monsi-mark.svg` | MONSI AI scalable brand mark | vector |
| `brand.css` | Final MONSI brand palette and typography layer | text |

## Delivery optimizations applied

- Existing screenshots stay WebP.
- Above-the-fold hero images use `fetchpriority="high"` where useful.
- Non-hero screenshots use `loading="lazy"`.
- Images use `decoding="async"`.
- The LifeDashPro icon declares intrinsic width/height to reduce layout shift.
- Screenshot containers reserve a stable phone-like aspect ratio in CSS.
- Descriptive alt text is supplied for product screenshots.
- Duplicate new raster copies were not introduced.

## Library artwork reviewed

The Library contains polished Balkan Vibes marketing PNGs titled `BalkanVibes Lite Radio App Banner.png` and `BalkanVibes Lite Radio Interface.png`. They are intentionally **not** placed on the public long-term Balkan Vibes page in Phase 1 because the visible artwork itself contains the word `LITE`.

The long-term public product name is `Balkan Vibes`. Those marketing compositions can be reused after creating equivalent artwork without the old Lite label.

The MONSI AI brand identity guide was reviewed and the Phase 1 website was aligned to its core palette and typography:

- Indigo `#1A1F5C`
- Purple `#6A38F5`
- Blue `#2563EB`
- Cyan `#00D4FF`
- Deep Navy `#0B1026`
- Headings: Space Grotesk
- Body: Inter

## Future asset organization

When final additional screenshots/icons are moved into the public repo, use these folders/names without changing public routes:

- `assets/lifedashpro/`
- `assets/balkanvibes/`
- `assets/monsi/`

The first Phase 1 pass intentionally keeps the existing root asset filenames so older pages and links cannot break during redesign review.
