/**
 * server/catalogIndexCache.ts
 *
 * Durable search-index snapshots in Supabase Storage (service-role client).
 *
 * Why: the provider's FULL-list endpoints (get_vod_streams / get_series
 * without a category filter) stall when fetched from Vercel's network —
 * requests die at the function's maxDuration — while per-category fetches
 * return in <1s. A cold serverless instance therefore cannot rebuild the
 * global search index reliably. This module persists a successfully-built
 * index as gzip-chunked objects so every future cold start hydrates in
 * seconds instead of refetching.
 *
 * Storage (not a table) is used deliberately: no DDL/migration dependency —
 * the service-role key can create the bucket and objects at runtime.
 * All operations are best-effort: any failure returns null/false and the
 * caller falls back to the direct provider build path.
 */

import { gzipSync, gunzipSync } from 'node:zlib';
import { getServiceSupabase } from './db/supabase.js';
import type { CatalogItem } from './iptvCatalog.js';

const BUCKET = 'catalog-cache';
const CHUNK_ITEMS = 25_000;
const UPLOAD_PARALLELISM = 4;

function objectPath(lineKey: string, type: string, chunkIndex: number): string {
  return `${lineKey}/${type}/chunk-${String(chunkIndex).padStart(4, '0')}.json.gz`;
}

/**
 * Categories snapshots live under a SIBLING prefix (`<line>/<type>-cats/`) so
 * they can never collide with the index-chunk listing in loadCatalogIndex.
 */
function categoriesPath(lineKey: string, type: string): string {
  return `${lineKey}/${type}-cats/categories.json.gz`;
}

async function ensureBucket(client: NonNullable<ReturnType<typeof getServiceSupabase>>): Promise<boolean> {
  // createBucket is idempotent-enough: "already exists" counts as success.
  try {
    const { error } = await client.storage.createBucket(BUCKET, { public: false });
    if (!error) return true;
    const msg = String((error as Error).message || '');
    if (/exist|duplicate|already/i.test(msg)) return true;
  } catch {
    /* fall through to verification */
  }
  try {
    const { error } = await client.storage.from(BUCKET).list('', { limit: 1 });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Persist the index as gzip chunks. Returns true when every chunk uploaded.
 */
export async function saveCatalogIndex(
  lineKey: string,
  type: string,
  items: CatalogItem[],
): Promise<boolean> {
  const client = getServiceSupabase();
  if (!client || !items.length) return false;
  try {
    if (!(await ensureBucket(client))) return false;

    const chunkCount = Math.ceil(items.length / CHUNK_ITEMS);
    for (let start = 0; start < chunkCount; start += UPLOAD_PARALLELISM) {
      const batch = Array.from(
        { length: Math.min(UPLOAD_PARALLELISM, chunkCount - start) },
        (_, k) => start + k,
      );
      await Promise.all(
        batch.map(async (chunkIndex) => {
          const slice = items.slice(chunkIndex * CHUNK_ITEMS, (chunkIndex + 1) * CHUNK_ITEMS);
          const gz = gzipSync(Buffer.from(JSON.stringify(slice), 'utf8'));
          const { error } = await client.storage
            .from(BUCKET)
            .upload(objectPath(lineKey, type, chunkIndex), gz, {
              upsert: true,
              contentType: 'application/gzip',
            });
          if (error) throw error;
        }),
      );
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Load a previously saved index snapshot. Returns null when absent, stale
 * (older than maxAgeMs), or when storage is unavailable.
 */
export async function loadCatalogIndex(
  lineKey: string,
  type: string,
  maxAgeMs: number,
): Promise<CatalogItem[] | null> {
  const client = getServiceSupabase();
  if (!client) return null;
  try {
    const prefix = `${lineKey}/${type}`;
    const { data: listing, error: listError } = await client.storage
      .from(BUCKET)
      .list(prefix, { limit: 200, sortBy: { column: 'name', order: 'asc' } });
    if (listError || !listing?.length) return null;

    const chunks = listing
      .filter((o) => /^chunk-\d+\.json\.gz$/.test(o.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!chunks.length) return null;

    // Freshness: newest chunk's updated_at governs the whole snapshot.
    const newestAt = Math.max(
      ...chunks.map((o) => new Date((o as { updated_at?: string }).updated_at || 0).getTime()),
    );
    if (!Number.isFinite(newestAt) || Date.now() - newestAt > maxAgeMs) return null;

    const parts: CatalogItem[][] = [];
    for (const chunk of chunks) {
      const { data: blob, error } = await client.storage
        .from(BUCKET)
        .download(`${prefix}/${chunk.name}`);
      if (error || !blob) return null;
      const buf = Buffer.from(await blob.arrayBuffer());
      parts.push(JSON.parse(gunzipSync(buf).toString('utf8')) as CatalogItem[]);
    }
    const merged = parts.flat();
    return merged.length ? merged : null;
  } catch {
    return null;
  }
}

/**
 * Persist the provider category list (id + name + family filter applied by
 * the caller) so the browse rails can be served during provider outages.
 * Small object (hundreds of entries) — a single upload.
 */
export async function saveCatalogCategories(
  lineKey: string,
  type: string,
  categories: { id: string; name: string }[],
): Promise<boolean> {
  const client = getServiceSupabase();
  if (!client || !categories.length) return false;
  try {
    if (!(await ensureBucket(client))) return false;
    const gz = gzipSync(Buffer.from(JSON.stringify(categories), 'utf8'));
    const { error } = await client.storage
      .from(BUCKET)
      .upload(categoriesPath(lineKey, type), gz, {
        upsert: true,
        contentType: 'application/gzip',
      });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Load a previously saved category list. Returns null when absent, stale
 * (older than maxAgeMs), or when storage is unavailable.
 */
export async function loadCatalogCategories(
  lineKey: string,
  type: string,
  maxAgeMs: number,
): Promise<{ id: string; name: string }[] | null> {
  const client = getServiceSupabase();
  if (!client) return null;
  try {
    const path = categoriesPath(lineKey, type);
    const { data: listing, error: listError } = await client.storage
      .from(BUCKET)
      .list(path.split('/').slice(0, -1).join('/'), { limit: 10 });
    if (listError) return null;
    const entry = (listing || []).find((o) => o.name === 'categories.json.gz');
    if (!entry) return null;
    const updatedAt = new Date((entry as { updated_at?: string }).updated_at || 0).getTime();
    if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > maxAgeMs) return null;
    const { data: blob, error } = await client.storage.from(BUCKET).download(path);
    if (error || !blob) return null;
    const buf = Buffer.from(await blob.arrayBuffer());
    const parsed = JSON.parse(gunzipSync(buf).toString('utf8')) as { id: string; name: string }[];
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch {
    return null;
  }
}
