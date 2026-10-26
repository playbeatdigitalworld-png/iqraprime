// IQRAPRIME Xtream provider bridge (server-side only)
// Credentials come from env (P_HOST/P_USER/P_PASS) or the user's own line
// sent via the x-iptv-line header (base64 JSON {host,user,pass}).

export interface IptvLine {
  host: string;
  user: string;
  pass: string;
}

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
}

export interface Category {
  category_id: number | string;
  category_name: string;
}

const listCache = new Map<
  string,
  { at: number; data: unknown }
>();
const TTL = 10 * 60 * 1000;

export function lineFromEnv(): IptvLine | null {
  const host = process.env.P_HOST;
  const user = process.env.P_USER;
  const pass = process.env.P_PASS;
  if (!host || !user || !pass) return null;
  return normalizeLine({ host, user, pass });
}

export function lineFromHeader(headerValue: string | null): IptvLine | null {
  if (!headerValue) return null;
  try {
    const json = Buffer.from(headerValue, "base64").toString("utf8");
    const obj = JSON.parse(json) as Partial<IptvLine>;
    if (!obj.host || !obj.user || !obj.pass) return null;
    return normalizeLine(obj as IptvLine);
  } catch {
    return null;
  }
}

export function resolveLine(req: Request): IptvLine | null {
  const h = req.headers.get("x-iptv-line");
  return lineFromHeader(h) || lineFromEnv();
}

export function normalizeLine(l: IptvLine): IptvLine {
  let host = (l.host || "").trim();
  if (!/^https?:\/\//i.test(host)) host = `http://${host}`;
  host = host.replace(/\/+$/, "");
  return { host, user: (l.user || "").trim(), pass: (l.pass || "").trim() };
}

async function xtreamFetch<T>(line: IptvLine, params: Record<string, string>): Promise<T> {
  const url = new URL(`${line.host}/player_api.php`);
  url.searchParams.set("username", line.user);
  url.searchParams.set("password", line.pass);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(20000),
    headers: { "User-Agent": "IQRAPRIME/1.0" },
  });
  if (!res.ok) throw new Error(`provider_http_${res.status}`);
  const data = (await res.json()) as T;
  return data;
}

export async function authCheck(line: IptvLine) {
  interface AuthResp {
    user_info?: { auth?: number; status?: string; exp_date?: string | number; username?: string };
    server_info?: { url?: string; port?: string };
  }
  const data = await xtreamFetch<AuthResp>(line, {});
  const auth = Number(data?.user_info?.auth) === 1;
  return {
    auth,
    status: data?.user_info?.status || null,
    expiry: data?.user_info?.exp_date
      ? new Date(Number(data.user_info.exp_date) * 1000).toISOString()
      : null,
    username: data?.user_info?.username || line.user,
  };
}

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = listCache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data as T;
  const data = await fn();
  listCache.set(key, { at: Date.now(), data });
  return data;
}

export async function getCategories(line: IptvLine, type: "vod" | "series"): Promise<Category[]> {
  return cached(`cat:${line.host}:${line.user}:${type}`, () =>
    xtreamFetch<Category[]>(line, { action: type === "vod" ? "get_vod_categories" : "get_series_categories" })
  );
}

export async function getVodStreams(line: IptvLine): Promise<VodStream[]> {
  return cached(`vod:${line.host}:${line.user}`, () =>
    xtreamFetch<VodStream[]>(line, { action: "get_vod_streams" })
  );
}

export async function getSeries(line: IptvLine): Promise<SeriesItem[]> {
  return cached(`series:${line.host}:${line.user}`, () =>
    xtreamFetch<SeriesItem[]>(line, { action: "get_series" })
  );
}

export async function getVodInfo(line: IptvLine, vodId: number) {
  interface VodInfoResp {
    info?: Record<string, unknown>;
    movie_data?: { stream_id?: number; name?: string; container_extension?: string };
  }
  return xtreamFetch<VodInfoResp>(line, { action: "get_vod_info", vod_id: String(vodId) });
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

export async function getSeriesInfo(line: IptvLine, seriesId: number) {
  interface SeriesInfoResp {
    info?: {
      name?: string;
      cover?: string;
      plot?: string;
      cast?: string;
      genre?: string;
      releaseDate?: string;
      rating?: string | number;
      backdrop_path?: string[];
      episode_run_time?: string | number;
    };
    episodes?: Record<string, Array<{
      id: string;
      episode_num: string | number;
      title: string;
      container_extension?: string;
      info?: { movie_image?: string; plot?: string; duration?: string };
    }>>;
  }
  const data = await xtreamFetch<SeriesInfoResp>(line, {
    action: "get_series_info",
    series_id: String(seriesId),
  });
  const episodes: EpisodeInfo[] = [];
  if (data.episodes) {
    for (const [season, list] of Object.entries(data.episodes)) {
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
  return { info: data.info || {}, episodes };
}

export function movieStreamUrl(line: IptvLine, streamId: number, ext = "mp4") {
  return `${line.host}/movie/${encodeURIComponent(line.user)}/${encodeURIComponent(line.pass)}/${streamId}.${ext}`;
}

export function episodeStreamUrl(line: IptvLine, episodeId: number, ext = "mp4") {
  return `${line.host}/series/${encodeURIComponent(line.user)}/${encodeURIComponent(line.pass)}/${episodeId}.${ext}`;
}

// ---- matching helper: map a curated title onto provider content ----
const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

export async function matchVod(line: IptvLine, title: string, year?: number) {
  const all = await getVodStreams(line);
  const target = norm(title);
  let best: { s: VodStream; score: number } | null = null;
  for (const s of all) {
    const n = norm(s.name || "");
    if (!n) continue;
    let score = 0;
    if (n === target) score = 100;
    else if (n.includes(target) || target.includes(n)) score = 80;
    else if (target.split(" ").length > 1 && target.split(" ").every((w) => n.includes(w))) score = 60;
    if (!score) continue;
    if (year) {
      const added = typeof s.added === "string" || typeof s.added === "number" ? new Date(Number(s.added) * 1000 || String(s.added)).getFullYear() : undefined;
      if (added && Math.abs(added - year) <= 2) score += 10;
    }
    if (!best || score > best.score) best = { s, score };
  }
  return best && best.score >= 60 ? best.s : null;
}

export async function matchSeries(line: IptvLine, title: string) {
  const all = await getSeries(line);
  const target = norm(title);
  let best: { s: SeriesItem; score: number } | null = null;
  for (const s of all) {
    const n = norm(s.name || "");
    if (!n) continue;
    let score = 0;
    if (n === target) score = 100;
    else if (n.includes(target) || target.includes(n)) score = 80;
    if (!score) continue;
    if (!best || score > best.score) best = { s, score };
  }
  return best && best.score >= 80 ? best.s : null;
}
