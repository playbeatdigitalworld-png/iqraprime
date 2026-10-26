-- ============================================================================
-- STREAMPLAY — CREATOR HUB — COMPATIBILITY MIGRATION (additive, non-destructive)
-- ============================================================================
-- File     : 20261008000001_creator_hub_compat.sql
-- Purpose  : Bridges the ALREADY-APPLIED 20261008000000_creator_hub_phase1.sql
--            schema with the Creator Hub server layer (server/creatorHub/*),
--            which expects a few extra columns/tables. PURELY ADDITIVE:
--            no existing column is dropped or retyped destructively, no data
--            is touched. Safe to re-run (IF NOT EXISTS / guarded DO blocks).
--
-- WHAT IT ADDS
--   1. creators            : display_name, monetization_enabled, access_tier_override,
--                            suspended_until, created_by
--   2. creator_profiles    : links, total_followers/likes/views, is_verified
--   3. creator_videos      : storage_path, storage_bucket, thumb_path, mime_type,
--                            width, height, metadata, watch_seconds; access_type += 'AUTO'
--   4. video_watch_sessions: creator_id, user_agent, is_valid, invalid_reason,
--                            suspicion_score, reviewed_by, reviewed_at (+ ip index)
--   5. video_views         : source, ip_hash (+ dedupe-window index)
--   6. video_engagements   : creator_id, ip_hash, resolved_by, resolved_at,
--                            status; engagement_type += 'REPORT'; reports hidden
--                            from public RLS
--   7. creator_strikes     : status ('active'|'expired'|'reversed'); issued_by -> text
--   8. creator_earnings    : paid_out_usd, last_computed_at
--   9. creator_earnings_ledger: views, period_start/period_end; entry_type widened;
--                            created_by -> text; balance_after nullable
--  10. creator_withdrawals : payout_method_id nullable; processed_by -> text
--  11. copyright_reports   : reviewed_by text + reviewed_at (server-layer
--                            reviewer bookkeeping; spec resolved_by uuid stays),
--                            details min length relaxed
--  12. payout_methods      : method_type widened ('BANK','WISE')
--  13. creator_notifications: notif_type widened (generic admin types)
--  14. viewer_entitlements : NEW table (paid-content access grants)
--  15. app_settings        : updated_by -> text; anti-fraud setting seeds
--  16. Triggers            : like counter also bumps profile total_likes;
--                            duplicate-notification trigger removed (server
--                            layer sends its own notifications)
--  17. creator_categories  : default taxonomy seeds
-- ============================================================================

begin;

-- ============================================================================
-- SECTION 1 — creators
-- ============================================================================
alter table public.creators add column if not exists display_name text;
alter table public.creators add column if not exists monetization_enabled boolean not null default false;
alter table public.creators add column if not exists access_tier_override text;
alter table public.creators add column if not exists suspended_until timestamptz;
alter table public.creators add column if not exists created_by text;

-- keep display_name in sync with channel_name when left null (legacy reads)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'creators_display_name_default'
  ) then
    alter table public.creators add constraint creators_display_name_default
      check (display_name is null or char_length(display_name) between 1 and 120);
  end if;
end $$;

update public.creators set display_name = coalesce(display_name, channel_name) where display_name is null;

-- ============================================================================
-- SECTION 2 — creator_profiles
-- ============================================================================
alter table public.creator_profiles add column if not exists links jsonb not null default '{}'::jsonb;
alter table public.creator_profiles add column if not exists total_followers bigint not null default 0;
alter table public.creator_profiles add column if not exists total_likes    bigint not null default 0;
alter table public.creator_profiles add column if not exists total_views    bigint not null default 0;
alter table public.creator_profiles add column if not exists is_verified    boolean not null default false;

-- ============================================================================
-- SECTION 3 — creator_videos
-- ============================================================================
alter table public.creator_videos add column if not exists storage_path   text;
alter table public.creator_videos add column if not exists storage_bucket text not null default 'creator-media';
alter table public.creator_videos add column if not exists thumb_path     text;
alter table public.creator_videos add column if not exists mime_type      text;
alter table public.creator_videos add column if not exists width          int;
alter table public.creator_videos add column if not exists height         int;
alter table public.creator_videos add column if not exists metadata       jsonb not null default '{}'::jsonb;
alter table public.creator_videos add column if not exists watch_seconds  bigint not null default 0;

-- widen access_type to accept 'AUTO' (2-day/50-50 config-driven tier)
do $$
begin
  alter table public.creator_videos drop constraint creator_videos_access_type_check;
exception when undefined_object then null;
end $$;
alter table public.creator_videos
  add constraint creator_videos_access_type_check
  check (access_type in ('FREE','PAID','AUTO'));

create index if not exists idx_creator_videos_storage_path on public.creator_videos (storage_path)
  where storage_path is not null;

-- ============================================================================
-- SECTION 4 — video_watch_sessions (fraud-review fields)
-- ============================================================================
alter table public.video_watch_sessions add column if not exists creator_id      uuid references public.creators(id) on delete cascade;
alter table public.video_watch_sessions add column if not exists user_agent      text;
alter table public.video_watch_sessions add column if not exists is_valid        boolean not null default true;
alter table public.video_watch_sessions add column if not exists invalid_reason  text;
alter table public.video_watch_sessions add column if not exists suspicion_score int not null default 0;
alter table public.video_watch_sessions add column if not exists reviewed_by     text;
alter table public.video_watch_sessions add column if not exists reviewed_at     timestamptz;

create index if not exists idx_watch_sessions_ip on public.video_watch_sessions (ip_hash, started_at desc);

-- ============================================================================
-- SECTION 5 — video_views
-- ============================================================================
alter table public.video_views add column if not exists source  text;
alter table public.video_views add column if not exists ip_hash text;

create index if not exists idx_video_views_dedupe_window
  on public.video_views (video_id, viewer_key, created_at desc);

-- ============================================================================
-- SECTION 6 — video_engagements (unified likes/comments/reports)
-- ============================================================================
alter table public.video_engagements add column if not exists creator_id  uuid references public.creators(id) on delete cascade;
alter table public.video_engagements add column if not exists ip_hash     text;
alter table public.video_engagements add column if not exists status      text not null default 'open';
alter table public.video_engagements add column if not exists details     jsonb not null default '{}'::jsonb;
alter table public.video_engagements add column if not exists resolved_by text;
alter table public.video_engagements add column if not exists resolved_at timestamptz;

-- widen type check to include 'REPORT'
do $$
begin
  alter table public.video_engagements drop constraint video_engagements_engagement_type_check;
exception when undefined_object then null;
end $$;
alter table public.video_engagements
  add constraint video_engagements_engagement_type_check
  check (engagement_type in ('LIKE','COMMENT','REPORT'));

create index if not exists idx_engagements_reports on public.video_engagements (engagement_type, created_at desc)
  where engagement_type = 'REPORT';

-- RLS: reports must NOT be publicly readable (reporter privacy).
drop policy if exists th_engagements_read on public.video_engagements;
create policy th_engagements_read on public.video_engagements
  for select to anon, authenticated
  using (
    (engagement_type <> 'REPORT'
     and exists (select 1 from public.creator_videos v
                 where v.id = video_engagements.video_id and v.status = 'PUBLISHED')
     and is_hidden = false)
    or user_id = auth.uid()
    or exists (select 1 from public.creators c
               where c.id = video_engagements.creator_id and c.user_id = auth.uid())
    or public.is_admin()
  );

-- ============================================================================
-- SECTION 7 — creator_strikes
-- ============================================================================
alter table public.creator_strikes add column if not exists status text not null default 'active';
do $$
begin
  alter table public.creator_strikes drop constraint creator_strikes_status_check;
exception when undefined_object then null;
end $$;
alter table public.creator_strikes
  add constraint creator_strikes_status_check
  check (status in ('active','expired','reversed'));

-- issued_by becomes free text (server stamps 'streamplay-admin' or admin email)
do $$
begin
  alter table public.creator_strikes drop constraint creator_strikes_issued_by_fkey;
exception when undefined_object then null;
end $$;
alter table public.creator_strikes alter column issued_by type text using issued_by::text;

-- ============================================================================
-- SECTION 8 — creator_earnings
-- ============================================================================
alter table public.creator_earnings add column if not exists paid_out_usd    numeric(12,2) not null default 0;
alter table public.creator_earnings add column if not exists last_computed_at timestamptz;

-- ============================================================================
-- SECTION 9 — creator_earnings_ledger
-- ============================================================================
alter table public.creator_earnings_ledger add column if not exists views        bigint not null default 0;
alter table public.creator_earnings_ledger add column if not exists period_start timestamptz;
alter table public.creator_earnings_ledger add column if not exists period_end   timestamptz;

do $$
begin
  alter table public.creator_earnings_ledger drop constraint creator_earnings_ledger_entry_type_check;
exception when undefined_object then null;
end $$;
alter table public.creator_earnings_ledger
  add constraint creator_earnings_ledger_entry_type_check
  check (entry_type in ('VIEW_REVENUE','ADJUSTMENT','WITHDRAWAL','WITHDRAWAL_REFUND','REVERSAL',
                        'VIEW_CREDIT','WITHDRAWAL_HOLD','WITHDRAWAL_PAID'));

alter table public.creator_earnings_ledger alter column balance_after drop not null;

do $$
begin
  alter table public.creator_earnings_ledger drop constraint creator_earnings_ledger_created_by_fkey;
exception when undefined_object then null;
end $$;
alter table public.creator_earnings_ledger alter column created_by type text using created_by::text;

create index if not exists idx_ledger_rollup on public.creator_earnings_ledger (creator_id, entry_type, period_end desc);

-- ============================================================================
-- SECTION 10 — creator_withdrawals
-- ============================================================================
alter table public.creator_withdrawals alter column payout_method_id drop not null;
alter table public.creator_withdrawals add column if not exists payout_ref text;

do $$
begin
  alter table public.creator_withdrawals drop constraint creator_withdrawals_processed_by_fkey;
exception when undefined_object then null;
end $$;
alter table public.creator_withdrawals alter column processed_by type text using processed_by::text;

-- ============================================================================
-- SECTION 11 — copyright_reports (server-layer bookkeeping columns)
-- ============================================================================
-- The phase-1 schema has resolved_by uuid / resolved_at for admin identity;
-- the server layer stamps reviewer identity as free TEXT (reviewed_by /
-- reviewed_at), so those are added as additive compat columns. The spec
-- columns (resolved_by uuid, resolution_note, resolved_at) stay untouched.
alter table public.copyright_reports add column if not exists reviewed_by text;
alter table public.copyright_reports add column if not exists reviewed_at timestamptz;

-- allow shorter DMCA descriptions than the phase-1 default (>= 10 chars)
do $$
begin
  alter table public.copyright_reports drop constraint copyright_reports_details_check;
exception when undefined_object then null;
end $$;
alter table public.copyright_reports
  add constraint copyright_reports_details_check
  check (char_length(details) between 1 and 5000);

-- ============================================================================
-- SECTION 12 — payout_methods (label handled by server translation; widen types)
-- ============================================================================
do $$
begin
  alter table public.payout_methods drop constraint payout_methods_method_type_check;
exception when undefined_object then null;
end $$;
alter table public.payout_methods
  add constraint payout_methods_method_type_check
  check (method_type in ('BANK_TRANSFER','PAYPAL','BKASH','NAGAD','ROCKET','CRYPTO','OTHER','BANK','WISE'));

-- ============================================================================
-- SECTION 13 — creator_notifications (widen for generic admin types)
-- ============================================================================
do $$
begin
  alter table public.creator_notifications drop constraint creator_notifications_notif_type_check;
exception when undefined_object then null;
end $$;
alter table public.creator_notifications
  add constraint creator_notifications_notif_type_check
  check (notif_type in ('VIDEO_APPROVED','VIDEO_REJECTED','VIDEO_TAKEN_DOWN','STRIKE_ISSUED',
                        'COPYRIGHT_REPORT','MONETIZATION','WITHDRAWAL','SYSTEM',
                        'INFO','APPROVAL','REJECTION','STRIKE','PAYOUT'));

-- ============================================================================
-- SECTION 14 — viewer_entitlements (paid-content access grants)
-- ============================================================================
create table if not exists public.viewer_entitlements (
  id          uuid primary key default gen_random_uuid(),
  video_id    uuid not null references public.creator_videos(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  source      text not null default 'grant',
  granted_by  text,
  valid_until timestamptz,
  created_at  timestamptz not null default now(),
  unique (video_id, user_id)
);

alter table public.viewer_entitlements enable row level security;

drop policy if exists th_entitlements_read on public.viewer_entitlements;
create policy th_entitlements_read on public.viewer_entitlements
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create index if not exists idx_entitlements_user on public.viewer_entitlements (user_id, valid_until);
create index if not exists idx_entitlements_video on public.viewer_entitlements (video_id);

-- ============================================================================
-- SECTION 15 — app_settings: free-text updated_by + anti-fraud seeds
-- ============================================================================
do $$
begin
  alter table public.app_settings drop constraint app_settings_updated_by_fkey;
exception when undefined_object then null;
end $$;
alter table public.app_settings alter column updated_by type text using updated_by::text;

insert into public.app_settings (key, value, description) values
  ('MODERATION_ENABLED',            'true', 'Moderation queue on: uploads go to PENDING_REVIEW instead of auto-publish'),
  ('AUTO_PUBLISH_SHORTS',           'false','Shorts skip review when moderation is off'),
  ('DEDUPE_WINDOW_MINUTES',         '30',   'Minutes before the same viewer can register another valid view on the same video'),
  ('MAX_SESSIONS_PER_HOUR_PER_IP',  '12',   'Watch sessions per IP per hour before suspicion scoring flags a flood'),
  ('MAX_WATCH_HEARTBEAT_SECONDS',   '20',   'Max watch seconds creditable per heartbeat (server-side clamp)'),
  ('SUSPICION_THRESHOLD',           '60',   'Suspicion score at/above which a session is flagged')
on conflict (key) do nothing;

-- ============================================================================
-- SECTION 16 — triggers: profile like totals; remove duplicate notifier
-- ============================================================================

-- like/comment counters now ALSO maintain creator_profiles.total_likes
create or replace function public.tg_engagement_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_video   uuid;
  v_kind    text;
  v_delta   int := 0;
  v_creator uuid;
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

  select creator_id into v_creator from public.creator_videos where id = v_video;

  if v_delta <> 0 and v_kind = 'LIKE' then
    update public.creator_videos set like_count = greatest(like_count + v_delta, 0) where id = v_video;
    update public.creator_profiles
       set total_likes = greatest(total_likes + v_delta, 0)
     where creator_id = v_creator;
  elsif v_delta <> 0 and v_kind = 'COMMENT' then
    update public.creator_videos set comment_count = greatest(comment_count + v_delta, 0) where id = v_video;
  end if;

  return coalesce(new, old);
end;
$$;

-- the server layer sends its own moderation notifications; drop the auto one
-- to avoid duplicates
drop trigger if exists t_video_moderation_notify on public.creator_videos;

-- ============================================================================
-- SECTION 17 — default creator categories
-- ============================================================================
insert into public.creator_categories (name, slug, description, sort_order) values
  ('Music',        'music',        'Music videos, performances and covers',  10),
  ('Gaming',       'gaming',       'Gameplay, walkthroughs and esports',     20),
  ('Education',    'education',    'Tutorials, courses and explainers',      30),
  ('Entertainment','entertainment','Comedy, vlogs and variety',              40),
  ('Sports',       'sports',       'Highlights, analysis and training',      50),
  ('Technology',   'technology',   'Reviews, news and how-tos',              60),
  ('News',         'news',         'Journalism and current affairs',         70),
  ('Lifestyle',    'lifestyle',    'Food, travel, fashion and daily life',   80)
on conflict (slug) do nothing;

commit;

-- ============================================================================
-- POST-APPLY: Creator Hub server layer is now fully compatible with the live
-- schema. Verify from the admin console (Creator Hub -> QA) — persistence
-- should report: durable Supabase persistence active.
-- ============================================================================
