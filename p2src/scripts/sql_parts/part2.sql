
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
