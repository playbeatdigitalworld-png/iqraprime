-- ============================================================================
-- AETHER STREAM — POSTGRESQL & SUPABASE PRODUCTION SCHEMA & RLS POLICIES
-- Target: Private Pilot (3–5 Members) with Extensible OTT Architecture
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMS & DOMAINS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE user_role_type AS ENUM ('admin', 'member', 'guest');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE member_status_type AS ENUM ('active', 'disabled', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE device_type_enum AS ENUM ('desktop', 'mobile', 'tablet', 'smart_tv');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rights_status_enum AS ENUM (
    'RIGHTS_UNKNOWN',
    'LINK_ONLY',
    'EMBED_ALLOWED',
    'STREAMING_ALLOWED',
    'COMMERCIAL_STREAMING_ALLOWED',
    'PUBLIC_DOMAIN',
    'OPEN_LICENSE',
    'PUBLIC_BROADCAST',
    'FREE_TO_AIR',
    'LICENSED_BY_US'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE takedown_status_enum AS ENUM ('PENDING', 'UNDER_REVIEW', 'ACCEPTED_REMOVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. USER, PROFILES & PRIVATE MEMBERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role_type NOT NULL DEFAULT 'member',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users_profile_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  preferred_audio_lang TEXT DEFAULT 'en',
  preferred_subtitle_lang TEXT DEFAULT 'en',
  autoplay_next BOOLEAN DEFAULT TRUE,
  stream_quality_preference TEXT DEFAULT 'auto',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS private_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  status member_status_type NOT NULL DEFAULT 'active',
  max_devices INTEGER NOT NULL DEFAULT 2,
  account_expiry TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. DEVICES & SESSIONS (CONCURRENCY CONTROL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_type device_type_enum NOT NULL DEFAULT 'desktop',
  os TEXT,
  browser TEXT,
  ip_address TEXT,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. SUBSCRIPTIONS & COMMERCIAL PREPARATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  price_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  max_devices INTEGER NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  tier TEXT NOT NULL DEFAULT 'pilot_pass',
  status TEXT NOT NULL DEFAULT 'active',
  package_name TEXT NOT NULL DEFAULT 'Private Pilot Household Pass',
  activation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiry_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 year'),
  max_devices INTEGER NOT NULL DEFAULT 2,
  auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. STAR IPTV VAULT & RESELLER INTEGRATION (ADMIN ONLY)
-- ============================================================================

CREATE TABLE IF NOT EXISTS star_iptv_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL DEFAULT 'Star IPTV Authorized Reseller',
  server_url TEXT,
  username TEXT,
  password_encrypted TEXT,
  m3u_url_encrypted TEXT,
  epg_url_encrypted TEXT,
  api_url TEXT,
  api_key_encrypted TEXT,
  reseller_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_tested_at TIMESTAMPTZ,
  connection_status TEXT NOT NULL DEFAULT 'Ready for Configuration',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS star_iptv_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  credits_required NUMERIC(10, 2) NOT NULL,
  max_connections INTEGER NOT NULL DEFAULT 1,
  category TEXT DEFAULT 'Live TV + VOD',
  price_usd NUMERIC(10, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS star_iptv_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reseller_customer_id TEXT,
  username TEXT NOT NULL,
  password_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS star_iptv_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES star_iptv_customers(id) ON DELETE CASCADE,
  package_id UUID REFERENCES star_iptv_packages(id) ON DELETE SET NULL,
  line_id TEXT,
  expiry_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. CHANNELS, EPG & GROUPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS channel_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS channel_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'm3u_stream',
  base_url TEXT NOT NULL,
  attribution TEXT,
  rights_status rights_status_enum NOT NULL DEFAULT 'PUBLIC_BROADCAST',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_code TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  group_id UUID REFERENCES channel_groups(id) ON DELETE SET NULL,
  group_name TEXT DEFAULT 'General',
  country TEXT NOT NULL DEFAULT 'Global',
  language TEXT NOT NULL DEFAULT 'English',
  logo_url TEXT,
  stream_url TEXT NOT NULL,
  tvg_id TEXT,
  tvg_name TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  rights_status rights_status_enum NOT NULL DEFAULT 'PUBLIC_BROADCAST',
  source_id UUID REFERENCES channel_sources(id) ON DELETE SET NULL,
  source_name TEXT DEFAULT 'Authorized Stream',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  favorite_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS epg_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'XMLTV Provider EPG',
  url TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle',
  channel_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS epg_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  tvg_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. MOVIES, SERIES & CINEMA CATALOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS movie_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  license_name TEXT NOT NULL,
  license_url TEXT,
  rights_status rights_status_enum NOT NULL DEFAULT 'PUBLIC_DOMAIN',
  commercial_use BOOLEAN NOT NULL DEFAULT FALSE,
  redistribution_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  attribution_required BOOLEAN NOT NULL DEFAULT TRUE,
  verification_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  poster_url TEXT,
  backdrop_url TEXT,
  release_year INTEGER,
  duration TEXT,
  language TEXT DEFAULT 'English',
  rating TEXT DEFAULT 'NR',
  genres TEXT[] DEFAULT ARRAY['Classic'],
  video_url TEXT NOT NULL,
  trailer_url TEXT,
  license_name TEXT NOT NULL DEFAULT 'Public Domain (USA)',
  license_url TEXT,
  rights_status rights_status_enum NOT NULL DEFAULT 'PUBLIC_DOMAIN',
  attribution TEXT,
  source_id UUID REFERENCES movie_sources(id) ON DELETE SET NULL,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  trending BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  poster_url TEXT,
  backdrop_url TEXT,
  release_year INTEGER,
  rights_status rights_status_enum NOT NULL DEFAULT 'PUBLIC_DOMAIN',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  duration TEXT,
  video_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. WATCH HISTORY, WATCHLIST & FAVORITES
-- ============================================================================

CREATE TABLE IF NOT EXISTS watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'movie',
  title TEXT NOT NULL,
  poster_url TEXT,
  position_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  last_watched TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);

CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'movie',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, channel_id)
);

-- ============================================================================
-- 9. CONTENT RIGHTS, COMPLIANCE & TAKEDOWNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  license_type TEXT NOT NULL,
  rights_status rights_status_enum NOT NULL DEFAULT 'PUBLIC_DOMAIN',
  commercial_use BOOLEAN DEFAULT FALSE,
  notes TEXT,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_rights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id TEXT NOT NULL,
  content_title TEXT NOT NULL,
  rights_status rights_status_enum NOT NULL DEFAULT 'PUBLIC_DOMAIN',
  holder_name TEXT,
  verified_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id TEXT NOT NULL,
  content_title TEXT,
  reporter_email TEXT,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS takedown_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  content_id TEXT NOT NULL,
  content_title TEXT NOT NULL,
  claimant_name TEXT NOT NULL,
  claimant_email TEXT NOT NULL,
  copyright_owner TEXT NOT NULL,
  alleged_infringement_url TEXT NOT NULL,
  statement TEXT NOT NULL,
  status takedown_status_enum NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 10. SYSTEM & AUDIT LOGS, SITE SETTINGS, NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL DEFAULT 'info',
  category TEXT NOT NULL DEFAULT 'system',
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 11. INDEXES FOR HIGH-THROUGHPUT QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_user ON watch_history(user_id, last_watched DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_channels_enabled ON channels(enabled, published);
CREATE INDEX IF NOT EXISTS idx_movies_enabled ON movies(enabled, published);
CREATE INDEX IF NOT EXISTS idx_epg_channel_time ON epg_programs(channel_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_takedowns_status ON takedown_requests(status);
CREATE INDEX IF NOT EXISTS idx_admin_logs_time ON admin_logs(created_at DESC);

-- ============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_profile_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE star_iptv_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE star_iptv_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE star_iptv_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE star_iptv_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE epg_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE epg_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE movie_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE takedown_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper to check if current authenticated user is an administrator
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: Members view/update own; Admins view/update all
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id OR is_admin());

-- Users Profile Data: Member self-access
CREATE POLICY "user_data_all_own" ON users_profile_data
  FOR ALL USING (auth.uid() = user_id OR is_admin());

-- Private Members: Member reads own; Admin manages
CREATE POLICY "private_members_select_own" ON private_members
  FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "private_members_admin_all" ON private_members
  FOR ALL USING (is_admin());

-- Devices: Users can select/delete own devices; Admin can manage all
CREATE POLICY "devices_select_own" ON devices
  FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "devices_insert_own" ON devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "devices_update_own" ON devices
  FOR UPDATE USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "devices_delete_own" ON devices
  FOR DELETE USING (auth.uid() = user_id OR is_admin());

-- Subscriptions: Member views own
CREATE POLICY "subs_select_own" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "subs_admin_all" ON subscriptions
  FOR ALL USING (is_admin());

-- Subscription Plans: Public read for active; Admin manage
CREATE POLICY "plans_read_active" ON subscription_plans
  FOR SELECT USING (is_active = TRUE OR is_admin());
CREATE POLICY "plans_admin_all" ON subscription_plans
  FOR ALL USING (is_admin());

-- Star IPTV Vault: STRICTLY ADMIN ONLY (Zero access for normal members)
CREATE POLICY "star_iptv_config_admin_only" ON star_iptv_config
  FOR ALL USING (is_admin());
CREATE POLICY "star_iptv_packages_admin_only" ON star_iptv_packages
  FOR ALL USING (is_admin());
CREATE POLICY "star_iptv_customers_admin_only" ON star_iptv_customers
  FOR ALL USING (is_admin());
CREATE POLICY "star_iptv_subs_admin_only" ON star_iptv_subscriptions
  FOR ALL USING (is_admin());

-- Channels & Movies: Members read published; Admin manages all
CREATE POLICY "channels_read_published" ON channels
  FOR SELECT USING ((published = TRUE AND enabled = TRUE) OR is_admin());
CREATE POLICY "channels_admin_all" ON channels
  FOR ALL USING (is_admin());

CREATE POLICY "movies_read_published" ON movies
  FOR SELECT USING ((published = TRUE AND enabled = TRUE) OR is_admin());
CREATE POLICY "movies_admin_all" ON movies
  FOR ALL USING (is_admin());

-- EPG Programs: Authenticated read
CREATE POLICY "epg_read_authenticated" ON epg_programs
  FOR SELECT USING (auth.role() = 'authenticated' OR is_admin());
CREATE POLICY "epg_admin_all" ON epg_programs
  FOR ALL USING (is_admin());

-- Watch History: User self-access
CREATE POLICY "history_select_own" ON watch_history
  FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "history_insert_own" ON watch_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "history_update_own" ON watch_history
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "history_delete_own" ON watch_history
  FOR DELETE USING (auth.uid() = user_id);

-- Watchlist & Favorites: User self-access
CREATE POLICY "watchlist_all_own" ON watchlist
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "favorites_all_own" ON favorites
  FOR ALL USING (auth.uid() = user_id);

-- Takedowns & Reports: Public can insert; Admin can view & manage
CREATE POLICY "takedowns_insert_public" ON takedown_requests
  FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "takedowns_admin_manage" ON takedown_requests
  FOR ALL USING (is_admin());

-- Admin & System Logs: Strictly Admin Only
CREATE POLICY "admin_logs_admin_only" ON admin_logs
  FOR ALL USING (is_admin());
CREATE POLICY "system_logs_admin_only" ON system_logs
  FOR ALL USING (is_admin());

-- Site Settings: Public read for public settings; Admin write
CREATE POLICY "settings_read_public" ON site_settings
  FOR SELECT USING (is_public = TRUE OR is_admin());
CREATE POLICY "settings_admin_all" ON site_settings
  FOR ALL USING (is_admin());

-- Notifications: User reads own
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (auth.uid() = user_id OR is_admin());

-- ============================================================================
-- 13. SEED DATA (INITIAL PILOT STATE)
-- ============================================================================

INSERT INTO site_settings (key, value, description, is_public)
VALUES
  ('pilot_mode', '{"private_mode": true, "max_private_users": 5, "max_devices_per_user": 2, "public_registration": false, "payments_enabled": false, "commercial_mode": false}'::jsonb, 'Aether Stream closed beta pilot configuration', TRUE)
ON CONFLICT (key) DO NOTHING;

INSERT INTO channel_groups (name, slug, display_order)
VALUES
  ('News', 'news', 1),
  ('Science & Tech', 'science-tech', 2),
  ('Culture', 'culture', 3),
  ('Sports', 'sports', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO channels (name, category, group_name, country, language, logo_url, stream_url, tvg_id, tvg_name, rights_status, source_name, enabled, published)
VALUES
  ('DW News English', 'News', 'News', 'Germany', 'English', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/320px-Deutsche_Welle_symbol_2012.svg.png', 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8', 'DW.de', 'DW English', 'PUBLIC_BROADCAST', 'Deutsche Welle (Public Statutory Feed)', TRUE, TRUE),
  ('France 24 English', 'News', 'News', 'France', 'English', 'https://upload.wikimedia.org/wikipedia/en/thumb/6/65/France_24_logo.svg/320px-France_24_logo.svg.png', 'https://static.france24.com/live/F24_EN_LO_HLS/live_tv.m3u8', 'France24.en', 'France 24 English', 'PUBLIC_BROADCAST', 'France Médias Monde (Public Service)', TRUE, TRUE),
  ('NASA TV Operations', 'Science & Tech', 'Science & Tech', 'United States', 'English', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/320px-NASA_logo.svg.png', 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8', 'NASA.gov', 'NASA TV', 'PUBLIC_DOMAIN', 'NASA Public Domain (US Federal Government Work)', TRUE, TRUE),
  ('Bloomberg TV Markets', 'News', 'News', 'United States', 'English', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Bloomberg_Television_logo.svg/320px-Bloomberg_Television_logo.svg.png', 'https://liveprodupm.global.ssl.fastly.net/us/Channel-us-fast-1/source.m3u8', 'Bloomberg.us', 'Bloomberg TV', 'FREE_TO_AIR', 'Bloomberg Free-To-Air FAST Stream', TRUE, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO movies (title, slug, description, poster_url, backdrop_url, release_year, duration, language, rating, genres, video_url, license_name, rights_status, attribution, featured, trending, enabled, published)
VALUES
  ('Charade', 'charade-1963', 'A suspenseful romantic comedy thriller starring Audrey Hepburn and Cary Grant. A glamorous widow is pursued across Paris by mysterious men seeking her late husband’s stolen fortune.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Charade_1963_poster.jpg/440px-Charade_1963_poster.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Charade_trailer_Grant_Hepburn.jpg/1280px-Charade_trailer_Grant_Hepburn.jpg', 1963, '1h 53m', 'English', '7.9/10', ARRAY['Mystery', 'Romance', 'Thriller'], 'https://archive.org/download/Charade1963_201608/Charade1963.mp4', 'Public Domain (USA)', 'PUBLIC_DOMAIN', 'Entered USA Public Domain due to release without valid statutory copyright notice.', TRUE, TRUE, TRUE, TRUE),
  ('Night of the Living Dead', 'night-living-dead-1968', 'George A. Romero’s iconic cinematic masterpiece. Strangers barricade themselves inside a rural farmhouse as reanimated corpses rise from graves.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Night_of_the_Living_Dead_theatrical_poster.jpg/440px-Night_of_the_Living_Dead_theatrical_poster.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Night_of_the_Living_Dead_-_trailer_screencap.jpg/1280px-Night_of_the_Living_Dead_-_trailer_screencap.jpg', 1968, '1h 36m', 'English', '7.8/10', ARRAY['Horror', 'Sci-Fi', 'Cult Classic'], 'https://archive.org/download/night_of_the_living_dead_1968_restored/night_of_the_living_dead_1968_restored_512kb.mp4', 'Public Domain (USA)', 'PUBLIC_DOMAIN', 'Entered public domain immediately upon release due to title-change notice omission.', TRUE, TRUE, TRUE, TRUE),
  ('His Girl Friday', 'his-girl-friday-1940', 'Howard Hawks directs Cary Grant and Rosalind Russell in this razor-sharp screwball comedy of a newspaper editor attempting to keep his star reporter ex-wife.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/His_Girl_Friday_poster.jpg/440px-His_Girl_Friday_poster.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/His_Girl_Friday_title.jpg/1280px-His_Girl_Friday_title.jpg', 1940, '1h 32m', 'English', '7.8/10', ARRAY['Comedy', 'Romance', 'Classic'], 'https://archive.org/download/HisGirlFriday_201509/HisGirlFriday.mp4', 'Public Domain (USA)', 'PUBLIC_DOMAIN', 'Copyright was not renewed in the 28th year; entered public domain in 1968.', FALSE, TRUE, TRUE, TRUE),
  ('Tears of Steel', 'tears-of-steel-2012', 'Set in a dystopian future Amsterdam, scientists stage a crucial memory recreation from the past in an attempt to rescue humanity from mechanical singularities.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Tears_of_Steel_poster.jpg/440px-Tears_of_Steel_poster.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Tears_of_Steel_crowd.jpg/1280px-Tears_of_Steel_crowd.jpg', 2012, '12m', 'English', '7.2/10', ARRAY['Sci-Fi', 'Action', 'VFX'], 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', 'Creative Commons Attribution 3.0 (CC BY 3.0)', 'OPEN_LICENSE', '(CC) Blender Foundation | mango.blender.org', TRUE, TRUE, TRUE, TRUE)
ON CONFLICT DO NOTHING;
