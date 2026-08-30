# MONSI AI — Web design system

## Brand direction

MONSI AI should feel practical, modern and product-focused rather than like a generic agency template. The public website uses the final brand identity from the MONSI AI brand guide while keeping the product showcase readable on dark backgrounds.

## Logo

Primary web mark: the MONSI ribbon-style `M` with the cyan accent dot, paired with the `MONSI AI` wordmark and the tagline `Smart tools for everyday life`.

The scalable browser mark is stored as `assets/monsi-mark.svg`.

## Typography

The final brand guide defines:

- Headings: **Space Grotesk**
- Body/UI: **Inter**

Public product pages load those fonts through `assets/brand.css`, with system fallbacks if the remote font service is unavailable.

### Type scale

- Hero display: `clamp(46px, 7vw, 82px)`
- Product display: `clamp(44px, 6vw, 72px)`
- Section heading: `clamp(30px, 4.5vw, 48px)`
- Body lead: `18–22px`
- Standard body: `14–16px`
- Metadata / labels: `11–13px`

## Core brand colors

From the final identity guide:

- Indigo: `#1A1F5C`
- Purple: `#6A38F5`
- Blue: `#2563EB`
- Cyan: `#00D4FF`
- Deep Navy: `#0B1026`
- Light Gray: `#F2F4F8`
- White: `#FFFFFF`

Supporting UI colors may be used for status states, but the main marketing identity stays inside this palette.

## Radius

- Small controls: `12px`
- Buttons: `14px`
- Cards: `20–26px`
- Product/device frames: `28–32px`
- Pills: `999px`

## Spacing

Base rhythm is 4px.

Common values: `8, 12, 16, 20, 24, 32, 40, 56, 72, 88px`.

Desktop content width: maximum `1180px` with responsive side gutters.

## Responsive breakpoints

- Desktop: `> 980px`
- Tablet: `681–980px`
- Mobile: `<= 680px`

Navigation collapses non-essential links on tablet/mobile while retaining the main contact/action control.

## Components

Shared structural components are defined in `assets/styles.css`, while final MONSI brand overrides live in `assets/brand.css`:

- sticky navigation
- brand lockup
- eyebrow / badge
- hero and product hero
- buttons
- product cards
- feature grid
- screenshot/device gallery
- statistics strip
- trust/legal links
- footer
- legal/support content cards

## Image rules

- Existing product screenshots are WebP and are not recompressed unnecessarily.
- Product imagery uses `loading="lazy"` outside the first viewport and `decoding="async"` where appropriate.
- Hero imagery may use `fetchpriority="high"`.
- CSS reserves stable aspect ratios to reduce layout shift.
- Every image gets descriptive alt text.
- Marketing artwork that still contains the old `Lite` label is not used on the long-term Balkan Vibes product page until the visible artwork is updated.
