// LifeDashPro Web public configuration.
// IMPORTANT: only use a Supabase publishable key (sb_publishable_...) or legacy anon key.
// NEVER put service_role, sb_secret_..., database passwords, SMTP secrets, or signing secrets here.
window.LIFEDASH_CONFIG = {
  supabaseUrl: 'https://djbxhyhqefylyqqlifan.supabase.co',
  publishableKey: 'sb_publishable_Wf4GdnVWLRlvYpQxGzqIag_jYbp05Uv',
  basePath: location.pathname.startsWith('/lifedashpro/staging/') ? '/lifedashpro/staging/' : '/lifedashpro/',
  contractVersion: 'user_data + profiles (verified 2026-10-09)',
  captchaSiteKey: '', // Cloudflare Turnstile PUBLIC site key; enable corresponding SECRET in Supabase Auth first.
  webVersion: location.pathname.startsWith('/lifedashpro/staging/') ? '1.37.0-staging' : '1.37.0'
};
