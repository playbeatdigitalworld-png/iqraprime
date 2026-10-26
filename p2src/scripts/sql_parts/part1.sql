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
