# LifeDashPro Web — production readiness

Date: 2026-08-30

## Deployment target

- Public site: `https://mkdigital.app/`
- Web app: `https://mkdigital.app/app/`
- Supabase project URL is configured in `app/config.js`.
- The publishable/anon client key is intentionally NOT committed.

## First browser setup

On first visit to `/app/`, enter the Supabase publishable/anon key in the local setup field. The value is stored only in that browser under `lifedash_supabase_key_override` and is used to initialize Supabase JS. Never enter a `service_role` key.

## Supabase Auth URL configuration

Keep the Android redirect:

- `lifedashpro://auth/callback`

Add the web redirect:

- `https://mkdigital.app/app/`

Registration and password reset both return to the `/app/` route.

## Responsive QA

The app shell provides explicit breakpoints for desktop, tablet, mobile and small-mobile layouts:

- desktop: full sidebar and multi-column dashboard
- <= 1050 px: reduced sidebar and two-column cards
- <= 760 px: mobile drawer, fixed top bar, five-item bottom navigation, single-column module content, responsive maps/tables/forms/radio dock
- <= 480 px: compact auth, quick actions and timeline/stat adjustments

The browser UI is built with overflow-safe tables, mobile form stacking, responsive route/air maps and a mobile audio dock.

## Security review

- no `service_role` key in browser source
- Supabase Auth persisted session with PKCE
- own-user data uses existing `user_data` RLS
- private attachments use `lifedash-attachments`, signed URLs and quota reservation RPCs
- family group membership uses existing RLS/RPC design
- Content Security Policy restricts script/connect/media/object sources
- app page is `noindex,nofollow` during the verification phase

## Post-deploy acceptance test

1. Open `/app/` and enter the local publishable/anon key.
2. Sign in with an existing LifeDashPro Android account.
3. Confirm Android notes/finance/documents/vehicles appear on Web.
4. Create a test Note on Web and confirm it appears on Android.
5. Create a Finance transaction on Android and confirm it appears on Web after refresh.
6. Test Register + email confirmation.
7. Test Forgot Password + new password callback.
8. Test private document attachment and signed open link.
9. Test Family create/join if the production RPCs are deployed.
10. Test route, nearby/live, aircraft and radio providers.
11. Test Install/PWA and notification permission on a supported browser.
12. Test desktop, tablet and phone widths before making the `/app/` link public in marketing navigation.
