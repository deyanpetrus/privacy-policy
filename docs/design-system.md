# MONSI AI — Web design system

## Brand direction

MONSI AI should feel practical, modern and product-focused rather than like a generic agency template. The site uses a dark interface with cool blue/violet accents shared visually with LifeDashPro.

## Logo

Primary web mark: compact gradient `M` mark paired with the `MONSI AI` wordmark and the line `SMART TOOLS FOR EVERYDAY LIFE`.

The mark is provided as `assets/monsi-mark.svg` for scalable browser use. Product icons remain product-specific.

## Typography

Primary stack:

`Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

No external font request is required for rendering; Inter is used when available and the system stack is the fallback.

### Type scale

- Hero display: `clamp(46px, 7vw, 82px)`
- Product display: `clamp(44px, 6vw, 72px)`
- Section heading: `clamp(30px, 4.5vw, 48px)`
- Body lead: `18–22px`
- Standard body: `14–16px`
- Metadata / labels: `11–13px`

## Core colors

- Background: `#070B14`
- Elevated background: `#0B1220`
- Card: `#101A2D`
- Card elevated: `#142139`
- Primary text: `#F6F8FF`
- Muted text: `#A9B5C9`
- Border: `#263650`
- Brand blue: `#6FA8FF`
- Brand violet: `#8C78FF`
- Cyan accent: `#55D9FF`
- Positive: `#5ED7A3`
- Warning: `#FFD166`

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

Shared components are defined in `assets/styles.css`:

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
