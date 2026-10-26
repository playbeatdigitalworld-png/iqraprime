interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
}

interface D1PreparedStatement {
  bind(...values: (string | number | null)[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  CATALOG_DB: D1Database;
  ADMIN_PASSWORD?: string;
  PROVIDER_ENCRYPTION_KEY?: string;
  PROVIDER_BASE_URL?: string;
  PROVIDER_USERNAME?: string;
  PROVIDER_PASSWORD?: string;
}

interface ProviderConfig {
  baseUrl: string;
  username: string;
  password: string;
}

interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

interface ProviderItem {
  stream_id?: string | number;
  series_id?: string | number;
  num?: number;
  name?: string;
  stream_icon?: string;
  cover?: string;
  backdrop_path?: string | string[];
  epg_channel_id?: string;
  category_id?: string | number;
  container_extension?: string;
  stream_type?: string;
  plot?: string;
  genre?: string;
  releaseDate?: string;
  rating?: string | number;
  [key: string]: unknown;
}

interface CatalogRow {
  stream_id: string;
  name: string;
  category: string | null;
  logo_url: string | null;
  epg_id: string | null;
  channel_number: number | null;
  stream_type: string | null;
  container_extension: string | null;
  status?: string;
  checked_at?: string | null;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS new_ne222_catalog_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS new_ne222_live_catalog (
    generation TEXT NOT NULL,
    stream_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    logo_url TEXT,
    epg_id TEXT,
    channel_number INTEGER,
    stream_type TEXT,
    container_extension TEXT,
    last_synced_at TEXT NOT NULL,
    PRIMARY KEY (generation, stream_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_new_ne222_live_generation_category
    ON new_ne222_live_catalog(generation, category)`,
  `CREATE TABLE IF NOT EXISTS new_ne222_movie_catalog (
    generation TEXT NOT NULL,
    stream_id TEXT NOT NULL,
    name TEXT NOT NULL,
    poster_url TEXT,
    backdrop_url TEXT,
    plot TEXT,
    category TEXT,
    container_extension TEXT,
    release_date TEXT,
    rating TEXT,
    genre TEXT,
    metadata_json TEXT NOT NULL,
    last_synced_at TEXT NOT NULL,
    PRIMARY KEY (generation, stream_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_new_ne222_movie_generation_name
    ON new_ne222_movie_catalog(generation, name)`,
  `CREATE TABLE IF NOT EXISTS new_ne222_series_catalog (
    generation TEXT NOT NULL,
    series_id TEXT NOT NULL,
    name TEXT NOT NULL,
    poster_url TEXT,
    backdrop_url TEXT,
    plot TEXT,
    category TEXT,
    release_date TEXT,
    rating TEXT,
    genre TEXT,
    metadata_json TEXT NOT NULL,
    last_synced_at TEXT NOT NULL,
    PRIMARY KEY (generation, series_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_new_ne222_series_generation_name
    ON new_ne222_series_catalog(generation, name)`,
  `CREATE TABLE IF NOT EXISTS new_ne222_channel_health (
    stream_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    http_status INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_new_ne222_channel_health_checked
    ON new_ne222_channel_health(checked_at)`,
];

let schemaReady = false;
let encryptionSecretValue: string | null = null;
let encryptionKeyPromise: Promise<CryptoKey> | null = null;

const encoder = new TextEncoder();

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady) return;
  await db.batch(SCHEMA.map((sql) => db.prepare(sql)));
  schemaReady = true;
}

async function encryptionKey(env: Env): Promise<CryptoKey> {
  if (!env.PROVIDER_ENCRYPTION_KEY || env.PROVIDER_ENCRYPTION_KEY.length < 32) {
    throw new Error('provider_encryption_key_not_configured');
  }
  if (encryptionSecretValue !== env.PROVIDER_ENCRYPTION_KEY || !encryptionKeyPromise) {
    encryptionSecretValue = env.PROVIDER_ENCRYPTION_KEY;
    const material = await crypto.subtle.importKey(
      'raw',
      encoder.encode(env.PROVIDER_ENCRYPTION_KEY),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    encryptionKeyPromise = crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: encoder.encode('new-ne222-provider-config-v1'),
        iterations: 100_000,
      },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }
  return encryptionKeyPromise;
}

async function readProviderConfig(env: Env): Promise<ProviderConfig | null> {
  const row = await env.CATALOG_DB.prepare(
    "SELECT value FROM new_ne222_catalog_state WHERE key = 'provider_config'",
  ).first<{ value: string }>();
  if (!row) return null;

  const stored = JSON.parse(row.value) as { iv: string; ciphertext: string };
  const key = await encryptionKey(env);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Uint8Array.from(atob(stored.iv), (character) => character.charCodeAt(0)) },
    key,
    Uint8Array.from(atob(stored.ciphertext), (character) => character.charCodeAt(0)),
  );
  const config: unknown = JSON.parse(new TextDecoder().decode(plaintext));
  if (
    typeof config !== 'object' || config === null ||
    !('baseUrl' in config) || typeof config.baseUrl !== 'string' ||
    !('username' in config) || typeof config.username !== 'string' ||
    !('password' in config) || typeof config.password !== 'string'
  ) {
    throw new Error('provider_config_invalid');
  }
  return {
    baseUrl: config.baseUrl,
    username: config.username,
    password: config.password,
  };
}

async function saveProviderConfig(env: Env, config: ProviderConfig): Promise<void> {
  const key = await encryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(config)),
  );
  const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
  const value = JSON.stringify({
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  });
  await env.CATALOG_DB.prepare(
    `INSERT INTO new_ne222_catalog_state (key, value) VALUES ('provider_config', ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
  ).bind(value).run();
}

async function authorizedAdmin(request: Request, env: Env): Promise<boolean> {
  const expected = env.ADMIN_PASSWORD;
  if (!expected || expected.length < 32 || !env.PROVIDER_ENCRYPTION_KEY || env.PROVIDER_ENCRYPTION_KEY.length < 32) return false;
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return false;
  const supplied = authorization.slice(7);
  const [expectedDigest, suppliedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    crypto.subtle.digest('SHA-256', encoder.encode(supplied)),
  ]);
  const expectedBytes = new Uint8Array(expectedDigest);
  const suppliedBytes = new Uint8Array(suppliedDigest);
  return expectedBytes.every((value, index) => value === suppliedBytes[index]);
}

function withProviderConfig(env: Env, config: ProviderConfig): Env {
  return {
    ...env,
    PROVIDER_BASE_URL: config.baseUrl,
    PROVIDER_USERNAME: config.username,
    PROVIDER_PASSWORD: config.password,
  };
}

function assertProviderConfigured(
  env: Env,
): asserts env is Env & { PROVIDER_BASE_URL: string; PROVIDER_USERNAME: string; PROVIDER_PASSWORD: string } {
  if (!env.PROVIDER_BASE_URL || !env.PROVIDER_USERNAME || !env.PROVIDER_PASSWORD) {
    throw new Error('provider_not_configured');
  }
  const url = new URL(env.PROVIDER_BASE_URL);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('provider_url_invalid');
  }
}

async function providerList(env: Env, action: string): Promise<ProviderItem[]> {
  assertProviderConfigured(env);
  const url = new URL('/player_api.php', env.PROVIDER_BASE_URL);
  url.searchParams.set('username', env.PROVIDER_USERNAME);
  url.searchParams.set('password', env.PROVIDER_PASSWORD);
  url.searchParams.set('action', action);

  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`provider_http_${response.status}`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error('provider_invalid_response');
  return payload as ProviderItem[];
}

async function writeRows(
  db: D1Database,
  table: string,
  columns: string[],
  keyColumns: string[],
  rows: (string | number | null)[][],
): Promise<void> {
  const rowSize = Math.max(1, Math.floor(90 / columns.length));
  const statements: D1PreparedStatement[] = [];

  for (let start = 0; start < rows.length; start += rowSize) {
    const chunk = rows.slice(start, start + rowSize);
    const tuple = `(${columns.map(() => '?').join(', ')})`;
    const conflict = columns.filter((column) => !keyColumns.includes(column));
    const update = conflict.map((column) => `${column} = excluded.${column}`).join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${chunk.map(() => tuple).join(', ')}
      ON CONFLICT (${keyColumns.join(', ')}) DO UPDATE SET ${update}`;
    statements.push(db.prepare(sql).bind(...chunk.flat()));
  }

  for (let start = 0; start < statements.length; start += 100) {
    await db.batch(statements.slice(start, start + 100));
  }
}

function categoryMap(items: ProviderItem[]): Map<string, string> {
  return new Map(
    items.flatMap((item) => {
      const id = item.category_id;
      const name = item.category_name;
      return id !== undefined && typeof name === 'string' ? [[String(id), name] as const] : [];
    }),
  );
}

async function syncCatalog(env: Env): Promise<{ generation: string; live: number; movies: number; series: number }> {
  const config = await readProviderConfig(env);
  if (!config) throw new Error('provider_not_configured');
  const providerEnv = withProviderConfig(env, config);
  const [
    live,
    liveCategories,
    movies,
    movieCategories,
    series,
    seriesCategories,
  ] = await Promise.all([
    providerList(providerEnv, 'get_live_streams'),
    providerList(providerEnv, 'get_live_categories'),
    providerList(providerEnv, 'get_vod_streams'),
    providerList(providerEnv, 'get_vod_categories'),
    providerList(providerEnv, 'get_series'),
    providerList(providerEnv, 'get_series_categories'),
  ]);

  const normalizedLive = live.filter((item) =>
    (typeof item.stream_id === 'string' || typeof item.stream_id === 'number') &&
    typeof item.name === 'string' &&
    item.name.trim().length > 0,
  );
  if (normalizedLive.length === 0) throw new Error('provider_returned_no_live_channels');

  const generation = crypto.randomUUID();
  const syncedAt = new Date().toISOString();
  const liveCategoryMap = categoryMap(liveCategories);
  const movieCategoryMap = categoryMap(movieCategories);
  const seriesCategoryMap = categoryMap(seriesCategories);

  await writeRows(
    env.CATALOG_DB,
    'new_ne222_live_catalog',
    ['generation', 'stream_id', 'name', 'category', 'logo_url', 'epg_id', 'channel_number', 'stream_type', 'container_extension', 'last_synced_at'],
    ['generation', 'stream_id'],
    normalizedLive.map((item) => [
      generation,
      String(item.stream_id),
      item.name!.trim(),
      item.category_id === undefined ? null : liveCategoryMap.get(String(item.category_id)) || null,
      typeof item.stream_icon === 'string' ? item.stream_icon : null,
      typeof item.epg_channel_id === 'string' ? item.epg_channel_id : null,
      typeof item.num === 'number' ? item.num : null,
      typeof item.stream_type === 'string' ? item.stream_type : null,
      typeof item.container_extension === 'string' ? item.container_extension : null,
      syncedAt,
    ]),
  );

  const normalizedMovies = movies.filter((item) =>
    (typeof item.stream_id === 'string' || typeof item.stream_id === 'number') &&
    typeof item.name === 'string' &&
    item.name.trim().length > 0,
  );
  await writeRows(
    env.CATALOG_DB,
    'new_ne222_movie_catalog',
    ['generation', 'stream_id', 'name', 'poster_url', 'backdrop_url', 'plot', 'category', 'container_extension', 'release_date', 'rating', 'genre', 'metadata_json', 'last_synced_at'],
    ['generation', 'stream_id'],
    normalizedMovies.map((item) => [
      generation,
      String(item.stream_id),
      item.name!.trim(),
      typeof item.stream_icon === 'string' ? item.stream_icon : typeof item.cover === 'string' ? item.cover : null,
      Array.isArray(item.backdrop_path) ? String(item.backdrop_path[0] || '') || null : typeof item.backdrop_path === 'string' ? item.backdrop_path : null,
      typeof item.plot === 'string' ? item.plot : null,
      item.category_id === undefined ? null : movieCategoryMap.get(String(item.category_id)) || null,
      typeof item.container_extension === 'string' ? item.container_extension : null,
      typeof item.releaseDate === 'string' ? item.releaseDate : null,
      item.rating === undefined ? null : String(item.rating),
      typeof item.genre === 'string' ? item.genre : null,
      JSON.stringify(item),
      syncedAt,
    ]),
  );

  const normalizedSeries = series.filter((item) =>
    (typeof item.series_id === 'string' || typeof item.series_id === 'number') &&
    typeof item.name === 'string' &&
    item.name.trim().length > 0,
  );
  await writeRows(
    env.CATALOG_DB,
    'new_ne222_series_catalog',
    ['generation', 'series_id', 'name', 'poster_url', 'backdrop_url', 'plot', 'category', 'release_date', 'rating', 'genre', 'metadata_json', 'last_synced_at'],
    ['generation', 'series_id'],
    normalizedSeries.map((item) => [
      generation,
      String(item.series_id),
      item.name!.trim(),
      typeof item.cover === 'string' ? item.cover : typeof item.stream_icon === 'string' ? item.stream_icon : null,
      Array.isArray(item.backdrop_path) ? String(item.backdrop_path[0] || '') || null : typeof item.backdrop_path === 'string' ? item.backdrop_path : null,
      typeof item.plot === 'string' ? item.plot : null,
      item.category_id === undefined ? null : seriesCategoryMap.get(String(item.category_id)) || null,
      typeof item.releaseDate === 'string' ? item.releaseDate : null,
      item.rating === undefined ? null : String(item.rating),
      typeof item.genre === 'string' ? item.genre : null,
      JSON.stringify(item),
      syncedAt,
    ]),
  );

  const metadata = JSON.stringify({
    generation,
    syncedAt,
    totalChannels: normalizedLive.length,
    totalMovies: normalizedMovies.length,
    totalSeries: normalizedSeries.length,
  });
  await env.CATALOG_DB.batch([
    env.CATALOG_DB.prepare(`INSERT INTO new_ne222_catalog_state (key, value) VALUES ('active_generation', ?)
      ON CONFLICT (key) DO UPDATE SET value = excluded.value`).bind(generation),
    env.CATALOG_DB.prepare(`INSERT INTO new_ne222_catalog_state (key, value) VALUES ('last_sync', ?)
      ON CONFLICT (key) DO UPDATE SET value = excluded.value`).bind(metadata),
    env.CATALOG_DB.prepare('DELETE FROM new_ne222_live_catalog WHERE generation <> ?').bind(generation),
    env.CATALOG_DB.prepare('DELETE FROM new_ne222_movie_catalog WHERE generation <> ?').bind(generation),
    env.CATALOG_DB.prepare('DELETE FROM new_ne222_series_catalog WHERE generation <> ?').bind(generation),
    env.CATALOG_DB.prepare("DELETE FROM new_ne222_catalog_state WHERE key = 'last_error'"),
  ]);

  return { generation, live: normalizedLive.length, movies: normalizedMovies.length, series: normalizedSeries.length };
}

function upstreamStreamUrl(env: Env, type: string, id: string, extension: string): URL {
  assertProviderConfigured(env);
  const root = new URL(env.PROVIDER_BASE_URL);
  const pathType = type === 'live' ? 'live' : type === 'movie' ? 'movie' : 'series';
  const suffix = type === 'live' ? 'ts' : extension.replace(/[^a-zA-Z0-9]/g, '') || 'mp4';
  return new URL(
    `/${pathType}/${encodeURIComponent(env.PROVIDER_USERNAME)}/${encodeURIComponent(env.PROVIDER_PASSWORD)}/${encodeURIComponent(id)}.${suffix}`,
    root,
  );
}

async function proxyStream(request: Request, env: Env, type: string, id: string): Promise<Response> {
  assertProviderConfigured(env);
  if (!/^\d+$/.test(id)) return json({ error: 'Invalid stream id' }, 400);
  const generationResult = await env.CATALOG_DB.prepare(
    "SELECT value FROM new_ne222_catalog_state WHERE key = 'active_generation'",
  ).first<{ value: string }>();
  if (!generationResult?.value) return json({ error: 'Catalog has not synchronized yet' }, 503);

  const lookup = type === 'live'
    ? env.CATALOG_DB.prepare('SELECT container_extension FROM new_ne222_live_catalog WHERE generation = ? AND stream_id = ?')
    : type === 'movie'
      ? env.CATALOG_DB.prepare('SELECT container_extension FROM new_ne222_movie_catalog WHERE generation = ? AND stream_id = ?')
      : null;
  if (!lookup) return json({ error: 'Unsupported stream type' }, 404);
  const row = await lookup.bind(generationResult.value, id).first<{ container_extension: string | null }>();
  if (!row) return json({ error: 'Stream not found' }, 404);

  const source = upstreamStreamUrl(env, type, id, row.container_extension || '');
  const headers = new Headers();
  const range = request.headers.get('Range');
  if (range) headers.set('Range', range);
  const upstream = await fetch(source, {
    method: request.method === 'HEAD' ? 'HEAD' : 'GET',
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set('Cache-Control', 'no-store');
  responseHeaders.delete('Set-Cookie');
  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

async function proxyImage(urlValue: string | null, env: Env): Promise<Response> {
  assertProviderConfigured(env);
  if (!urlValue) return json({ error: 'Image URL is required' }, 400);
  let imageUrl: URL;
  try {
    imageUrl = new URL(urlValue);
  } catch {
    return json({ error: 'Invalid image URL' }, 400);
  }
  const providerHost = new URL(env.PROVIDER_BASE_URL).hostname;
  if (!['http:', 'https:'].includes(imageUrl.protocol) || imageUrl.hostname !== providerHost || imageUrl.username || imageUrl.password) {
    return json({ error: 'Image host is not allowed' }, 400);
  }
  const upstream = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
  const contentType = upstream.headers.get('Content-Type') || '';
  if (!upstream.ok || !contentType.toLowerCase().startsWith('image/')) {
    return json({ error: 'Provider image is unavailable' }, upstream.ok ? 502 : upstream.status);
  }
  return new Response(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function readActiveGeneration(db: D1Database): Promise<string | null> {
  const row = await db.prepare(
    "SELECT value FROM new_ne222_catalog_state WHERE key = 'active_generation'",
  ).first<{ value: string }>();
  return row?.value || null;
}

function publicImageUrl(value: string | null, env: Env): string {
  if (!value || !env.PROVIDER_BASE_URL) return '';
  try {
    const url = new URL(value);
    const providerHost = new URL(env.PROVIDER_BASE_URL).hostname;
    if (url.hostname === providerHost) return `/api/image?src=${encodeURIComponent(url.toString())}`;
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

async function listChannels(url: URL, env: Env, generation: string): Promise<Response> {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 60));
  const search = (url.searchParams.get('search') || '').trim().slice(0, 100);
  const category = (url.searchParams.get('category') || '').trim().slice(0, 100);
  const filters = ['c.generation = ?'];
  const values: (string | number | null)[] = [generation];
  if (search) {
    filters.push('c.name LIKE ?');
    values.push(`%${search.replace(/[%_]/g, '\\$&')}%`);
  }
  if (category) {
    filters.push('c.category = ?');
    values.push(category);
  }
  const where = filters.join(' AND ');
  const count = await env.CATALOG_DB.prepare(
    `SELECT COUNT(*) AS total FROM new_ne222_live_catalog c WHERE ${where}`,
  ).bind(...values).first<{ total: number }>();
  const rows = await env.CATALOG_DB.prepare(
    `SELECT c.stream_id, c.name, c.category, c.logo_url, c.epg_id, c.channel_number,
      c.stream_type, c.container_extension, h.status, h.checked_at
     FROM new_ne222_live_catalog c
     LEFT JOIN new_ne222_channel_health h ON h.stream_id = c.stream_id
     WHERE ${where}
     ORDER BY c.channel_number IS NULL, c.channel_number, c.name
     LIMIT ? OFFSET ?`,
  ).bind(...values, pageSize, (page - 1) * pageSize).all<CatalogRow>();

  return json({
    total: count?.total || 0,
    page,
    pageSize,
    items: rows.results.map((row) => ({
      id: row.stream_id,
      name: row.name,
      officialName: row.name,
      category: row.category || '',
      logo: publicImageUrl(row.logo_url, env),
      epgChannelId: row.epg_id || '',
      streamUrl: `/api/stream/live/${encodeURIComponent(row.stream_id)}`,
      streamHealth: row.status?.toUpperCase() || 'UNVERIFIED',
      liveStatus: row.status === 'online',
      isActive: true,
      channelNumber: row.channel_number,
      lastVerificationTimestamp: row.checked_at || null,
    })),
  });
}

interface MovieCatalogRow {
  stream_id: string;
  name: string;
  poster_url: string | null;
  backdrop_url: string | null;
  plot: string | null;
  category: string | null;
  container_extension: string | null;
  release_date: string | null;
  rating: string | null;
  genre: string | null;
}

async function listMovies(request: Request, env: Env, generation: string): Promise<Response> {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 60));
  const rows = await env.CATALOG_DB.prepare(
    `SELECT stream_id, name, poster_url, backdrop_url, plot, category, container_extension,
      release_date, rating, genre
     FROM new_ne222_movie_catalog WHERE generation = ?
     ORDER BY name LIMIT ? OFFSET ?`,
  ).bind(generation, pageSize, (page - 1) * pageSize).all<MovieCatalogRow>();
  const total = await env.CATALOG_DB.prepare(
    'SELECT COUNT(*) AS total FROM new_ne222_movie_catalog WHERE generation = ?',
  ).bind(generation).first<{ total: number }>();
  return json({
    total: total?.total || 0,
    page,
    pageSize,
    movies: rows.results.map((row) => ({
      id: row.stream_id,
      officialTitle: row.name,
      originalTitle: row.name,
      poster: publicImageUrl(row.poster_url, env),
      backdrop: publicImageUrl(row.backdrop_url || row.poster_url, env),
      description: row.plot || '',
      genre: row.genre ? row.genre.split(',').map((item) => item.trim()).filter(Boolean) : [],
      rating: row.rating || '',
      category: row.category || '',
      streamUrl: `/api/stream/movie/${encodeURIComponent(row.stream_id)}.${encodeURIComponent(row.container_extension || 'mp4')}`,
    })),
  });
}

interface SeriesCatalogRow {
  series_id: string;
  name: string;
  poster_url: string | null;
  backdrop_url: string | null;
  plot: string | null;
  category: string | null;
  release_date: string | null;
  rating: string | null;
  genre: string | null;
}

async function listSeries(request: Request, env: Env, generation: string): Promise<Response> {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 60));
  const rows = await env.CATALOG_DB.prepare(
    `SELECT series_id, name, poster_url, backdrop_url, plot, category, release_date, rating, genre
     FROM new_ne222_series_catalog WHERE generation = ?
     ORDER BY name LIMIT ? OFFSET ?`,
  ).bind(generation, pageSize, (page - 1) * pageSize).all<SeriesCatalogRow>();
  const total = await env.CATALOG_DB.prepare(
    'SELECT COUNT(*) AS total FROM new_ne222_series_catalog WHERE generation = ?',
  ).bind(generation).first<{ total: number }>();
  return json({
    total: total?.total || 0,
    page,
    pageSize,
    series: rows.results.map((row) => ({
      id: row.series_id,
      title: row.name,
      poster: publicImageUrl(row.poster_url, env),
      backdrop: publicImageUrl(row.backdrop_url || row.poster_url, env),
      synopsis: row.plot || '',
      category: row.category || '',
      rating: row.rating || '',
      genre: row.genre ? row.genre.split(',').map((item) => item.trim()).filter(Boolean) : [],
    })),
  });
}

async function probeChannels(env: Env, generation: string): Promise<number> {
  const config = await readProviderConfig(env);
  if (!config) throw new Error('provider_not_configured');
  const providerEnv = withProviderConfig(env, config);
  const rows = await env.CATALOG_DB.prepare(
    `SELECT c.stream_id, c.container_extension
     FROM new_ne222_live_catalog c
     LEFT JOIN new_ne222_channel_health h ON h.stream_id = c.stream_id
     WHERE c.generation = ? AND (h.checked_at IS NULL OR h.checked_at < ?)
     ORDER BY h.checked_at IS NOT NULL, h.checked_at
     LIMIT 500`,
  ).bind(generation, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .all<{ stream_id: string; container_extension: string | null }>();

  const results: { id: string; status: string; checkedAt: string; httpStatus: number | null }[] = [];
  for (let offset = 0; offset < rows.results.length; offset += 10) {
    const batch = rows.results.slice(offset, offset + 10);
    const checked = await Promise.all(batch.map(async (row) => {
      let status = 'offline';
      let httpStatus: number | null = null;
      try {
        const response = await fetch(upstreamStreamUrl(providerEnv, 'live', row.stream_id, row.container_extension || ''), {
          headers: { Range: 'bytes=0-1' },
          redirect: 'follow',
          signal: AbortSignal.timeout(8000),
        });
        httpStatus = response.status;
        status = response.ok || response.status === 206 ? 'online' : 'offline';
        await response.body?.cancel();
      } catch {
        status = 'offline';
      }
      return { id: row.stream_id, status, checkedAt: new Date().toISOString(), httpStatus };
    }));
    results.push(...checked);
  }

  const statements = results.map((row) =>
    env.CATALOG_DB.prepare(
      `INSERT INTO new_ne222_channel_health (stream_id, status, checked_at, http_status)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (stream_id) DO UPDATE SET
         status = excluded.status,
         checked_at = excluded.checked_at,
         http_status = excluded.http_status`,
    ).bind(row.id, row.status, row.checkedAt, row.httpStatus),
  );
  for (let offset = 0; offset < statements.length; offset += 100) {
    await env.CATALOG_DB.batch(statements.slice(offset, offset + 100));
  }
  return results.length;
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  await ensureSchema(env.CATALOG_DB);
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (url.pathname.startsWith('/api/admin/')) {
    if (url.protocol !== 'https:') return json({ error: 'https_required' }, 400);
    if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 32 || !env.PROVIDER_ENCRYPTION_KEY || env.PROVIDER_ENCRYPTION_KEY.length < 32) {
      return json({ error: 'admin_secrets_not_configured' }, 503);
    }
    if (!await authorizedAdmin(request, env)) return json({ error: 'unauthorized' }, 401);

    if (url.pathname === '/api/admin/provider' && request.method === 'GET') {
      return json({ configured: Boolean(await readProviderConfig(env)) });
    }
    if (url.pathname === '/api/admin/provider' && request.method === 'POST') {
      if (url.protocol !== 'https:') return json({ error: 'https_required' }, 400);
      const body: unknown = await request.json();
      if (typeof body !== 'object' || body === null) return json({ error: 'invalid_request' }, 400);
      const { baseUrl, username, password, acceptInsecureHttp } = body as Record<string, unknown>;
      if (
        typeof baseUrl !== 'string' || typeof username !== 'string' || typeof password !== 'string' ||
        typeof acceptInsecureHttp !== 'boolean' || !username.trim() || !password
      ) {
        return json({ error: 'invalid_request' }, 400);
      }
      let providerUrl: URL;
      try {
        providerUrl = new URL(baseUrl);
      } catch {
        return json({ error: 'invalid_provider_url' }, 400);
      }
      if (
        !['http:', 'https:'].includes(providerUrl.protocol) ||
        providerUrl.username || providerUrl.password || providerUrl.search || providerUrl.hash
      ) {
        return json({ error: 'invalid_provider_url' }, 400);
      }
      if (providerUrl.protocol === 'http:' && !acceptInsecureHttp) {
        return json({ error: 'http_warning_not_acknowledged' }, 400);
      }
      await saveProviderConfig(env, {
        baseUrl: providerUrl.origin,
        username: username.trim(),
        password,
      });
      return json({ saved: true });
    }
    if (url.pathname === '/api/admin/sync' && request.method === 'POST') {
      if (url.protocol !== 'https:') return json({ error: 'https_required' }, 400);
      const synced = await syncCatalog(env);
      const healthChecked = await probeChannels(env, synced.generation);
      return json({ ...synced, healthChecked });
    }
    return json({ error: 'Not found' }, 404);
  }

  if (url.pathname === '/api/health' && request.method === 'GET') {
    const generation = await readActiveGeneration(env.CATALOG_DB);
    const provider = await readProviderConfig(env);
    const sync = await env.CATALOG_DB.prepare(
      "SELECT value FROM new_ne222_catalog_state WHERE key = 'last_sync'",
    ).first<{ value: string }>();
    const health = await env.CATALOG_DB.prepare(
      `SELECT status, COUNT(*) AS count FROM new_ne222_channel_health
       GROUP BY status`,
    ).all<{ status: string; count: number }>();
    return json({
      configured: Boolean(provider),
      generation,
      lastSync: sync?.value ? JSON.parse(sync.value) : null,
      health: Object.fromEntries(health.results.map((row) => [row.status, row.count])),
    });
  }

  if (url.pathname === '/api/image' && request.method === 'GET') {
    const provider = await readProviderConfig(env);
    if (!provider) return json({ error: 'provider_not_configured' }, 503);
    return proxyImage(url.searchParams.get('src'), withProviderConfig(env, provider));
  }

  const streamMatch = url.pathname.match(/^\/api\/stream\/(live|movie)\/([0-9]+)(?:\.([a-zA-Z0-9]+))?$/);
  if (streamMatch && ['GET', 'HEAD'].includes(request.method)) {
    const provider = await readProviderConfig(env);
    if (!provider) return json({ error: 'provider_not_configured' }, 503);
    return proxyStream(request, withProviderConfig(env, provider), streamMatch[1], streamMatch[2]);
  }

  const provider = await readProviderConfig(env);
  if (provider) env = withProviderConfig(env, provider);
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const generation = await readActiveGeneration(env.CATALOG_DB);
  if (url.pathname === '/api/stats') {
    if (!generation) return json({
      configured: Boolean(provider),
      totalChannels: 0,
      totalMovies: 0,
      totalSeries: 0,
      lastSync: null,
    });
    const sync = await env.CATALOG_DB.prepare(
      "SELECT value FROM new_ne222_catalog_state WHERE key = 'last_sync'",
    ).first<{ value: string }>();
    return json({
      ...(sync?.value ? JSON.parse(sync.value) : { totalChannels: 0, totalMovies: 0, totalSeries: 0 }),
      configured: Boolean(provider),
    });
  }
  if (url.pathname === '/api/channels' || url.pathname === '/api/hot-tv') {
    if (!generation) return json({ total: 0, page: 1, pageSize: 0, items: [], channels: [] });
    if (url.pathname === '/api/hot-tv') url.searchParams.set('pageSize', '12');
    const response = await listChannels(url, env, generation);
    if (url.pathname === '/api/hot-tv') {
      const data = await response.json() as { items: unknown[] };
      return json({ channels: data.items });
    }
    return response;
  }
  if (url.pathname === '/api/movies' || url.pathname === '/api/series') {
    if (!generation) return json(url.pathname === '/api/movies' ? { total: 0, movies: [] } : { total: 0, series: [] });
    return url.pathname === '/api/movies'
      ? listMovies(request, env, generation)
      : listSeries(request, env, generation);
  }
  if (url.pathname === '/api/dramas') return json({ total: 0, dramas: [] });
  if (url.pathname === '/api/music') return json({ total: 0, music: [] });
  if (url.pathname === '/api/sports') return json({ total: 0, sports: [] });
  if (url.pathname === '/api/news') return json({ total: 0, news: [] });

  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env);
      } catch (error) {
        const reason = error instanceof Error && /^provider_/.test(error.message)
          ? error.message
          : 'internal_error';
        const status = reason === 'internal_error' ? 500 : 503;
        return json({ error: reason }, status);
      }
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await ensureSchema(env.CATALOG_DB);
    if (!await readProviderConfig(env)) return;
    try {
      const synced = await syncCatalog(env);
      const checked = await probeChannels(env, synced.generation);
      const current = await env.CATALOG_DB.prepare(
        "SELECT value FROM new_ne222_catalog_state WHERE key = 'last_sync'",
      ).first<{ value: string }>();
      const metadata = current?.value ? JSON.parse(current.value) as Record<string, unknown> : {};
      metadata.healthChecked = checked;
      metadata.healthCheckedAt = new Date().toISOString();
      await env.CATALOG_DB.prepare(
        `INSERT INTO new_ne222_catalog_state (key, value) VALUES ('last_sync', ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      ).bind(JSON.stringify(metadata)).run();
    } catch (error) {
      const code = error instanceof Error && /^[a-z_]+(?:_[0-9]+)?$/.test(error.message)
        ? error.message
        : 'sync_failed';
      await env.CATALOG_DB.prepare(
        `INSERT INTO new_ne222_catalog_state (key, value) VALUES ('last_error', ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      ).bind(JSON.stringify({ at: new Date().toISOString(), code })).run();
      console.error('Catalog refresh failed:', code);
    }
  },
};
