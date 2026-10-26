-- =============================================================================
-- 20261008_member_iptv_lines.sql
-- Per-member Star IPTV line assignments (Private Pilot multi-line support)
-- =============================================================================
-- Extends the existing schema additively (no changes to existing tables).
-- Rows are written/read server-side via a service_role key when the owner
-- provisions one. RLS is ENABLED with NO policies => deny-all by default,
-- so the anon/publishable key can never read or modify line credentials.
-- The runtime pilot store remains authoritative; this table is the
-- durability-ready mirror (secrets stored only as AES-256-GCM ciphertext
-- produced by the backend when LINE_VAULT_KEY is configured).
-- =============================================================================

CREATE TABLE IF NOT EXISTS member_iptv_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_member_id TEXT UNIQUE NOT NULL,          -- in-memory pilot member id (usr-member-xxx)
  member_email TEXT,
  provider_name TEXT,
  server_url TEXT NOT NULL,
  username_encrypted TEXT,                       -- AES-256-GCM (v1.iv.tag.ciphertext) or NULL
  password_encrypted TEXT,                       -- AES-256-GCM or NULL (never plaintext)
  m3u_url_encrypted TEXT,                        -- AES-256-GCM or NULL
  epg_url_encrypted TEXT,                        -- AES-256-GCM or NULL
  expires_at TIMESTAMPTZ,                        -- probed from provider (player_api exp_date)
  max_connections INTEGER DEFAULT 1,             -- probed from provider
  status TEXT NOT NULL DEFAULT 'active',         -- 'active' | 'disabled'
  assigned_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE member_iptv_lines ENABLE ROW LEVEL SECURITY;

-- No policies are created intentionally: deny-all. Without a service_role key
-- the backend sync is best-effort and skips secrets (see
-- server/memberIptvLineManager.ts). Never add anon policies to this table.

COMMENT ON TABLE member_iptv_lines IS
  'Per-member Star IPTV line vault. RLS deny-all; secrets only as AES-256-GCM ciphertext; authoritative runtime copy lives in the server-side store.';
