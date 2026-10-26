
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
