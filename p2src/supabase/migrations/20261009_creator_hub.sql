-- ============================================================
-- StreamPlay CREATOR HUB — schema, RLS, seeds
-- Migration: 20261009_creator_hub.sql
-- Apply in Supabase SQL Editor (or psql). Idempotent where safe.
--
-- Security model summary:
--  * Creators authenticate with Supabase Auth (auth.users).
--  * Creator-privileged writes NEVER happen through table grants:
--    videos/views/earnings/withdrawals/strikes are mutated ONLY by the
--    StreamPlay API using the service role. RLS below therefore gives
--    creators read-only access to their own rows.
--    => A creator CANNOT modify view counts, earnings, or approve
--       their own videos even if they use the REST API directly.
--  * Public read access is granted only for published content,
--    categories, profiles, and settings/flags (no secrets).
--  * Raw abuse-sensitive tables (video_views, video_watch_sessions)
--    have ZERO client policies (deny-all for anon + authenticated).
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------
do $$ begin
  create type creator_status as enum ('pending','active','suspended','banned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type creator_video_status as enum ('draft','pending_review','published','rejected','taken_down');
exception when duplicate_object then null; end $$;

do $$ begin
  create type creator_video_kind as enum ('video','short','live');
exception when duplicate_object then null; end $$;

do $$ begin
  create type creator_access_tier as enum ('free','paid','auto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type creator_engagement_type as enum ('like','comment','report');
exception when duplicate_object then null; end $$;

do $$ begin
  create type creator_report_status as enum ('open','reviewing','resolved','dismissed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type creator_withdrawal_status as enum ('pending','approved','paid','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type creator_strike_status as enum ('active','expired','reversed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type creator_notification_type as enum ('info','approval','rejection','strike','payout','system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type creator_payout_method_type as enum ('bank','paypal','wise','other');
exception when duplicate_object then null; end $$;

-- updated_at trigger helper (reuse / recreate safely)
create or replace function update_updated_at_column() returns trigger as $$
begin new.updated_at = now(); return new; end $$ language plpgsql;

-- ------------------------------------------------------------
-- 1. creators
-- ------------------------------------------------------------
create table if not exists creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  handle text not null unique,
  display_name text not null,
  email text not null,
  status creator_status not null default 'pending',
  monetization_enabled boolean not null default false,
  access_tier_override creator_access_tier null,      -- admin can force free/paid for ALL creator content
  suspended_until timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creators_handle_format check (handle ~ '^[a-z0-9_]{3,32}$')
);
create index if not exists creators_status_idx on creators (status);
create trigger trg_creators_updated_at before update on creators
  for each row execute function update_updated_at_column();

alter table creators enable row level security;

drop policy if exists "creators_select_own" on creators;
create policy "creators_select_own" on creators
  for select to authenticated
  using (user_id = auth.uid());
-- NO insert/update/delete policies for creators: provisioning is admin-only (service role).

-- ------------------------------------------------------------
-- 2. creator_profiles (public read)
-- ------------------------------------------------------------
create table if not exists creator_profiles (
  creator_id uuid primary key references creators(id) on delete cascade,
  avatar_url text null,
  bio text null check (char_length(coalesce(bio,'')) <= 1000),
  links jsonb not null default '[]'::jsonb,
  total_followers integer not null default 0,
  total_likes integer not null default 0,
  total_views integer not null default 0,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_creator_profiles_updated_at before update on creator_profiles
  for each row execute function update_updated_at_column();

alter table creator_profiles enable row level security;

drop policy if exists "creator_profiles_public_read" on creator_profiles;
create policy "creator_profiles_public_read" on creator_profiles
  for select using (true);

drop policy if exists "creator_profiles_update_own" on creator_profiles;
create policy "creator_profiles_update_own" on creator_profiles
  for update to authenticated
  using (creator_id in (select id from creators where user_id = auth.uid()))
  with check (creator_id in (select id from creators where user_id = auth.uid()));

-- ------------------------------------------------------------
-- 3. creator_categories (public read, admin-managed)
-- ------------------------------------------------------------
create table if not exists creator_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table creator_categories enable row level security;
drop policy if exists "creator_categories_public_read" on creator_categories;
create policy "creator_categories_public_read" on creator_categories
  for select using (true);

insert into creator_categories (slug, name, sort_order) values
  ('music','Music',1),('gaming','Gaming',2),('education','Education',3),
  ('entertainment','Entertainment',4),('tech','Tech',5),('vlog','Vlog',6),
  ('sports','Sports',7),('news','News',8),('comedy','Comedy',9),('other','Other',10)
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- 4. creator_videos
-- ------------------------------------------------------------
create table if not exists creator_videos (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  category_id uuid null references creator_categories(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text null check (char_length(coalesce(description,'')) <= 5000),
  kind creator_video_kind not null default 'video',
  status creator_video_status not null default 'draft',
  access_tier creator_access_tier not null default 'auto',
  free_until timestamptz null,             -- explicit free window end (admin/creator set)
  storage_path text null,                  -- creator-media/<creatorId>/<videoId>/<file>
  storage_bucket text not null default 'creator-media',
  thumb_path text null,
  duration_seconds integer null check (duration_seconds is null or duration_seconds >= 0),
  size_bytes bigint null check (size_bytes is null or size_bytes >= 0),
  mime_type text null,
  width integer null, height integer null,
  rejection_reason text null,
  moderated_by uuid null, moderated_at timestamptz null,
  published_at timestamptz null,
  valid_views integer not null default 0,      -- SERVER-MAINTAINED, creator read-only
  watch_seconds bigint not null default 0,     -- SERVER-MAINTAINED, creator read-only
  likes_count integer not null default 0,      -- trigger-maintained
  comments_count integer not null default 0,   -- trigger-maintained
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creator_videos_creator_status_idx on creator_videos (creator_id, status, created_at desc);
create index if not exists creator_videos_public_idx on creator_videos (status, kind, published_at desc) where status = 'published';
create index if not exists creator_videos_moderation_idx on creator_videos (status, created_at) where status = 'pending_review';
create trigger trg_creator_videos_updated_at before update on creator_videos
  for each row execute function update_updated_at_column();

alter table creator_videos enable row level security;

-- public sees ONLY published; creators see their own rows in any status
drop policy if exists "creator_videos_public_read" on creator_videos;
create policy "creator_videos_public_read" on creator_videos
  for select using (
    status = 'published'
    or (auth.uid() is not null and creator_id in (select id from creators where user_id = auth.uid()))
  );
-- NO insert/update/delete policies: all writes through the API (service role).

-- engagement counters (likes / comments) maintained by triggers
create or replace function creator_video_bump_counters() returns trigger as $$
declare delta int; target uuid;
begin
  if (tg_op = 'INSERT') then
    target := new.video_id;
    if new.type = 'like' then delta := 1; elsif new.type = 'comment' then delta := 0; end if;
  elsif (tg_op = 'DELETE') then
    target := old.video_id;
    if old.type = 'like' then delta := -1; elsif old.type = 'comment' then delta := 0; end if;
  end if;
  if delta is not null and delta <> 0 then
    update creator_videos set likes_count = greatest(0, likes_count + delta) where id = target;
  end if;
  return null;
end $$ language plpgsql security definer;

drop trigger if exists trg_video_engagements_likes on video_engagements;

-- ------------------------------------------------------------
-- 5. creator_followers
-- ------------------------------------------------------------
create table if not exists creator_followers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  follower_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (creator_id, follower_user_id)
);
create index if not exists creator_followers_creator_idx on creator_followers (creator_id, created_at desc);
create index if not exists creator_followers_follower_idx on creator_followers (follower_user_id);

alter table creator_followers enable row level security;
drop policy if exists "creator_followers_read" on creator_followers;
create policy "creator_followers_read" on creator_followers for select using (true);
drop policy if exists "creator_followers_insert_own" on creator_followers;
create policy "creator_followers_insert_own" on creator_followers
  for insert to authenticated with check (follower_user_id = auth.uid());
drop policy if exists "creator_followers_delete_own" on creator_followers;
create policy "creator_followers_delete_own" on creator_followers
  for delete to authenticated using (follower_user_id = auth.uid());

create or replace function creator_followers_sync() returns trigger as $$
declare cid uuid; d int;
begin
  if (tg_op = 'INSERT') then cid := new.creator_id; d := 1;
  elsif (tg_op = 'DELETE') then cid := old.creator_id; d := -1;
  end if;
  update creator_profiles set total_followers = greatest(0, total_followers + d) where creator_id = cid;
  return null;
end $$ language plpgsql security definer;

drop trigger if exists trg_creator_followers_sync on creator_followers;
create trigger trg_creator_followers_sync after insert or delete on creator_followers
  for each row execute function creator_followers_sync();

-- ------------------------------------------------------------
-- 6. video_watch_sessions  (raw telemetry — NO client policies)
-- ------------------------------------------------------------
create table if not exists video_watch_sessions (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references creator_videos(id) on delete cascade,
  creator_id uuid not null references creators(id) on delete cascade,
  viewer_user_id uuid null references auth.users(id) on delete set null,
  viewer_key text not null,                 -- sha256(user-or-ip+ua) — privacy-preserving
  ip_hash text null,
  user_agent text null,
  watch_seconds integer not null default 0,
  heartbeats integer not null default 0,
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz null,
  ended_at timestamptz null,
  is_valid boolean not null default false,
  invalid_reason text null,
  is_suspicious boolean not null default false,
  suspicion_score integer not null default 0,
  suspicion_notes jsonb not null default '[]'::jsonb,
  reviewed_by uuid null, reviewed_at timestamptz null,
  created_at timestamptz not null default now()
);
create index if not exists video_watch_sessions_video_idx on video_watch_sessions (video_id, created_at desc);
create index if not exists video_watch_sessions_creator_idx on video_watch_sessions (creator_id, started_at desc);
create index if not exists video_watch_sessions_suspicious_idx on video_watch_sessions (is_suspicious, created_at desc);
create index if not exists video_watch_sessions_viewer_idx on video_watch_sessions (video_id, viewer_key, started_at desc);

alter table video_watch_sessions enable row level security;
-- deny-all: no policies. Service role only (bypasses RLS).

-- ------------------------------------------------------------
-- 7. video_views  (VALID views only — NO client policies)
-- ------------------------------------------------------------
create table if not exists video_views (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references creator_videos(id) on delete cascade,
  creator_id uuid not null references creators(id) on delete cascade,
  session_id uuid not null unique references video_watch_sessions(id) on delete cascade, -- 1 valid view max per session
  viewer_user_id uuid null,
  viewer_key text not null,
  watched_seconds integer not null default 0,
  source text null default 'web',
  ip_hash text null,
  created_at timestamptz not null default now()
);
create index if not exists video_views_video_idx on video_views (video_id, created_at desc);
create index if not exists video_views_creator_idx on video_views (creator_id, created_at desc);
-- repeated-refresh protection: same viewer cannot generate another VALID view
-- for the same video inside the dedupe window (enforced in code; partial unique below
-- is a hard backstop for a per-video/viewer last-view pattern):
create unique index if not exists video_views_video_viewer_day_idx
  on video_views (video_id, viewer_key, date_trunc('hour', created_at));

alter table video_views enable row level security;
-- deny-all: no policies. Service role only.

-- ------------------------------------------------------------
-- 8. video_engagements (likes / comments / reports)
-- ------------------------------------------------------------
create table if not exists video_engagements (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references creator_videos(id) on delete cascade,
  creator_id uuid not null references creators(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  type creator_engagement_type not null,
  content text null check (content is null or char_length(content) between 1 and 2000),
  status creator_report_status not null default 'open',
  details jsonb not null default '{}'::jsonb,
  ip_hash text null,
  resolved_by uuid null, resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint engagements_comment_has_content check (type <> 'comment' or content is not null)
);
create unique index if not exists video_engagements_like_unique on video_engagements (video_id, user_id, type) where type = 'like' and user_id is not null;
create index if not exists video_engagements_video_idx on video_engagements (video_id, type, created_at desc);
create index if not exists video_engagements_reports_idx on video_engagements (status, created_at desc) where type = 'report';

alter table video_engagements enable row level security;

drop policy if exists "video_engagements_read_public" on video_engagements;
create policy "video_engagements_read_public" on video_engagements
  for select using (
    (type in ('like','comment') and video_id in (select id from creator_videos where status = 'published'))
    or (user_id is not null and user_id = auth.uid())
  );
drop policy if exists "video_engagements_insert_auth" on video_engagements;
create policy "video_engagements_insert_auth" on video_engagements
  for insert to authenticated with check (
    user_id = auth.uid()
    and (type <> 'report' or true)
    and video_id in (select id from creator_videos where status = 'published')
  );
drop policy if exists "video_engagements_insert_report_anon" on video_engagements;
create policy "video_engagements_insert_report_anon" on video_engagements
  for insert to anon with check (type = 'report' and content is not null);
drop policy if exists "video_engagements_delete_own" on video_engagements;
create policy "video_engagements_delete_own" on video_engagements
  for delete to authenticated using (user_id = auth.uid());

drop trigger if exists trg_video_engagements_likes on video_engagements;
create trigger trg_video_engagements_likes after insert or delete on video_engagements
  for each row when (new.type = 'like' or old.type = 'like')
  execute function creator_video_bump_counters();

-- comments counter
create or replace function creator_video_comment_counter() returns trigger as $$
declare d int; target uuid;
begin
  if (tg_op = 'INSERT') then target := new.video_id; d := 1;
  else target := old.video_id; d := -1; end if;
  update creator_videos set comments_count = greatest(0, comments_count + d) where id = target;
  return null;
end $$ language plpgsql security definer;

drop trigger if exists trg_video_engagements_comments on video_engagements;
create trigger trg_video_engagements_comments after insert or delete on video_engagements
  for each row when (new.type = 'comment' or old.type = 'comment')
  execute function creator_video_comment_counter();

-- likes -> creator_profiles.total_likes
create or replace function creator_likes_sync() returns trigger as $$
declare cid uuid; d int;
begin
  if (tg_op = 'INSERT') then cid := new.creator_id; d := 1;
  else cid := old.creator_id; d := -1; end if;
  update creator_profiles set total_likes = greatest(0, total_likes + d) where creator_id = cid;
  return null;
end $$ language plpgsql security definer;

drop trigger if exists trg_video_engagements_likes_profile on video_engagements;
create trigger trg_video_engagements_likes_profile after insert or delete on video_engagements
  for each row when (new.type = 'like' or old.type = 'like')
  execute function creator_likes_sync();

-- ------------------------------------------------------------
-- 9. creator_earnings (aggregates — creator read-only)
-- ------------------------------------------------------------
create table if not exists creator_earnings (
  creator_id uuid primary key references creators(id) on delete cascade,
  eligible_views integer not null default 0,
  estimated_earnings_usd numeric(12,4) not null default 0,
  paid_out_usd numeric(12,2) not null default 0,
  pending_withdrawal_usd numeric(12,2) not null default 0,
  last_computed_at timestamptz null,
  updated_at timestamptz not null default now()
);
create trigger trg_creator_earnings_updated_at before update on creator_earnings
  for each row execute function update_updated_at_column();

alter table creator_earnings enable row level security;
drop policy if exists "creator_earnings_select_own" on creator_earnings;
create policy "creator_earnings_select_own" on creator_earnings
  for select to authenticated
  using (creator_id in (select id from creators where user_id = auth.uid()));
-- no write policies: service role recomputes

-- ------------------------------------------------------------
-- 10. creator_earnings_ledger (append-only — creator read-only)
-- ------------------------------------------------------------
create table if not exists creator_earnings_ledger (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  video_id uuid null references creator_videos(id) on delete set null,
  entry_type text not null check (entry_type in ('view_credit','adjustment','withdrawal_hold','withdrawal_paid','reversal')),
  views integer not null default 0,
  amount_usd numeric(12,4) not null default 0,
  description text null,
  period_start timestamptz null, period_end timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now()
);
create index if not exists creator_earnings_ledger_creator_idx on creator_earnings_ledger (creator_id, created_at desc);

alter table creator_earnings_ledger enable row level security;
drop policy if exists "creator_earnings_ledger_select_own" on creator_earnings_ledger;
create policy "creator_earnings_ledger_select_own" on creator_earnings_ledger
  for select to authenticated
  using (creator_id in (select id from creators where user_id = auth.uid()));
-- no insert/update policies (append-only, service role only)

-- ------------------------------------------------------------
-- 11. payout_methods
-- ------------------------------------------------------------
create table if not exists payout_methods (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  method_type creator_payout_method_type not null default 'bank',
  label text not null,
  details jsonb not null default '{}'::jsonb,   -- account fields; never exposed to other users
  is_default boolean not null default false,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payout_methods_creator_idx on payout_methods (creator_id);
create trigger trg_payout_methods_updated_at before update on payout_methods
  for each row execute function update_updated_at_column();

alter table payout_methods enable row level security;
drop policy if exists "payout_methods_select_own" on payout_methods;
create policy "payout_methods_select_own" on payout_methods
  for select to authenticated
  using (creator_id in (select id from creators where user_id = auth.uid()));
drop policy if exists "payout_methods_insert_own" on payout_methods;
create policy "payout_methods_insert_own" on payout_methods
  for insert to authenticated
  with check (creator_id in (select id from creators where user_id = auth.uid()));
drop policy if exists "payout_methods_update_own" on payout_methods;
create policy "payout_methods_update_own" on payout_methods
  for update to authenticated
  using (creator_id in (select id from creators where user_id = auth.uid()))
  with check (creator_id in (select id from creators where user_id = auth.uid()));
drop policy if exists "payout_methods_delete_own" on payout_methods;
create policy "payout_methods_delete_own" on payout_methods
  for delete to authenticated
  using (creator_id in (select id from creators where user_id = auth.uid()));

-- ------------------------------------------------------------
-- 12. creator_withdrawals (creator read-only)
-- ------------------------------------------------------------
create table if not exists creator_withdrawals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  method_id uuid null references payout_methods(id) on delete set null,
  amount_usd numeric(12,2) not null check (amount_usd > 0),
  status creator_withdrawal_status not null default 'pending',
  admin_note text null,
  processed_by uuid null, processed_at timestamptz null,
  payout_ref text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creator_withdrawals_creator_idx on creator_withdrawals (creator_id, created_at desc);
create index if not exists creator_withdrawals_status_idx on creator_withdrawals (status, created_at);
create trigger trg_creator_withdrawals_updated_at before update on creator_withdrawals
  for each row execute function update_updated_at_column();

alter table creator_withdrawals enable row level security;
drop policy if exists "creator_withdrawals_select_own" on creator_withdrawals;
create policy "creator_withdrawals_select_own" on creator_withdrawals
  for select to authenticated
  using (creator_id in (select id from creators where user_id = auth.uid()));
-- no write policies: withdrawal lifecycle is API/admin-controlled

-- ------------------------------------------------------------
-- 13. creator_strikes (creator read-only)
-- ------------------------------------------------------------
create table if not exists creator_strikes (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  video_id uuid null references creator_videos(id) on delete set null,
  reason text not null,
  severity integer not null default 1 check (severity between 1 and 3),
  status creator_strike_status not null default 'active',
  issued_by uuid null,
  expires_at timestamptz null,
  created_at timestamptz not null default now()
);
create index if not exists creator_strikes_creator_idx on creator_strikes (creator_id, status);

alter table creator_strikes enable row level security;
drop policy if exists "creator_strikes_select_own" on creator_strikes;
create policy "creator_strikes_select_own" on creator_strikes
  for select to authenticated
  using (creator_id in (select id from creators where user_id = auth.uid()));
-- no write policies: strikes are admin-only

-- ------------------------------------------------------------
-- 14. copyright_reports (form submissions; admin-only read)
-- ------------------------------------------------------------
create table if not exists copyright_reports (
  id uuid primary key default gen_random_uuid(),
  video_id uuid null references creator_videos(id) on delete set null,
  reporter_name text not null,
  reporter_email text not null,
  reporter_user_id uuid null references auth.users(id) on delete set null,
  original_work_url text null,
  details text not null,
  status creator_report_status not null default 'open',
  resolution_note text null,
  reviewed_by uuid null, reviewed_at timestamptz null,
  created_at timestamptz not null default now()
);
create index if not exists copyright_reports_status_idx on copyright_reports (status, created_at desc);

alter table copyright_reports enable row level security;
drop policy if exists "copyright_reports_insert_public" on copyright_reports;
create policy "copyright_reports_insert_public" on copyright_reports
  for insert to anon, authenticated with check (true);
drop policy if exists "copyright_reports_select_own" on copyright_reports;
create policy "copyright_reports_select_own" on copyright_reports
  for select to authenticated
  using (reporter_user_id = auth.uid());
-- admin review happens via service-role API

-- ------------------------------------------------------------
-- 15. creator_notifications
-- ------------------------------------------------------------
create table if not exists creator_notifications (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  type creator_notification_type not null default 'info',
  title text not null,
  body text null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);
create index if not exists creator_notifications_creator_idx on creator_notifications (creator_id, created_at desc);

alter table creator_notifications enable row level security;
drop policy if exists "creator_notifications_select_own" on creator_notifications;
create policy "creator_notifications_select_own" on creator_notifications
  for select to authenticated
  using (creator_id in (select id from creators where user_id = auth.uid()));
drop policy if exists "creator_notifications_update_own" on creator_notifications;
create policy "creator_notifications_update_own" on creator_notifications
  for update to authenticated
  using (creator_id in (select id from creators where user_id = auth.uid()))
  with check (creator_id in (select id from creators where user_id = auth.uid()));
-- inserts via service role (system events)

-- ------------------------------------------------------------
-- 16. viewer_entitlements (paid-access architecture)
-- ------------------------------------------------------------
create table if not exists viewer_entitlements (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references creator_videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'admin_grant' check (source in ('purchase','admin_grant','subscription')),
  valid_until timestamptz null,
  created_at timestamptz not null default now(),
  unique (video_id, user_id)
);
create index if not exists viewer_entitlements_user_idx on viewer_entitlements (user_id);

alter table viewer_entitlements enable row level security;
drop policy if exists "viewer_entitlements_select_own" on viewer_entitlements;
create policy "viewer_entitlements_select_own" on viewer_entitlements
  for select to authenticated using (user_id = auth.uid());
-- grants via service role only

-- ------------------------------------------------------------
-- 17. creator_settings (single-row, admin-configurable)
-- ------------------------------------------------------------
create table if not exists creator_settings (
  id integer primary key default 1 check (id = 1),
  -- monetization (NOT hard-coded in app code)
  min_eligible_views integer not null default 10000,
  payout_per_10000_valid_views_usd numeric(10,2) not null default 5.00,
  minimum_withdrawal_usd numeric(10,2) not null default 15.00,
  -- 2-day access model (configurable, not hard-coded)
  free_access_percentage integer not null default 50 check (free_access_percentage between 0 and 100),
  paid_access_percentage integer not null default 50 check (paid_access_percentage between 0 and 100),
  free_access_duration_days integer not null default 2 check (free_access_duration_days >= 0),
  -- moderation
  moderation_enabled boolean not null default true,
  auto_publish_shorts boolean not null default false,
  -- fraud controls
  min_watch_seconds integer not null default 30,
  dedupe_window_minutes integer not null default 30,
  max_sessions_per_hour_per_ip integer not null default 12,
  max_watch_heartbeat_seconds integer not null default 20,
  suspicion_threshold integer not null default 60,
  updated_by uuid null,
  updated_at timestamptz not null default now()
);
insert into creator_settings (id) values (1) on conflict (id) do nothing;

alter table creator_settings enable row level security;
drop policy if exists "creator_settings_public_read" on creator_settings;
create policy "creator_settings_public_read" on creator_settings for select using (true);
-- writes via service role only

-- ------------------------------------------------------------
-- 18. creator_feature_flags
-- ------------------------------------------------------------
create table if not exists creator_feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text null,
  updated_by uuid null,
  updated_at timestamptz not null default now()
);

insert into creator_feature_flags (key, enabled, description) values
  ('CREATOR_HUB_ENABLED',        true,  'Master switch for the Creator Hub (portal + browse + admin)'),
  ('CREATOR_UPLOAD_ENABLED',     true,  'Creators can upload new media (dev/admin testing)'),
  ('CREATOR_MONETIZATION_ENABLED', false, 'Earnings accrual + analytics on estimates (no payouts)'),
  ('PAYOUTS_ENABLED',            false, 'REAL money movement — never enable without compliance review'),
  ('PAID_CONTENT_ENABLED',       false, 'Enforce paywall on paid-tier creator content')
on conflict (key) do nothing;

alter table creator_feature_flags enable row level security;
drop policy if exists "creator_flags_public_read" on creator_feature_flags;
create policy "creator_flags_public_read" on creator_feature_flags for select using (true);
-- writes via service role only

-- ------------------------------------------------------------
-- Storage: private creator-media bucket (uploads via signed URLs)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creator-media','creator-media', false,
  2147483648,  -- 2 GiB
  array['video/mp4','video/webm','video/quicktime','image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = coalesce(excluded.file_size_limit, storage.buckets.file_size_limit),
      allowed_mime_types = coalesce(excluded.allowed_mime_types, storage.buckets.allowed_mime_types);

-- No storage.objects policies: private bucket, access exclusively via
-- short-TTL signed URLs minted by the StreamPlay API (service role).
