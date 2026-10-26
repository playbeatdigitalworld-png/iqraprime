-- ============================================================================
-- STREAMPLAY — CREATOR HUB (PHASE 1) — DATABASE MIGRATION
-- ============================================================================
-- Target   : Supabase Postgres (project ref: ujzvkwgrxtujpinkytbf)
-- File     : 20261008000000_creator_hub_phase1.sql
-- Scope    : 15 Creator Hub tables + admin allowlist + app settings +
--            feature flags + RLS + triggers + storage bucket + helper RPCs
--
-- HOW TO APPLY
--   Option A (Supabase Dashboard): SQL Editor -> New query -> paste whole file -> Run
--   Option B (Supabase CLI)      : put in supabase/migrations/ and `supabase db push`
--
-- SAFETY / HARD CONSTRAINTS HONORED
--   * Does NOT touch existing IPTV/catalog architecture: no catalog tables,
--     no 'catalog-cache' bucket changes, no provider/M3U/EPG objects.
--   * Idempotent-ish: re-running is safe (IF NOT EXISTS / DO-guarded enums /
--     DROP+CREATE triggers / ON CONFLICT seeds).
--   * Service role (SRK) bypasses RLS by design and is allowed inside guards;
--     the SRK must ONLY ever be used server-side, never in the browser.
--
-- CONTENT STATE MACHINE (spec)
--   DRAFT -> PENDING_REVIEW -> PUBLISHED
--                           -> REJECTED -> (edit) -> DRAFT -> PENDING_REVIEW ...
--   PUBLISHED -> TAKEN_DOWN (copyright/strike)
--   Creators may only: DRAFT <-> PENDING_REVIEW, REJECTED -> DRAFT.
--   Only admins may: PUBLISHED / REJECTED / TAKEN_DOWN (enforced by trigger).
--
-- MONETIZATION (spec — all configurable in app_settings, never hardcoded)
--   MIN_ELIGIBLE_VIEWS          = 10000
--   PAYOUT_PER_10000_VALID_VIEWS= 5.00 USD per 10,000 valid views
--   MINIMUM_WITHDRAWAL_USD      = 15.00
--   FREE_ACCESS_PERCENTAGE      = 50 , PAID_ACCESS_PERCENTAGE = 50
--   FREE_ACCESS_DURATION_DAYS   = 2
--   Creator-facing UI must label money as "Estimated Earnings" — never a
--   guarantee. Real payouts stay OFF (PAYOUTS_ENABLED=false) until admin
--   deliberately enables them.
--
-- FEATURE FLAGS (spec)
--   CREATOR_HUB_ENABLED=true, CREATOR_UPLOAD_ENABLED=true,
--   CREATOR_MONETIZATION_ENABLED=false, PAYOUTS_ENABLED=false,
--   PAID_CONTENT_ENABLED=false
-- ============================================================================

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ============================================================================
-- SECTION 0 — SHARED HELPERS
-- ============================================================================

-- Admin allowlist (rows inserted by service role after creating admin users
-- in Supabase Auth). Example (uncomment + replace with the real admin user id):
-- insert into public.admin_users (user_id, email, note)
-- values ('00000000-0000-0000-0000-000000000000','admin@playbeatdigital.store','owner')
-- on conflict (user_id) do nothing;

create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      citext unique,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Is the current JWT user an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  );
$$;

-- True when the request is made with the service role key (server-side only).
create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(auth.role(), '') = 'service_role';
$$;

-- Feature flag lookup helper: public.flag_enabled(p_key text)
-- NOTE: defined in SECTION 3 (after the feature_flags table exists).
-- SQL-language functions validate table references at CREATE time, so any
-- function referencing a table must come after that table in this file.

-- Generic updated_at toucher.
create or replace function public.th_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================================
-- SECTION 1 — ENUMS (spec-critical state machine as a real enum)
-- ============================================================================

do $$
begin
  create type public.creator_video_status as enum
    ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'TAKEN_DOWN');
exception
  when duplicate_object then null;
end $$;

-- ============================================================================
-- SECTION 2 — CORE TABLES (1..4 of 15)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) creators — one row per creator account (1:1 with a Supabase auth user)
--    default_access_type implements creator-level FREE/PAID default
--    (admin/video-level overrides live on creator_videos.access_type).
-- ----------------------------------------------------------------------------
create table if not exists public.creators (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references auth.users(id) on delete cascade,
  handle              citext not null unique,
  channel_name        text not null check (char_length(channel_name) between 1 and 120),
  email               citext,
  status              text not null default 'PENDING'
                        check (status in ('PENDING','ACTIVE','SUSPENDED','BANNED')),
  default_access_type text not null default 'FREE'
                        check (default_access_type in ('FREE','PAID')),
  strike_count        int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2) creator_profiles — public-facing profile extension (1:1 with creators)
-- ----------------------------------------------------------------------------
create table if not exists public.creator_profiles (
  creator_id    uuid primary key references public.creators(id) on delete cascade,
  bio           text check (bio is null or char_length(bio) <= 2000),
  avatar_url    text,
  banner_url    text,
  website_url   text,
  social_links  jsonb not null default '[]'::jsonb,
  country       text,
  is_public     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3) creator_categories — taxonomy for creator-uploaded content (admin-managed)
-- ----------------------------------------------------------------------------
create table if not exists public.creator_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  slug        citext not null unique,
  description text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4) creator_videos — videos / shorts / live events uploaded by creators
--    status   : creator_video_status enum (state machine above)
--    access   : access_type FREE|PAID + free_until (paywall start time,
--               server-set from FREE_ACCESS_DURATION_DAYS when PAID)
--    counters : denormalized, creator-immutable (guarded by triggers)
-- ----------------------------------------------------------------------------
create table if not exists public.creator_videos (
  id                 uuid primary key default gen_random_uuid(),
  creator_id         uuid not null references public.creators(id) on delete cascade,
  category_id        uuid references public.creator_categories(id) on delete set null,
  title              text not null check (char_length(title) between 1 and 200),
  description        text check (description is null or char_length(description) <= 5000),
  content_type       text not null default 'VIDEO'
                       check (content_type in ('VIDEO','SHORTS','LIVE')),
  status             public.creator_video_status not null default 'DRAFT',
  access_type        text not null default 'FREE' check (access_type in ('FREE','PAID')),
  media_url          text,
  thumbnail_url      text,
  duration_seconds   int check (duration_seconds is null or duration_seconds >= 0),
  size_bytes         bigint check (size_bytes is null or size_bytes >= 0),
  rejection_reason   text,
  reviewed_by        uuid references public.admin_users(user_id) on delete set null,
  reviewed_at        timestamptz,
  free_until         timestamptz,
  published_at       timestamptz,
  taken_down_at      timestamptz,
  live_scheduled_at  timestamptz,
  view_count         bigint not null default 0,
  valid_view_count   bigint not null default 0,
  like_count         bigint not null default 0,
  comment_count      bigint not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ============================================================================
-- SECTION 2 (CONTINUED) — REMAINING TABLES (5..15 of 15)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5) creator_followers — follow graph (unique per creator+follower)
-- ----------------------------------------------------------------------------
create table if not exists public.creator_followers (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references public.creators(id) on delete cascade,
  follower_user_id uuid not null references auth.users(id) on delete cascade,
  created_at       timestamptz not null default now(),
  unique (creator_id, follower_user_id)
);

-- ----------------------------------------------------------------------------
-- 6) video_watch_sessions — one row per playback session (anti-fraud base
--    layer). Client inserts its own session; heartbeat/watched updates and
--    fraud flagging are service-role operations. View COUNTING does NOT
--    happen here — see video_views (server-inserted after validation).
-- ----------------------------------------------------------------------------
create table if not exists public.video_watch_sessions (
  id                 uuid primary key default gen_random_uuid(),
  video_id           uuid not null references public.creator_videos(id) on delete cascade,
  viewer_user_id     uuid references auth.users(id) on delete set null,
  viewer_session_key text not null,
  device_hash        text,
  ip_hash            text,
  watched_seconds    int not null default 0 check (watched_seconds >= 0),
  heartbeats         int not null default 0,
  started_at         timestamptz not null default now(),
  last_heartbeat_at  timestamptz not null default now(),
  ended_at           timestamptz,
  is_suspicious      boolean not null default false,
  suspicious_reasons jsonb not null default '[]'::jsonb
);

-- ----------------------------------------------------------------------------
-- 7) video_views — the COUNTED view event. Inserted ONLY by the server
--    (service role) after validation: min watch time, dedupe, suspicious
--    scoring, rate limiting. Hard anti-spam guarantee at DB level:
--    at most ONE valid counted view per viewer per video per UTC day.
-- ----------------------------------------------------------------------------
create table if not exists public.video_views (
  id                 uuid primary key default gen_random_uuid(),
  video_id           uuid not null references public.creator_videos(id) on delete cascade,
  creator_id         uuid not null references public.creators(id) on delete cascade,
  viewer_user_id     uuid references auth.users(id) on delete set null,
  viewer_key         text not null,
  watch_session_id   uuid references public.video_watch_sessions(id) on delete set null,
  watched_seconds    int not null default 0,
  view_date          date not null default (now() at time zone 'utc')::date,
  is_valid           boolean not null default true,
  suspicious_reasons jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now(),
  unique (video_id, viewer_key, view_date)
);

-- ----------------------------------------------------------------------------
-- 8) video_engagements — likes + comments (spec: likes/comments architecture)
-- ----------------------------------------------------------------------------
create table if not exists public.video_engagements (
  id                uuid primary key default gen_random_uuid(),
  video_id          uuid not null references public.creator_videos(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  engagement_type   text not null check (engagement_type in ('LIKE','COMMENT')),
  comment_text      text check (comment_text is null or char_length(comment_text) between 1 and 2000),
  parent_comment_id uuid references public.video_engagements(id) on delete cascade,
  is_hidden         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- one LIKE per user per video (comments are unlimited)
create unique index if not exists uq_video_engagements_one_like
  on public.video_engagements (video_id, user_id)
  where engagement_type = 'LIKE';

-- ----------------------------------------------------------------------------
-- 9) creator_earnings — aggregate money snapshot per creator (creator is
--    read-only here; all writes go through service role / RPCs).
--    estimated_earnings_usd is ALWAYS presented in UI as "Estimated Earnings".
-- ----------------------------------------------------------------------------
create table if not exists public.creator_earnings (
  creator_id              uuid primary key references public.creators(id) on delete cascade,
  valid_views             bigint not null default 0,
  eligible_views          bigint not null default 0,
  estimated_earnings_usd  numeric(12,2) not null default 0 check (estimated_earnings_usd >= 0),
  available_balance_usd   numeric(12,2) not null default 0 check (available_balance_usd >= 0),
  pending_withdrawal_usd  numeric(12,2) not null default 0 check (pending_withdrawal_usd >= 0),
  withdrawn_total_usd     numeric(12,2) not null default 0,
  last_accrued_at         timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10) creator_earnings_ledger — append-only money audit trail (double-entry
--     style: every balance change has a ledger row with balance_after).
-- ----------------------------------------------------------------------------
create table if not exists public.creator_earnings_ledger (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references public.creators(id) on delete cascade,
  entry_type    text not null check (entry_type in
                  ('VIEW_REVENUE','ADJUSTMENT','WITHDRAWAL','WITHDRAWAL_REFUND','REVERSAL')),
  amount_usd    numeric(12,2) not null,
  balance_after numeric(12,2) not null,
  video_id      uuid references public.creator_videos(id) on delete set null,
  withdrawal_id uuid,
  description   text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 11) payout_methods — creator-managed payout destinations
-- ----------------------------------------------------------------------------
create table if not exists public.payout_methods (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references public.creators(id) on delete cascade,
  method_type     text not null check (method_type in
                    ('BANK_TRANSFER','PAYPAL','BKASH','NAGAD','ROCKET','CRYPTO','OTHER')),
  display_name    text not null check (char_length(display_name) between 1 and 120),
  account_details jsonb not null default '{}'::jsonb,
  is_default      boolean not null default false,
  is_verified     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 12) creator_withdrawals — payout requests (creator requests via RPC only;
--     admin approves/rejects; real money transfer is manual/external)
-- ----------------------------------------------------------------------------
create table if not exists public.creator_withdrawals (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references public.creators(id) on delete cascade,
  payout_method_id uuid not null references public.payout_methods(id) on delete restrict,
  amount_usd       numeric(12,2) not null check (amount_usd > 0),
  status           text not null default 'REQUESTED'
                     check (status in ('REQUESTED','APPROVED','PROCESSING','COMPLETED','REJECTED','CANCELLED')),
  admin_note       text,
  requested_at     timestamptz not null default now(),
  processed_by     uuid references public.admin_users(user_id) on delete set null,
  processed_at     timestamptz,
  transaction_ref  text
);

-- ledger.withdrawal_id -> withdrawals (added now that the table exists)
do $$
begin
  alter table public.creator_earnings_ledger
    add constraint fk_ledger_withdrawal
    foreign key (withdrawal_id) references public.creator_withdrawals(id)
    on delete set null;
exception
  when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- 13) creator_strikes — copyright/community strike ladder
-- ----------------------------------------------------------------------------
create table if not exists public.creator_strikes (
  id         uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  video_id   uuid references public.creator_videos(id) on delete set null,
  severity   text not null default 'WARNING'
               check (severity in ('WARNING','STRIKE_1','STRIKE_2','STRIKE_3')),
  reason     text not null check (char_length(reason) between 3 and 500),
  details    text,
  issued_by  uuid references public.admin_users(user_id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 14) copyright_reports — anyone (incl. anonymous) can report; admin resolves
-- ----------------------------------------------------------------------------
create table if not exists public.copyright_reports (
  id                uuid primary key default gen_random_uuid(),
  video_id          uuid not null references public.creator_videos(id) on delete cascade,
  reporter_user_id  uuid references auth.users(id) on delete set null,
  reporter_name     text,
  reporter_email    citext,
  claim_type        text not null default 'COPYRIGHT' check (claim_type in ('COPYRIGHT','OTHER_LEGAL')),
  original_work_url text,
  details           text not null check (char_length(details) between 10 and 5000),
  status            text not null default 'OPEN'
                      check (status in ('OPEN','REVIEWING','UPHELD','DISMISSED')),
  resolved_by       uuid references public.admin_users(user_id) on delete set null,
  resolution_note   text,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 15) creator_notifications — inbox for creator events (auto-generated by
--     triggers + service role; creator can only mark as read)
-- ----------------------------------------------------------------------------
create table if not exists public.creator_notifications (
  id         uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  notif_type text not null check (notif_type in
               ('VIDEO_APPROVED','VIDEO_REJECTED','VIDEO_TAKEN_DOWN','STRIKE_ISSUED',
                'COPYRIGHT_REPORT','MONETIZATION','WITHDRAWAL','SYSTEM')),
  title      text not null check (char_length(title) between 1 and 200),
  body       text,
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- SECTION 3 — CONFIG TABLES: app_settings + feature_flags (+ spec seeds)
-- ============================================================================

create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  description text not null default '',
  updated_by  uuid references public.admin_users(user_id) on delete set null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text not null default '',
  updated_at  timestamptz not null default now()
);

-- Feature flag lookup helper (defined HERE, after feature_flags exists —
-- SQL-language functions validate table references at CREATE time).
create or replace function public.flag_enabled(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select f.enabled from public.feature_flags f where f.key = p_key),
    false
  );
$$;

-- Monetization + access configuration (spec defaults; admin-editable, never
-- hardcoded in application code). Numbers stored as jsonb numbers.
insert into public.app_settings (key, value, description) values
  ('MIN_ELIGIBLE_VIEWS',           '10000', 'Minimum VALID views before a creator becomes monetization-eligible'),
  ('PAYOUT_PER_10000_VALID_VIEWS', '5.00',  'USD per 10,000 valid views (ESTIMATED earnings only - never a guarantee)'),
  ('MINIMUM_WITHDRAWAL_USD',       '15.00', 'Minimum withdrawal request amount in USD'),
  ('FREE_ACCESS_PERCENTAGE',       '50',    'Percentage of content offered free (admin-configurable split)'),
  ('PAID_ACCESS_PERCENTAGE',       '50',    'Percentage of content offered paid (admin-configurable split)'),
  ('FREE_ACCESS_DURATION_DAYS',    '2',     'Days a PAID item stays free-to-watch before the paywall starts'),
  ('VIEW_MIN_WATCH_SECONDS',       '30',    'Minimum watched seconds for a view to be considered valid')
on conflict (key) do nothing;

-- Feature flags (spec). Hub architecture open for dev/admin testing;
-- commercial money paths stay OFF until an admin flips them deliberately.
insert into public.feature_flags (key, enabled, description) values
  ('CREATOR_HUB_ENABLED',          true,  'Master switch for the entire Creator Hub'),
  ('CREATOR_UPLOAD_ENABLED',       true,  'Creator video/short upload enabled'),
  ('CREATOR_MONETIZATION_ENABLED', false, 'Earnings accrual enabled (estimated earnings)'),
  ('PAYOUTS_ENABLED',              false, 'Real payout processing - NEVER auto-activated'),
  ('PAID_CONTENT_ENABLED',         false, 'Paid/premium content gating enabled')
on conflict (key) do nothing;

-- ============================================================================
-- SECTION 4 — INDEXES (FK coverage + hot query paths)
-- ============================================================================

create index if not exists idx_creators_status          on public.creators (status);
create index if not exists idx_creators_user            on public.creators (user_id);

create index if not exists idx_creator_videos_creator   on public.creator_videos (creator_id, created_at desc);
create index if not exists idx_creator_videos_status    on public.creator_videos (status, published_at desc);
create index if not exists idx_creator_videos_category  on public.creator_videos (category_id);
create index if not exists idx_creator_videos_type      on public.creator_videos (content_type, status);
create index if not exists idx_creator_videos_access    on public.creator_videos (access_type, free_until);
create index if not exists idx_creator_videos_pending   on public.creator_videos (created_at asc)
  where status = 'PENDING_REVIEW';

create index if not exists idx_followers_creator        on public.creator_followers (creator_id, created_at desc);
create index if not exists idx_followers_follower       on public.creator_followers (follower_user_id);

create index if not exists idx_watch_sessions_video     on public.video_watch_sessions (video_id, started_at desc);
create index if not exists idx_watch_sessions_viewer    on public.video_watch_sessions (viewer_user_id);
create index if not exists idx_watch_sessions_skey      on public.video_watch_sessions (viewer_session_key);
create index if not exists idx_watch_sessions_suspicious on public.video_watch_sessions (is_suspicious, started_at desc);

create index if not exists idx_video_views_video_day    on public.video_views (video_id, view_date);
create index if not exists idx_video_views_creator_day  on public.video_views (creator_id, view_date);
create index if not exists idx_video_views_viewer       on public.video_views (viewer_user_id);
create index if not exists idx_video_views_viewer_key   on public.video_views (viewer_key, created_at desc);
create index if not exists idx_video_views_invalid      on public.video_views (is_valid, created_at desc);

create index if not exists idx_engagements_video        on public.video_engagements (video_id, created_at desc);
create index if not exists idx_engagements_user         on public.video_engagements (user_id);
create index if not exists idx_engagements_video_type   on public.video_engagements (video_id, engagement_type);
create index if not exists idx_engagements_parent       on public.video_engagements (parent_comment_id);

create index if not exists idx_ledger_creator           on public.creator_earnings_ledger (creator_id, created_at desc);
create index if not exists idx_ledger_withdrawal        on public.creator_earnings_ledger (withdrawal_id);

create index if not exists idx_payout_methods_creator   on public.payout_methods (creator_id);

create index if not exists idx_withdrawals_creator      on public.creator_withdrawals (creator_id, requested_at desc);
create index if not exists idx_withdrawals_status       on public.creator_withdrawals (status, requested_at asc);

create index if not exists idx_strikes_creator          on public.creator_strikes (creator_id, created_at desc);
create index if not exists idx_strikes_video            on public.creator_strikes (video_id);

create index if not exists idx_copyright_video          on public.copyright_reports (video_id, created_at desc);
create index if not exists idx_copyright_status         on public.copyright_reports (status, created_at asc);

create index if not exists idx_notifications_creator    on public.creator_notifications (creator_id, created_at desc);
create index if not exists idx_notifications_unread     on public.creator_notifications (creator_id, created_at desc)
  where read_at is null;

-- ============================================================================
-- SECTION 5 — SECURITY TRIGGER FUNCTIONS
-- ============================================================================

-- Guard creators table: non-admins cannot change user_id / status /
-- strike_count on their own row (prevents self-activating to ACTIVE).
create or replace function public.tg_creator_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_service_role() or public.is_admin()) then
    new.user_id      := old.user_id;
    new.status       := old.status;
    new.strike_count := old.strike_count;
  end if;
  return new;
end;
$$;

-- Guard creator_videos BEFORE INSERT: creators always start at DRAFT and can
-- never seed counters / moderation fields. Server-side metadata validation:
-- media_url required before submitting for review.
create or replace function public.tg_video_insert_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_service_role() or public.is_admin()) then
    new.status           := 'DRAFT';
    new.view_count       := 0;
    new.valid_view_count := 0;
    new.like_count       := 0;
    new.comment_count    := 0;
    new.reviewed_by      := null;
    new.reviewed_at      := null;
    new.published_at     := null;
    new.taken_down_at    := null;
    new.free_until       := null;
  end if;

  if new.status = 'PENDING_REVIEW' and (new.media_url is null or new.media_url = '') then
    raise exception 'CREATOR_HUB: media_url is required before submitting for review';
  end if;

  return new;
end;
$$;

-- Guard creator_videos BEFORE UPDATE (the heart of the state machine):
--  * creators CANNOT touch counters / moderation bookkeeping
--  * creators CANNOT set PUBLISHED / REJECTED / TAKEN_DOWN (admin-only)
--  * creators CAN: DRAFT <-> PENDING_REVIEW, REJECTED -> DRAFT
--    (but TAKEN_DOWN content can never be resubmitted)
--  * rejection requires a reason (admin accountability)
create or replace function public.tg_video_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_service_role() or public.is_admin()) then
    -- immutable fields for creators
    new.view_count       := old.view_count;
    new.valid_view_count := old.valid_view_count;
    new.like_count       := old.like_count;
    new.comment_count    := old.comment_count;
    new.reviewed_by      := old.reviewed_by;
    new.reviewed_at      := old.reviewed_at;
    new.published_at     := old.published_at;
    new.taken_down_at    := old.taken_down_at;
    new.free_until       := old.free_until;

    if old.status is distinct from new.status then
      if new.status in ('PUBLISHED','REJECTED','TAKEN_DOWN') then
        raise exception 'CREATOR_HUB: only admins can moderate videos (% -> %)', old.status, new.status;
      end if;
      if new.status not in ('DRAFT','PENDING_REVIEW') then
        raise exception 'CREATOR_HUB: invalid status transition % -> %', old.status, new.status;
      end if;
      if old.status = 'TAKEN_DOWN' then
        raise exception 'CREATOR_HUB: taken-down videos cannot be resubmitted';
      end if;
    end if;
  else
    -- admin / service-role moderation bookkeeping
    if old.status is distinct from new.status then
      if new.status = 'PUBLISHED' and new.published_at is null then
        new.published_at := now();
      end if;
      if new.status = 'TAKEN_DOWN' then
        new.taken_down_at := now();
      end if;
      if new.status in ('PUBLISHED','REJECTED','TAKEN_DOWN') and new.reviewed_by is null then
        new.reviewed_by := auth.uid();
      end if;
    end if;
  end if;

  if new.status = 'PENDING_REVIEW' and (new.media_url is null or new.media_url = '') then
    raise exception 'CREATOR_HUB: media_url is required before submitting for review';
  end if;

  if new.status = 'REJECTED' and (new.rejection_reason is null or new.rejection_reason = '') then
    raise exception 'CREATOR_HUB: rejection_reason is required when rejecting a video';
  end if;

  return new;
end;
$$;

-- Notifications to the creator when moderation status changes.
create or replace function public.tg_video_moderation_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    if new.status = 'PUBLISHED' then
      insert into public.creator_notifications (creator_id, notif_type, title, body, data)
      values (new.creator_id, 'VIDEO_APPROVED', 'Video published',
              'Your video "' || new.title || '" is now live.',
              jsonb_build_object('video_id', new.id));
    elsif new.status = 'REJECTED' then
      insert into public.creator_notifications (creator_id, notif_type, title, body, data)
      values (new.creator_id, 'VIDEO_REJECTED', 'Video rejected',
              coalesce(new.rejection_reason, 'Your video "' || new.title || '" did not pass review.'),
              jsonb_build_object('video_id', new.id));
    elsif new.status = 'TAKEN_DOWN' then
      insert into public.creator_notifications (creator_id, notif_type, title, body, data)
      values (new.creator_id, 'VIDEO_TAKEN_DOWN', 'Video taken down',
              'Your video "' || new.title || '" was taken down for policy/copyright reasons.',
              jsonb_build_object('video_id', new.id));
    end if;
  end if;
  return new;
end;
$$;

-- Keep denormalized like/comment counters in sync with engagements.
create or replace function public.tg_engagement_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_video uuid;
  v_kind  text;
  v_delta int := 0;
begin
  if tg_op = 'INSERT' then
    v_video := new.video_id;
    v_kind  := new.engagement_type;
    v_delta := 1;
    if new.engagement_type = 'COMMENT' and new.is_hidden then
      v_delta := 0;
    end if;
  elsif tg_op = 'DELETE' then
    v_video := old.video_id;
    v_kind  := old.engagement_type;
    v_delta := -1;
    if old.engagement_type = 'COMMENT' and old.is_hidden then
      v_delta := 0;
    end if;
  else -- UPDATE
    v_video := new.video_id;
    v_kind  := new.engagement_type;
    if old.is_hidden <> new.is_hidden and new.engagement_type = 'COMMENT' then
      v_delta := case when new.is_hidden then -1 else 1 end;
    end if;
  end if;

  if v_delta <> 0 and v_kind = 'LIKE' then
    update public.creator_videos
       set like_count = greatest(like_count + v_delta, 0)
     where id = v_video;
  elsif v_delta <> 0 and v_kind = 'COMMENT' then
    update public.creator_videos
       set comment_count = greatest(comment_count + v_delta, 0)
     where id = v_video;
  end if;

  return coalesce(new, old);
end;
$$;

-- Bootstrap side effects when a creator row is created.
create or replace function public.tg_creator_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.creator_earnings (creator_id) values (new.id)
  on conflict (creator_id) do nothing;

  insert into public.creator_notifications (creator_id, notif_type, title, body)
  values (new.id, 'SYSTEM', 'Welcome to Creator Hub',
          'Your creator account was created and is pending admin approval.');

  return new;
end;
$$;

-- Notifications: creators may ONLY flip read_at (guard clamps everything else).
create or replace function public.tg_notification_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_service_role() or public.is_admin()) then
    new.creator_id := old.creator_id;
    new.notif_type := old.notif_type;
    new.title      := old.title;
    new.body       := old.body;
    new.data       := old.data;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- SECTION 6 — TRIGGER WIRING
-- ============================================================================

-- updated_at maintenance
do $$
declare t text;
begin
  foreach t in array array[
    'creators','creator_profiles','creator_categories','creator_videos',
    'video_engagements','creator_earnings','payout_methods',
    'copyright_reports','app_settings','feature_flags'
  ] loop
    execute format('drop trigger if exists t_set_updated_at on public.%I', t);
    execute format(
      'create trigger t_set_updated_at before update on public.%I
         for each row execute function public.th_set_updated_at()', t);
  end loop;
end $$;

-- creators
drop trigger if exists t_creator_update_guard on public.creators;
create trigger t_creator_update_guard before update on public.creators
  for each row execute function public.tg_creator_update_guard();

drop trigger if exists t_creator_after_insert on public.creators;
create trigger t_creator_after_insert after insert on public.creators
  for each row execute function public.tg_creator_after_insert();

-- creator_videos
drop trigger if exists t_video_insert_guard on public.creator_videos;
create trigger t_video_insert_guard before insert on public.creator_videos
  for each row execute function public.tg_video_insert_guard();

drop trigger if exists t_video_update_guard on public.creator_videos;
create trigger t_video_update_guard before update on public.creator_videos
  for each row execute function public.tg_video_update_guard();

drop trigger if exists t_video_moderation_notify on public.creator_videos;
create trigger t_video_moderation_notify after update on public.creator_videos
  for each row execute function public.tg_video_moderation_notify();

-- video_engagements
drop trigger if exists t_engagement_counters on public.video_engagements;
create trigger t_engagement_counters after insert or update or delete on public.video_engagements
  for each row execute function public.tg_engagement_counters();

-- creator_notifications
drop trigger if exists t_notification_update_guard on public.creator_notifications;
create trigger t_notification_update_guard before update on public.creator_notifications
  for each row execute function public.tg_notification_update_guard();

-- ============================================================================
-- SECTION 7 — ROW LEVEL SECURITY
-- Principle: creators own their rows; counters/money are read-only for
-- creators; moderation is admin-only; anon gets read-only public surfaces.
-- (service_role bypasses RLS by design; SRK stays server-side only)
-- ============================================================================

alter table public.creators               enable row level security;
alter table public.creator_profiles       enable row level security;
alter table public.creator_categories     enable row level security;
alter table public.creator_videos         enable row level security;
alter table public.creator_followers      enable row level security;
alter table public.video_watch_sessions   enable row level security;
alter table public.video_views            enable row level security;
alter table public.video_engagements      enable row level security;
alter table public.creator_earnings       enable row level security;
alter table public.creator_earnings_ledger enable row level security;
alter table public.payout_methods         enable row level security;
alter table public.creator_withdrawals    enable row level security;
alter table public.creator_strikes        enable row level security;
alter table public.copyright_reports      enable row level security;
alter table public.creator_notifications  enable row level security;
alter table public.app_settings           enable row level security;
alter table public.feature_flags          enable row level security;

-- ---------------- creators ----------------
drop policy if exists th_creators_read on public.creators;
create policy th_creators_read on public.creators
  for select to anon, authenticated
  using (status = 'ACTIVE' or user_id = auth.uid() or public.is_admin());

drop policy if exists th_creators_insert on public.creators;
create policy th_creators_insert on public.creators
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists th_creators_update_owner on public.creators;
create policy th_creators_update_owner on public.creators
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists th_creators_update_admin on public.creators;
create policy th_creators_update_admin on public.creators
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------- creator_profiles ----------------
drop policy if exists th_profiles_read on public.creator_profiles;
create policy th_profiles_read on public.creator_profiles
  for select to anon, authenticated
  using (
    is_public = true
    or exists (select 1 from public.creators c
               where c.id = creator_profiles.creator_id and c.user_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists th_profiles_insert on public.creator_profiles;
create policy th_profiles_insert on public.creator_profiles
  for insert to authenticated
  with check (exists (select 1 from public.creators c
                      where c.id = creator_profiles.creator_id and c.user_id = auth.uid()));

drop policy if exists th_profiles_update_owner on public.creator_profiles;
create policy th_profiles_update_owner on public.creator_profiles
  for update to authenticated
  using (exists (select 1 from public.creators c
                 where c.id = creator_profiles.creator_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.creators c
                      where c.id = creator_profiles.creator_id and c.user_id = auth.uid()));

drop policy if exists th_profiles_update_admin on public.creator_profiles;
create policy th_profiles_update_admin on public.creator_profiles
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------- creator_categories ----------------
drop policy if exists th_categories_read on public.creator_categories;
create policy th_categories_read on public.creator_categories
  for select to anon, authenticated using (true);

drop policy if exists th_categories_write on public.creator_categories;
create policy th_categories_write on public.creator_categories
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------- creator_videos ----------------
drop policy if exists th_videos_read on public.creator_videos;
create policy th_videos_read on public.creator_videos
  for select to anon, authenticated
  using (
    status = 'PUBLISHED'
    or exists (select 1 from public.creators c
               where c.id = creator_videos.creator_id and c.user_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists th_videos_insert_owner on public.creator_videos;
create policy th_videos_insert_owner on public.creator_videos
  for insert to authenticated
  with check (exists (select 1 from public.creators c
                      where c.id = creator_videos.creator_id and c.user_id = auth.uid()));

drop policy if exists th_videos_update_owner on public.creator_videos;
create policy th_videos_update_owner on public.creator_videos
  for update to authenticated
  using (exists (select 1 from public.creators c
                 where c.id = creator_videos.creator_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.creators c
                      where c.id = creator_videos.creator_id and c.user_id = auth.uid()));

drop policy if exists th_videos_update_admin on public.creator_videos;
create policy th_videos_update_admin on public.creator_videos
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists th_videos_delete_owner on public.creator_videos;
create policy th_videos_delete_owner on public.creator_videos
  for delete to authenticated
  using (
    exists (select 1 from public.creators c
            where c.id = creator_videos.creator_id and c.user_id = auth.uid())
    and status in ('DRAFT','REJECTED')
  );

drop policy if exists th_videos_delete_admin on public.creator_videos;
create policy th_videos_delete_admin on public.creator_videos
  for delete to authenticated
  using (public.is_admin());

-- ---------------- creator_followers ----------------
drop policy if exists th_followers_read on public.creator_followers;
create policy th_followers_read on public.creator_followers
  for select to anon, authenticated using (true);

drop policy if exists th_followers_insert on public.creator_followers;
create policy th_followers_insert on public.creator_followers
  for insert to authenticated
  with check (follower_user_id = auth.uid());

drop policy if exists th_followers_delete_own on public.creator_followers;
create policy th_followers_delete_own on public.creator_followers
  for delete to authenticated
  using (follower_user_id = auth.uid() or public.is_admin());

-- ---------------- video_watch_sessions ----------------
-- insert: authenticated viewers record their own sessions (raw data, not views)
-- select: admin only (fraud review). updates/flags: service role only.
drop policy if exists th_watch_sessions_insert on public.video_watch_sessions;
create policy th_watch_sessions_insert on public.video_watch_sessions
  for insert to authenticated
  with check (viewer_user_id = auth.uid());

drop policy if exists th_watch_sessions_admin_read on public.video_watch_sessions;
create policy th_watch_sessions_admin_read on public.video_watch_sessions
  for select to authenticated
  using (public.is_admin());

-- ---------------- video_views ----------------
-- THE counted-view table: NO client insert/update policies at all.
-- Only the server (service role) writes views after validation.
-- Creator can read raw view rows for OWN videos (analytics); admin reads all.
drop policy if exists th_video_views_creator_read on public.video_views;
create policy th_video_views_creator_read on public.video_views
  for select to authenticated
  using (exists (select 1 from public.creators c
                 where c.id = video_views.creator_id and c.user_id = auth.uid()));

drop policy if exists th_video_views_admin_read on public.video_views;
create policy th_video_views_admin_read on public.video_views
  for select to authenticated
  using (public.is_admin());

-- ---------------- video_engagements ----------------
drop policy if exists th_engagements_read on public.video_engagements;
create policy th_engagements_read on public.video_engagements
  for select to anon, authenticated
  using (
    (exists (select 1 from public.creator_videos v
             where v.id = video_engagements.video_id and v.status = 'PUBLISHED')
     and is_hidden = false)
    or user_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists th_engagements_insert on public.video_engagements;
create policy th_engagements_insert on public.video_engagements
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (engagement_type = 'LIKE'
         or (engagement_type = 'COMMENT' and comment_text is not null))
  );

drop policy if exists th_engagements_update_own on public.video_engagements;
create policy th_engagements_update_own on public.video_engagements
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists th_engagements_update_admin on public.video_engagements;
create policy th_engagements_update_admin on public.video_engagements
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists th_engagements_delete_own on public.video_engagements;
create policy th_engagements_delete_own on public.video_engagements
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------- creator_earnings (read-only for creator) ----------------
drop policy if exists th_earnings_read on public.creator_earnings;
create policy th_earnings_read on public.creator_earnings
  for select to authenticated
  using (exists (select 1 from public.creators c
                 where c.id = creator_earnings.creator_id and c.user_id = auth.uid())
         or public.is_admin());

-- ---------------- creator_earnings_ledger (read-only for creator) ----------
drop policy if exists th_ledger_read on public.creator_earnings_ledger;
create policy th_ledger_read on public.creator_earnings_ledger
  for select to authenticated
  using (exists (select 1 from public.creators c
                 where c.id = creator_earnings_ledger.creator_id and c.user_id = auth.uid())
         or public.is_admin());

-- ---------------- payout_methods (owner CRUD, admin read) ----------------
drop policy if exists th_payout_methods_owner on public.payout_methods;
create policy th_payout_methods_owner on public.payout_methods
  for all to authenticated
  using (exists (select 1 from public.creators c
                 where c.id = payout_methods.creator_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.creators c
                      where c.id = payout_methods.creator_id and c.user_id = auth.uid()));

drop policy if exists th_payout_methods_admin on public.payout_methods;
create policy th_payout_methods_admin on public.payout_methods
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------- creator_withdrawals ----------------
-- Requests are created ONLY via request_creator_withdrawal() RPC (balance
-- checks + ledger). No client insert policy. Admin updates status.
drop policy if exists th_withdrawals_read on public.creator_withdrawals;
create policy th_withdrawals_read on public.creator_withdrawals
  for select to authenticated
  using (exists (select 1 from public.creators c
                 where c.id = creator_withdrawals.creator_id and c.user_id = auth.uid())
         or public.is_admin());

drop policy if exists th_withdrawals_admin_update on public.creator_withdrawals;
create policy th_withdrawals_admin_update on public.creator_withdrawals
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------- creator_strikes (read-only for creator) ----------------
drop policy if exists th_strikes_read on public.creator_strikes;
create policy th_strikes_read on public.creator_strikes
  for select to authenticated
  using (exists (select 1 from public.creators c
                 where c.id = creator_strikes.creator_id and c.user_id = auth.uid())
         or public.is_admin());

-- ---------------- copyright_reports ----------------
drop policy if exists th_copyright_insert on public.copyright_reports;
create policy th_copyright_insert on public.copyright_reports
  for insert to anon, authenticated
  with check (
    video_id is not null
    and details is not null
    and status = 'OPEN'
  );

drop policy if exists th_copyright_read on public.copyright_reports;
create policy th_copyright_read on public.copyright_reports
  for select to authenticated
  using (
    public.is_admin()
    or reporter_user_id = auth.uid()
    or exists (select 1 from public.creators c
               join public.creator_videos v on v.id = copyright_reports.video_id
               where c.id = v.creator_id and c.user_id = auth.uid())
  );

drop policy if exists th_copyright_admin_update on public.copyright_reports;
create policy th_copyright_admin_update on public.copyright_reports
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------- creator_notifications ----------------
drop policy if exists th_notifications_read on public.creator_notifications;
create policy th_notifications_read on public.creator_notifications
  for select to authenticated
  using (exists (select 1 from public.creators c
                 where c.id = creator_notifications.creator_id and c.user_id = auth.uid())
         or public.is_admin());

drop policy if exists th_notifications_mark_read on public.creator_notifications;
create policy th_notifications_mark_read on public.creator_notifications
  for update to authenticated
  using (exists (select 1 from public.creators c
                 where c.id = creator_notifications.creator_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.creators c
                      where c.id = creator_notifications.creator_id and c.user_id = auth.uid()));

-- ---------------- app_settings / feature_flags ----------------
drop policy if exists th_settings_read on public.app_settings;
create policy th_settings_read on public.app_settings
  for select to authenticated using (true);

drop policy if exists th_settings_admin on public.app_settings;
create policy th_settings_admin on public.app_settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists th_flags_read on public.feature_flags;
create policy th_flags_read on public.feature_flags
  for select to authenticated using (true);

drop policy if exists th_flags_admin on public.feature_flags;
create policy th_flags_admin on public.feature_flags
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- SECTION 8 — ANALYTICS VIEWS (RLS-aware via security_invoker)
-- ============================================================================

create or replace view public.creator_video_daily_analytics
with (security_invoker = on) as
select
  vv.creator_id,
  vv.video_id,
  vv.view_date,
  count(*)::bigint                                        as total_view_events,
  count(*) filter (where vv.is_valid)::bigint             as valid_views,
  coalesce(sum(vv.watched_seconds), 0)::bigint            as watched_seconds,
  count(*) filter (where not vv.is_valid)::bigint         as rejected_view_events
from public.video_views vv
group by vv.creator_id, vv.video_id, vv.view_date;

create or replace view public.creator_follower_counts
with (security_invoker = on) as
select
  f.creator_id,
  count(*)::bigint as follower_count
from public.creator_followers f
group by f.creator_id;

-- ============================================================================
-- SECTION 9 — MONEY / VIEWS RPCs (server-orchestrated; flags honored here)
-- ============================================================================

-- Accrue valid views for a video (called by the SERVER after validation):
--  * always bumps video.valid_view_count + lifetime creator valid_views
--  * only pays when CREATOR_MONETIZATION_ENABLED=true
--    AND creator is ACTIVE AND lifetime valid_views >= MIN_ELIGIBLE_VIEWS
--  * rate = app_settings.PAYOUT_PER_10000_VALID_VIEWS (USD per 10k)
--  * every credit writes an append-only ledger row with balance_after
create or replace function public.accrue_valid_views(
  p_video_id     uuid,
  p_valid_count  integer,
  p_watched_seconds integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_id     uuid;
  v_creator_status text;
  v_lifetime       bigint;
  v_min_views      numeric;
  v_rate           numeric;
  v_amount         numeric(12,2) := 0;
  v_balance        numeric(12,2);
  v_entry          numeric(12,2);
begin
  if p_valid_count is null or p_valid_count <= 0 then
    return;
  end if;

  select v.creator_id, c.status
    into v_creator_id, v_creator_status
  from public.creator_videos v
  join public.creators c on c.id = v.creator_id
  where v.id = p_video_id;

  if v_creator_id is null then
    raise exception 'CREATOR_HUB: video % not found', p_video_id;
  end if;

  update public.creator_videos
     set valid_view_count = valid_view_count + p_valid_count
   where id = p_video_id;

  update public.creator_earnings
     set valid_views = valid_views + p_valid_count,
         last_accrued_at = now()
   where creator_id = v_creator_id;

  if not public.flag_enabled('CREATOR_MONETIZATION_ENABLED') then
    return; -- analytics counted, no money while monetization is OFF
  end if;

  if v_creator_status <> 'ACTIVE' then
    return; -- only ACTIVE creators earn
  end if;

  select (s.value #>> '{}')::numeric into v_min_views
  from public.app_settings s where s.key = 'MIN_ELIGIBLE_VIEWS';

  select (s.value #>> '{}')::numeric into v_rate
  from public.app_settings s where s.key = 'PAYOUT_PER_10000_VALID_VIEWS';

  select valid_views into v_lifetime
  from public.creator_earnings where creator_id = v_creator_id;

  if coalesce(v_lifetime, 0) < coalesce(v_min_views, 0) then
    return; -- not yet eligible (e.g. < 10,000 valid views)
  end if;

  v_amount := round(p_valid_count * v_rate / 10000, 2);
  if v_amount <= 0 then
    return;
  end if;

  select available_balance_usd into v_balance
  from public.creator_earnings
  where creator_id = v_creator_id
  for update;

  v_entry := coalesce(v_balance, 0) + v_amount;

  update public.creator_earnings
     set estimated_earnings_usd = estimated_earnings_usd + v_amount,
         available_balance_usd  = available_balance_usd + v_amount,
         eligible_views         = eligible_views + p_valid_count
   where creator_id = v_creator_id;

  insert into public.creator_earnings_ledger
    (creator_id, entry_type, amount_usd, balance_after, video_id, description)
  values
    (v_creator_id, 'VIEW_REVENUE', v_amount, v_entry, p_video_id,
     'Estimated earnings for ' || p_valid_count || ' valid views (ESTIMATE ONLY)');
end;
$$;

-- Creator withdrawal request (invoked by the creator, enforced at DB level):
--  * PAYOUTS_ENABLED flag must be true
--  * amount >= MINIMUM_WITHDRAWAL_USD and <= available balance
--  * holds funds: balance -> pending_withdrawal, ledger WITHDRAWAL debit
create or replace function public.request_creator_withdrawal(
  p_amount           numeric,
  p_payout_method_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator uuid;
  v_balance numeric(12,2);
  v_min     numeric;
  v_id      uuid;
begin
  if not public.flag_enabled('PAYOUTS_ENABLED') then
    raise exception 'CREATOR_HUB: withdrawals are disabled (PAYOUTS_ENABLED=false)';
  end if;

  select c.id into v_creator
  from public.creators c
  where c.user_id = auth.uid() and c.status = 'ACTIVE';

  if v_creator is null then
    raise exception 'CREATOR_HUB: caller is not an ACTIVE creator';
  end if;

  select (s.value #>> '{}')::numeric into v_min
  from public.app_settings s where s.key = 'MINIMUM_WITHDRAWAL_USD';

  if p_amount is null or p_amount < coalesce(v_min, 0) then
    raise exception 'CREATOR_HUB: minimum withdrawal is % USD', coalesce(v_min, 0);
  end if;

  if not exists (select 1 from public.payout_methods m
                 where m.id = p_payout_method_id and m.creator_id = v_creator) then
    raise exception 'CREATOR_HUB: invalid payout method';
  end if;

  select available_balance_usd into v_balance
  from public.creator_earnings
  where creator_id = v_creator
  for update;

  if p_amount > coalesce(v_balance, 0) then
    raise exception 'CREATOR_HUB: insufficient available balance';
  end if;

  insert into public.creator_withdrawals
    (creator_id, payout_method_id, amount_usd, status)
  values
    (v_creator, p_payout_method_id, p_amount, 'REQUESTED')
  returning id into v_id;

  update public.creator_earnings
     set available_balance_usd  = available_balance_usd - p_amount,
         pending_withdrawal_usd = pending_withdrawal_usd + p_amount
   where creator_id = v_creator;

  insert into public.creator_earnings_ledger
    (creator_id, entry_type, amount_usd, balance_after, withdrawal_id, description)
  values
    (v_creator, 'WITHDRAWAL', -p_amount, coalesce(v_balance, 0) - p_amount, v_id,
     'Withdrawal request held pending admin review');

  return v_id;
end;
$$;

-- Lock down who can call the money RPCs.
revoke execute on function public.accrue_valid_views(uuid, integer, integer) from public, anon, authenticated;
grant  execute on function public.accrue_valid_views(uuid, integer, integer) to service_role;

revoke execute on function public.request_creator_withdrawal(numeric, uuid) from public, anon;
grant  execute on function public.request_creator_withdrawal(numeric, uuid) to authenticated;

-- ============================================================================
-- SECTION 10 — STORAGE: private 'creator-media' bucket
-- Uploads go to creator_id/... prefix; playback/thumbnails via signed URLs.
-- (existing 'catalog-cache' bucket is NOT touched)
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creator-media', 'creator-media', false, 2147483648,
  array['video/mp4','video/webm','video/quicktime','image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists th_creator_media_insert on storage.objects;
create policy th_creator_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'creator-media'
    and (storage.foldername(name))[1] in (
      select c.id::text from public.creators c where c.user_id = auth.uid()
    )
  );

drop policy if exists th_creator_media_read on storage.objects;
create policy th_creator_media_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'creator-media'
    and (
      (storage.foldername(name))[1] in (
        select c.id::text from public.creators c where c.user_id = auth.uid()
      )
      or public.is_admin()
    )
  );

drop policy if exists th_creator_media_update on storage.objects;
create policy th_creator_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'creator-media'
    and (storage.foldername(name))[1] in (
      select c.id::text from public.creators c where c.user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'creator-media'
    and (storage.foldername(name))[1] in (
      select c.id::text from public.creators c where c.user_id = auth.uid()
    )
  );

drop policy if exists th_creator_media_delete on storage.objects;
create policy th_creator_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'creator-media'
    and (
      (storage.foldername(name))[1] in (
        select c.id::text from public.creators c where c.user_id = auth.uid()
      )
      or public.is_admin()
    )
  );

-- ============================================================================
-- SECTION 11 — API EXPOSURE (keep private internals out of PostgREST)
-- ============================================================================
-- sensitives stay server-side; expose only what the hub UI needs.

revoke all on function public.accrue_valid_views(uuid, integer, integer) from anon;
revoke all on function public.is_service_role() from public, anon, authenticated;

commit;

-- ============================================================================
-- POST-APPLY CHECKLIST (admin)
--   1. Create admin user(s) in Supabase Auth, then insert their ids:
--        insert into public.admin_users (user_id, email, note)
--        values ('<auth-user-uuid>', 'you@example.com', 'owner');
--   2. Approve test creator: update public.creators set status='ACTIVE' where handle='...';
--   3. For the admin test flow temporarily flip flags:
--        update public.feature_flags set enabled=true where key in
--          ('CREATOR_MONETIZATION_ENABLED','PAYOUTS_ENABLED','PAID_CONTENT_ENABLED');
--      ...run the test, then set them back to false before going commercial.
--   4. View counting is server-side: insert into video_views via SRK after
--      validation, or rely on accrue_valid_views() RPC from the serverless API.
-- ============================================================================
