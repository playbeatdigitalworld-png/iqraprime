-- ============================================================================
-- CREATOR HUB — COMPAT MIGRATION #2 (additive; safe to re-run)
-- Applied after 20261008000000_creator_hub_phase1.sql + 20261008000001_creator_hub_compat.sql
--
-- Fix: anonymous public video reports.
--   POST /api/creator-hub/reports allows viewers to report a video WITHOUT an
--   account. The phase-1 table defined `video_engagements.user_id` as NOT NULL
--   (likes/comments are always authenticated), which made every anonymous
--   report fail with:
--     "null value in column \"user_id\" ... violates not-null constraint"
--   Everything else the reports flow needs (engagement_type 'REPORT',
--   status/resolved_by/resolved_at bookkeeping, ip_hash) was already added by
--   compat #1 — the only missing piece is making user_id nullable.
-- ============================================================================

alter table public.video_engagements
  alter column user_id drop not null;
