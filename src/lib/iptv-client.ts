// IQRAPRIME — browser-direct Xtream Codes client.
// The provider panel is reached straight from the viewer's browser (no server proxy),
// so the catalog and streams work wherever the app is viewed.
// Default line ships with the app (env); a personal line can replace it per device.

export interface IptvLine {
  host: string;
  user: string;
  pass: string;
}

export const DEFAULT_LINE: IptvLine = {
  host: (process.env.NEXT_PUBLIC_IPTV_HOST || "http://stream.playbeat.live:8880").trim(),
  user: (process.env.NEXT_PUBLIC_IPTV_USER || "").trim(),
  pass: (process.env.NEXT_PUBLIC_IPTV_PASS || "").trim(),
};

export function normalizeLine(l: Partial<IptvLine>): IptvLine | null {
  let host = (l.host || "").trim();
  if (!host) return null;
  if (!/^https?:\/\//i.test(host)) host = `http://${host}`;
  host = host.replace(/\/+$/, "");
  const user = (l.user || "").trim();
  const pass = (l.pass || "").trim();
  if (!user || !pass) return null;
  return { host, user, pass };
}

export function activeLine(): IptvLine | null {
  return DEFAULT_LINE.user && DEFAULT_LINE.pass ? DEFAULT_LINE : null;
}

// ---------- cache ----------
const CACHE_TTL = 10 * 60 * 1000;
const memCache = new Map<string, { at: number; data: unknown }>();

function cacheGet<T>(key: string): T | null {
  const hit = memCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data as T;
  return null;
}

function cacheSet(key: string, data: unknown) {
  memCache.set(key, { at: Date.now(), data });
}

// ---------- low-level fetch ----------
export class IptvError extends Error {
  code: string;
  constructor(code: string, detail?: string) {
    super(detail || code);
    this.code = code;
  }
}

async function api<T>(line: IptvLine, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${line.host}/player_api.php`);
  url.searchParams.set("username", line.user);
  url.searchParams.set("password", line.pass);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    if (/timeout|aborted/i.test(msg)) throw new IptvError("timeout", "Provider did not respond within 20s.");
    if (/Failed to fetch|NetworkError|load failed/i.test(msg))
      throw new IptvError(
        "unreachable",
        `Could not reach ${line.host} — check the server address, your connection, or provider status.`
      );
    throw new IptvError("network", msg);
  }
  if (!res.ok) throw new IptvError("http_" + res.status, `Provider returned HTTP ${res.status}.`);
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new IptvError("bad_response", "Provider returned a non-JSON response (wrong address or portal).");
  }
}

// ---------- auth ----------
export interface AuthInfo {
  auth: boolean;
  status?: string | null;
  expiry?: string | null;
  username?: string;
  isTrial?: boolean;
  activeCons?: string | number | null;
}

export async function checkAuth(line: IptvLine): Promise<AuthInfo> {
  interface Resp {
    user_info?: {
      auth?: number;
      status?: string;
      exp_date?: string | number | null;
      username?: string;
      is_trial?: string;
      active_cons?: string | number;
    };
  }
  const d = await api<Resp>(line, {});
  const ui = d?.user_info;
  return {
    auth: Number(ui?.auth) === 1,
    status: ui?.status ?? null,
    expiry: ui?.exp_date ? new Date(Number(ui.exp_date) * 1000).toISOString() : null,
    username: ui?.username || line.user,
    isTrial: ui?.is_trial === "1",
    activeCons: ui?.active_cons ?? null,
  };
}

// ---------- catalog ----------
export interface VodStream {
  num?: number;
  name: string;
  stream_id: number;
  stream_icon?: string;
  rating?: string | number;
  added?: string | number;
  category_id?: number | string;
  container_extension?: string;
  direct_source?: string;
}

export interface SeriesItem {
  num?: number;
  name: string;
  series_id: number;
  cover?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  releaseDate?: string;
  rating?: string | number;
  episode_run_time?: string | number[];
  category_id?: number | string;
  backdrop_path?: string[];
  last_modified?: string | number;
}

export interface Category {
  category_id: number | string;
  category_name: string;
}

export async function getVodCategories(line: IptvLine): Promise<Category[]> {
  const key = `vc:${line.host}:${line.user}`;
  const hit = cacheGet<Category[]>(key);
  if (hit) return hit;
  const d = await api<Category[]>(line, { action: "get_vod_categories" });
  const list = Array.isArray(d) ? d : [];
  cacheSet(key, list);
  return list;
}

export async function getSeriesCategories(line: IptvLine): Promise<Category[]> {
  const key = `sc:${line.host}:${line.user}`;
  const hit = cacheGet<Category[]>(key);
  if (hit) return hit;
  const d = await api<Category[]>(line, { action: "get_series_categories" });
  const list = Array.isArray(d) ? d : [];
  cacheSet(key, list);
  return list;
}

export async function getVodStreams(line: IptvLine): Promise<VodStream[]> {
  const key = `vod:${line.host}:${line.user}`;
  const hit = cacheGet<VodStream[]>(key);
  if (hit) return hit;
  const d = await api<VodStream[]>(line, { action: "get_vod_streams" });
  const list = Array.isArray(d) ? d : [];
  cacheSet(key, list);
  return list;
}

export async function getSeries(line: IptvLine): Promise<SeriesItem[]> {
  const key = `ser:${line.host}:${line.user}`;
  const hit = cacheGet<SeriesItem[]>(key);
  if (hit) return hit;
  const d = await api<SeriesItem[]>(line, { action: "get_series" });
  const list = Array.isArray(d) ? d : [];
  cacheSet(key, list);
  return list;
}

// ---------- details ----------
export interface VodInfoResult {
  name: string;
  poster: string;
  backdrop: string;
  plot: string;
  genre: string;
  cast: string;
  director: string;
  year: number | null;
  rating: number;
  duration: string;
  container: string;
}

export async function getVodInfo(line: IptvLine, vodId: number): Promise<VodInfoResult | null> {
  interface Resp {
    info?: {
      name?: string;
      movie_image?: string;
      cover_big?: string;
      backdrop_path?: string[] | string;
      plot?: string;
      genre?: string;
      cast?: string;
      director?: string;
      releasedate?: string;
      year?: string | number;
      rating?: string | number;
      duration?: string;
      video?: { container?: string };
    };
    movie_data?: { stream_id?: number; name?: string; container_extension?: string };
  }
  const d = await api<Resp>(line, { action: "get_vod_info", vod_id: String(vodId) });
  const i = d?.info;
  if (!i && !d?.movie_data) return null;
  const bp = Array.isArray(i?.backdrop_path) ? i.backdrop_path[0] : i?.backdrop_path;
  const year = i?.year
    ? Number(i.year)
    : i?.releasedate
      ? new Date(i.releasedate).getFullYear() || null
      : null;
  return {
    name: i?.name || d?.movie_data?.name || `Movie #${vodId}`,
    poster: i?.movie_image || i?.cover_big || "",
    backdrop: bp || "",
    plot: i?.plot || "",
    genre: i?.genre || "",
    cast: i?.cast || "",
    director: i?.director || "",
    year: Number.isFinite(year) ? (year as number) : null,
    rating: Math.round((Number(i?.rating) || 0) * 10) / 10,
    duration: i?.duration || "",
    container: d?.movie_data?.container_extension || i?.video?.container || "mp4",
  };
}

export interface EpisodeInfo {
  id: string;
  episode_num: number;
  title: string;
  container_extension: string;
  image?: string;
  plot?: string;
  duration?: string;
  season: number;
}

export interface SeriesInfoResult {
  name: string;
  poster: string;
  backdrop: string;
  plot: string;
  genre: string;
  cast: string;
  year: number | null;
  rating: number;
  episodes: EpisodeInfo[];
}

export async function getSeriesInfo(line: IptvLine, seriesId: number): Promise<SeriesInfoResult | null> {
  interface Resp {
    info?: {
      name?: string;
      cover?: string;
      backdrop_path?: string[] | string;
      plot?: string;
      cast?: string;
      genre?: string;
      releaseDate?: string;
      rating?: string | number;
    };
    episodes?: Record<
      string,
      Array<{
        id: string;
        episode_num: string | number;
        title: string;
        container_extension?: string;
        info?: { movie_image?: string; plot?: string; duration?: string };
      }>
    >;
  }
  const d = await api<Resp>(line, { action: "get_series_info", series_id: String(seriesId) });
  const episodes: EpisodeInfo[] = [];
  if (d.episodes) {
    for (const [season, list] of Object.entries(d.episodes)) {
      for (const e of list || []) {
        episodes.push({
          id: e.id,
          episode_num: Number(e.episode_num) || 0,
          title: e.title || `Episode ${e.episode_num}`,
          container_extension: e.container_extension || "mp4",
          image: e.info?.movie_image,
          plot: e.info?.plot,
          duration: e.info?.duration,
          season: Number(season) || 1,
        });
      }
    }
  }
  episodes.sort((a, b) => a.season - b.season || a.episode_num - b.episode_num);
  const i = d?.info;
  const bp = Array.isArray(i?.backdrop_path) ? i.backdrop_path[0] : i?.backdrop_path;
  return {
    name: i?.name || `Series #${seriesId}`,
    poster: i?.cover || "",
    backdrop: bp || "",
    plot: i?.plot || "",
    genre: i?.genre || "",
    cast: i?.cast || "",
    year: i?.releaseDate ? new Date(i.releaseDate).getFullYear() || null : null,
    rating: Math.round((Number(i?.rating) || 0) * 10) / 10,
    episodes,
  };
}

// ---------- stream URLs (direct media — no CORS needed for <video>) ----------
export function movieStreamUrl(line: IptvLine, streamId: number, ext = "mp4"): string {
  return `${line.host}/movie/${encodeURIComponent(line.user)}/${encodeURIComponent(line.pass)}/${streamId}.${ext}`;
}

export function episodeStreamUrl(line: IptvLine, episodeId: number, ext = "mp4"): string {
  return `${line.host}/series/${encodeURIComponent(line.user)}/${encodeURIComponent(line.pass)}/${episodeId}.${ext}`;
}

export function liveStreamUrl(line: IptvLine, streamId: number, ext = "m3u8"): string {
  return `${line.host}/live/${encodeURIComponent(line.user)}/${encodeURIComponent(line.pass)}/${streamId}.${ext}`;
}
