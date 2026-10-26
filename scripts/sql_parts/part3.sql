
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
