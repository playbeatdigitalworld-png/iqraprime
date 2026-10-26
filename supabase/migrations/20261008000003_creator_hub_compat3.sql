-- ============================================================================
-- CREATOR HUB — COMPAT MIGRATION #3 (additive; safe to re-run)
-- Applied after phase-1 + compat #1 + compat #2.
--
-- Fix: surrogate `id` columns for the two creator_id-keyed tables.
--   The persistence store's generic update API is id-keyed
--   (`store.update(table, id, patch)`), and several flows rely on it:
--     * endWatch bumps creator_profiles.total_views after minting a view
--     * like/follow counters bump creator_profiles totals
--     * PATCH /me/profile updates creator_profiles by id
--   But phase-1 defined both creator_profiles and creator_earnings with
--   `creator_id uuid primary key` and NO surrogate id column, so every
--   id-keyed update failed with:
--     "column creator_profiles.id does not exist"
--   (observed as a 500 on watch-session end AFTER the valid view was
--   already minted; the profile edit endpoint would fail the same way).
--   creator_earnings currently only uses upsert-by-creator_id but gets the
--   same column for uniformity so future id-keyed paths cannot regress.
--
-- Notes:
--   * ADD COLUMN ... DEFAULT backfills existing rows automatically (PG11+).
--   * ensureProfile/earnings upserts never set id explicitly, so the column
--     default covers all future rows.
-- ============================================================================

alter table public.creator_profiles
  add column if not exists id uuid not null default gen_random_uuid();
create unique index if not exists creator_profiles_id_key
  on public.creator_profiles (id);

alter table public.creator_earnings
  add column if not exists id uuid not null default gen_random_uuid();
create unique index if not exists creator_earnings_id_key
  on public.creator_earnings (id);
