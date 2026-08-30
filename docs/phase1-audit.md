# MONSI AI website — Phase 1 audit

Date: 2026-08-30

## Repository

- Repository: `deyanpetrus/privacy-policy`
- Production branch: `main`
- Safety backup: `backup-before-monsi-phase1-2026-08-30`
- Phase 1 working branch: `monsi-phase1-final-site`
- Custom domain remains controlled by the existing `CNAME` file.

## Existing routes retained

No existing public route is deleted in Phase 1.

- `/` — MONSI AI home
- `/lifedashpro/` — LifeDashPro product page
- `/lifedashpro/demo/` — private visual pilot; retained but removed from public promotion
- `/balkanvibes/` — Balkan Vibes product page
- `/beleskipro/` — Notes Pro page; retained
- `/privacy-policy/`
- `/terms/`
- `/support/`
- `/delete-account/`

## Current reusable assets

The repository already contains WebP assets for the public product pages:

- `assets/lifedash-icon.webp`
- `assets/lifedash-dashboard.webp`
- `assets/lifedash-finance.webp`
- `assets/lifedash-vehicles.webp`
- `assets/balkanvibes-player-current.webp`
- `assets/balkanvibes-browser-current.webp`

These are retained and reused rather than duplicated.

## Product naming decision

The public product name is **Balkan Vibes**. The current lightweight Android release is treated as the first compact version of the broader Balkan Vibes product; the public website should not rename the long-term product to “Balkan Vibes Lite”.

## Phase 1 scope

1. Backup and audit
2. Final MONSI AI design system
3. Final home page
4. Final LifeDashPro product page
5. Final Balkan Vibes product page
6. Screenshot/icon/asset optimization at the web-delivery layer

## Safety / compatibility decisions

- No Android source code is changed.
- No Supabase schema or production account data is touched.
- No existing legal/support route is removed.
- The LifeDashPro web pilot remains available in the repository, but is not promoted publicly and is marked `noindex`.
- Existing WebP screenshots are kept to avoid quality loss from unnecessary recompression.
