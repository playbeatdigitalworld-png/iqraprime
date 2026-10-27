import "server-only";

/**
 * IQRAPRIME provider bridge — imports the IPTV/VOD provider catalog server-side
 * and serves direct playback URLs to the built-in PrimePlayer.
 * Credentials come from env: P_HOST / P_USER / P_PASS (never exposed to the client).
 */

export interface ProviderVod {
  num: number;
  name: string;
  stream_icon?: string;
  rating?: string;
  added?: string;
  category_id?: string;
  container_extension?: string;
  direct_source?: string;
}

export interface ProviderSeries {
  series_id: number;
  name: string;
  cover?: string;
  plot?: string;
  cast?: string;
  genre?: string;
  releaseDate?: string;
  last_modified?: string;
  category_id?: string;
}

export interface ProviderCategory {
  category_id: string;
  category_name: string;
  count?: number;
}

export interface ResolveResult {
  kind: "vod" | "series" | "live";
  id: string;
  name: string;
  url: string;
  container: string;
  poster?: string;
  episodes?: number;
}

const HOST = (process.env.P_HOST || "").replace(/\/+$/, "");
const USER = process.env.P_USER || "";
const PASS = process.env.P_PASS || "";
const BASE = HOST.startsWith("http") ? HOST : `http://${HOST}`;

export function providerConfigured(): boolean {
  return Boolean(BASE && USER && PASS);
}

const TTL = 15 * 60 * 1000;

const cache: {
  vod?: { at: number; data: ProviderVod[] };
  series?: { at: number; data: ProviderSeries[] };
  vodCats?: { at: number; data: ProviderCategory[] };
  seriesCats?: { at: number; data: ProviderCategory[] };
} = {};

async function api<T>(action: string, extra: Record<string, string> = {}): Promise<T | null> {
  if (!providerConfigured()) return null;
  const url = new URL(`${BASE}/player_api.php`);
  url.searchParams.set("username", USER);
  url.searchParams.set("password", PASS);
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getVodStreams(): Promise<ProviderVod[] | null> {
  if (cache.vod && Date.now() - cache.vod.at < TTL) return cache.vod.data;
  const data = await api<ProviderVod[]>("get_vod_streams");
  if (Array.isArray(data)) {
    cache.vod = { at: Date.now(), data };
    return data;
  }
  return null;
}

export async function getSeries(): Promise<ProviderSeries[] | null> {
  if (cache.series && Date.now() - cache.series.at < TTL) return cache.series.data;
  const data = await api<ProviderSeries[]>("get_series");
  if (Array.isArray(data)) {
    cache.series = { at: Date.now(), data };
    return data;
  }
  return null;
}

export async function getVodCategories(): Promise<ProviderCategory[] | null> {
  if (cache.vodCats && Date.now() - cache.vodCats.at < TTL) return cache.vodCats.data;
  const data = await api<ProviderCategory[]>("get_vod_categories");
  if (Array.isArray(data)) {
    cache.vodCats = { at: Date.now(), data };
    return data;
  }
  return null;
}

export async function getSeriesCategories(): Promise<ProviderCategory[] | null> {
  if (cache.seriesCats && Date.now() - cache.seriesCats.at < TTL) return cache.seriesCats.data;
  const data = await api<ProviderCategory[]>("get_series_categories");
  if (Array.isArray(data)) {
    cache.seriesCats = { at: Date.now(), data };
    return data;
  }
  return null;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\((19|20)\d{2}\)/g, " ")
    .replace(/[._\-+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function vodUrl(v: ProviderVod): { url: string; container: string } {
  const container = v.container_extension || "mp4";
  // Same-origin media proxy hides credentials and keeps HTTPS pages free of
  // mixed content (the panel's media edge nodes are plain HTTP).
  return { url: `/api/media/movie/${v.num}.${container}`, container };
}

function seriesUrl(seriesId: number, episodeId: number, container = "mp4"): string {
  return `/api/media/series/${episodeId}.${container}`;
}

/** Best-effort VOD match for a curated title (name + year). */
export async function resolveVodByTitle(
  title: string,
  year?: number
): Promise<ResolveResult | null> {
  const list = await getVodStreams();
  if (!list?.length) return null;
  const q = norm(title);
  const candidates = list.filter((v) => norm(v.name).includes(q));
  if (!candidates.length) return null;
  const scored = candidates
    .map((v) => {
      let s = 0;
      const exact = norm(v.name) === q;
      if (exact) s += 10;
      if (year && v.name.includes(String(year))) s += 6;
      s += (v.rating ? Number(v.rating) : 0) / 10;
      return { v, s };
    })
    .sort((a, b) => b.s - a.s);
  const best = scored[0].v;
  const { url, container } = vodUrl(best);
  return {
    kind: "vod",
    id: String(best.num),
    name: best.name,
    url,
    container,
    poster: best.stream_icon,
  };
}

/** Find a provider series by name; return first-episode stream + episode count. */
export async function resolveSeriesByTitle(title: string): Promise<ResolveResult | null> {
  const list = await getSeries();
  if (!list?.length) return null;
  const q = norm(title);
  const match =
    list.find((s) => norm(s.name) === q) || list.find((s) => norm(s.name).includes(q));
  if (!match) return null;
  const info = await api<{
    episodes: Record<string, Array<{ id: string; episode_num: number; container_extension?: string }>>;
  }>("get_series_info", { series_id: String(match.series_id) });
  if (!info?.episodes) return null;
  const seasonKeys = Object.keys(info.episodes).sort();
  const firstSeason = info.episodes[seasonKeys[0]] || [];
  const firstEp = firstSeason[0];
  if (!firstEp) return null;
  const total = Object.values(info.episodes).reduce((a, eps) => a + eps.length, 0);
  return {
    kind: "series",
    id: String(match.series_id),
    name: match.name,
    url: seriesUrl(match.series_id, Number(firstEp.id), firstEp.container_extension || "mp4"),
    container: firstEp.container_extension || "mp4",
    poster: match.cover,
    episodes: total,
  };
}

/** Provider catalog summary for the browse UI. */
export async function providerSummary() {
  const [vod, series, vodCats, seriesCats] = await Promise.all([
    getVodStreams(),
    getSeries(),
    getVodCategories(),
    getSeriesCategories(),
  ]);
  return {
    configured: providerConfigured(),
    vodCount: vod?.length ?? 0,
    seriesCount: series?.length ?? 0,
    vodCategories: (vodCats || []).map((c) => ({
      id: c.category_id,
      name: c.category_name,
      count: vod ? vod.filter((v) => v.category_id === c.category_id).length : 0,
    })),
    seriesCategories: (seriesCats || []).map((c) => ({
      id: c.category_id,
      name: c.category_name,
      count: series ? series.filter((s) => s.category_id === c.category_id).length : 0,
    })),
  };
}

/** Browse provider items by category with paging. */
export async function browseProvider(
  kind: "vod" | "series",
  categoryId?: string,
  page = 1,
  pageSize = 60
) {
  const list = kind === "vod" ? await getVodStreams() : await getSeries();
  if (!list) return { items: [], total: 0, page };
  const filtered = categoryId ? list.filter((x) => x.category_id === categoryId) : list;
  const start = (page - 1) * pageSize;
  const items = filtered
    .slice(start, start + pageSize)
    .map((x) => ({
      id: kind === "vod" ? String((x as ProviderVod).num) : String((x as ProviderSeries).series_id),
      name: x.name,
      poster: (x as ProviderVod).stream_icon || (x as ProviderSeries).cover,
      year:
        (x as ProviderVod).added?.slice(0, 4) || (x as ProviderSeries).releaseDate?.slice(0, 4) || "",
      rating: (x as ProviderVod).rating || "",
    }));
  return { items, total: filtered.length, page };
}

/** Search across provider VOD + series. */
export async function searchProvider(q: string) {
  const nq = norm(q);
  if (!nq) return { vod: [], series: [] };
  const [vod, series] = await Promise.all([getVodStreams(), getSeries()]);
  return {
    vod: (vod || [])
      .filter((v) => norm(v.name).includes(nq))
      .slice(0, 60)
      .map((v) => ({
        id: String(v.num),
        name: v.name,
        poster: v.stream_icon,
        rating: v.rating || "",
      })),
    series: (series || [])
      .filter((s) => norm(s.name).includes(nq))
      .slice(0, 60)
      .map((s) => ({ id: String(s.series_id), name: s.name, poster: s.cover, rating: "" })),
  };
}

/** Direct stream URL resolution for player. */
export async function resolveStream(
  kind: "vod" | "series" | "live",
  id: string,
  episodeId?: string
): Promise<ResolveResult | null> {
  if (!providerConfigured()) return null;
  if (kind === "vod") {
    const list = await getVodStreams();
    const v = list?.find((x) => String(x.num) === id);
    if (!v) return null;
    const { url, container } = vodUrl(v);
    return { kind, id, name: v.name, url, container, poster: v.stream_icon };
  }
  if (kind === "series") {
    const info = await api<{
      episodes: Record<string, Array<{ id: string; container_extension?: string }>>;
    }>("get_series_info", { series_id: id });
    if (!info?.episodes) return null;
    let ep: { id: string; container_extension?: string } | undefined;
    if (episodeId) {
      ep = Object.values(info.episodes).flat().find((e) => e.id === episodeId);
    } else {
      ep = Object.values(info.episodes).flat()[0];
    }
    if (!ep) return null;
    const container = ep.container_extension || "mp4";
    return {
      kind,
      id,
      name: `Episode ${ep.id}`,
      url: seriesUrl(Number(id), Number(ep.id), container),
      container,
    };
  }
  // live
  const container = "m3u8";
  return { kind, id, name: "Live", url: `${BASE}/live/${USER}/${PASS}/${id}.${container}`, container };
}
