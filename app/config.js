window.LIFEDASH_CONFIG = Object.freeze({
  supabaseUrl: 'https://djbxhyhqefylyqqlifan.supabase.co',
  // Public browser key only (publishable/anon). Never put service_role here.
  supabaseKey: 'sb_publishable_Wf4GdnVWLRlvYpQxGzqIag_jYbp05Uv',
  // /lifedashpro/ is the canonical public app URL; /app/ remains compatible for testing.
  basePath: location.pathname.startsWith('/lifedashpro/') ? '/lifedashpro/' : '/app/',
  maxAttachmentBytes: 10 * 1024 * 1024,
  version: '1.0.0-web-rc1'
});