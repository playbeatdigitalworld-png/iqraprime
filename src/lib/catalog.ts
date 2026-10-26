import { MOVIES, type Movie } from "@/data/movies";
import { MOVIES_EXTRA } from "@/data/movies-extra";
import { DRAMAS, type Drama } from "@/data/dramas";
import { WEB_SERIES } from "@/data/webseries";
import { POSTER_MANIFEST } from "@/data/poster-manifest";

export type { Movie, Drama };

export type TitleKind = "movie" | "drama" | "series";

export interface Title {
  id: string;
  kind: TitleKind;
  title: string;
  year: number;
  rating: number;
  genres: string[];
  language: string;
  cast: string[];
  popularity: number;
  trending?: boolean;
  palette: [string, string];
  synopsis: string;
  poster: string;
  backdrop: string;
  meta: string;
}

/** Real photo poster if fetched, else branded SVG art */
const posterFor = (id: string, fallback: string): string =>
  POSTER_MANIFEST[id] ? `/art/${POSTER_MANIFEST[id]}` : fallback;

const kindLabel = (k: TitleKind) =>
  k === "movie" ? "MOVIE" : k === "drama" ? "DRAMA SERIES" : "WEB SERIES";

const movieToTitle = (m: Movie): Title => ({
  id: m.id,
  kind: "movie",
  title: m.title,
  year: m.year,
  rating: m.rating,
  genres: m.genres,
  language: m.language,
  cast: m.cast,
  popularity: m.popularity,
  trending: m.trending,
  palette: m.palette as [string, string],
  synopsis: m.synopsis,
  poster: posterFor(m.id, `/posters/${m.id}.svg`),
  backdrop: `/backdrops/${m.id}.svg`,
  meta: `${m.duration} · ${m.language}`,
});

const serialToTitle = (d: Drama, kind: TitleKind): Title => ({
  id: d.id,
  kind,
  title: d.title,
  year: d.year,
  rating: d.rating,
  genres: d.genres,
  language: d.language,
  cast: d.cast,
  popularity: d.popularity,
  trending: d.trending,
  palette: d.palette as [string, string],
  synopsis: d.synopsis,
  poster: posterFor(d.id, `/posters/${d.id}.svg`),
  backdrop: `/backdrops/${d.id}.svg`,
  meta: `S${d.seasons} · ${d.episodes} Eps · ${d.network}`,
});

/** Dedupe by id then by normalized title, preferring titles that have real poster art. */
function dedupeTitles(titles: Title[]): Title[] {
  const seenId = new Set<string>();
  const seenTitle = new Set<string>();
  const out: Title[] = [];
  // pass 1: entries with real art win; pass 2 fills the rest
  for (const pass of [0, 1]) {
    for (const t of titles) {
      if (pass === 0 && !POSTER_MANIFEST[t.id]) continue;
      if (pass === 1 && seenId.has(t.id)) continue;
      const normTitle = t.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seenId.has(t.id) || seenTitle.has(normTitle)) continue;
      seenId.add(t.id);
      seenTitle.add(normTitle);
      out.push(t);
    }
  }
  return out;
}

export const ALL_TITLES: Title[] = dedupeTitles([
  ...MOVIES.map(movieToTitle),
  ...MOVIES_EXTRA.map(movieToTitle),
  ...DRAMAS.map((d) => serialToTitle(d, "drama")),
  ...WEB_SERIES.map((d) => serialToTitle(d, "series")),
]);

export const MOVIE_TITLES = ALL_TITLES.filter((t) => t.kind === "movie");
export const DRAMA_TITLES = ALL_TITLES.filter((t) => t.kind === "drama");
export const SERIES_TITLES = ALL_TITLES.filter((t) => t.kind === "series");

/** Region pools for the Movies page country filter */
export const REGION_POOLS: Record<string, Title[]> = {
  Bollywood: MOVIE_TITLES.filter((t) => t.language === "Hindi"),
  "Pakistani / Lollywood": MOVIE_TITLES.filter((t) => ["Punjabi", "Urdu"].includes(t.language)),
  Bangladeshi: MOVIE_TITLES.filter((t) => t.language === "Bangla"),
  "South Indian": MOVIE_TITLES.filter((t) => ["Telugu", "Tamil", "Kannada", "Malayalam"].includes(t.language)),
  "Hollywood & International": MOVIE_TITLES.filter((t) => ["English", "Korean"].includes(t.language)),
};

export const TRENDING = ALL_TITLES.filter((t) => t.trending).sort(
  (a, b) => b.popularity - a.popularity
);

export const HERO_POOL = [...TRENDING, ...ALL_TITLES.filter((t) => t.popularity >= 92)]
  .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
  .slice(0, 6);

export const TOP_RATED = [...ALL_TITLES].sort((a, b) => b.rating - a.rating).slice(0, 20);

export const NEW_RELEASES = [...ALL_TITLES]
  .sort((a, b) => b.year - a.year || b.popularity - a.popularity)
  .slice(0, 20);

export function byKind(kind: "all" | TitleKind): Title[] {
  if (kind === "all") return ALL_TITLES;
  return ALL_TITLES.filter((t) => t.kind === kind);
}

export function byId(id: string): Title | undefined {
  return ALL_TITLES.find((t) => t.id === id);
}

export function related(title: Title, count = 12): Title[] {
  const score = (t: Title) => {
    if (t.id === title.id) return -1;
    let s = 0;
    if (t.kind === title.kind) s += 2;
    s += t.genres.filter((g) => title.genres.includes(g)).length * 3;
    if (t.language === title.language) s += 2;
    s += Math.max(0, 10 - Math.abs(t.year - title.year) / 2);
    return s;
  };
  return ALL_TITLES.map((t) => ({ t, s: score(t) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, count)
    .map((x) => x.t);
}

export function searchTitles(q: string): Title[] {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  return ALL_TITLES.filter((t) => {
    const hay = [t.title, ...t.cast, ...t.genres, t.language, t.kind, String(t.year)]
      .join(" ")
      .toLowerCase();
    return hay.includes(query);
  }).sort((a, b) => b.popularity - a.popularity);
}

/** Serial extras (episodes etc.) for dramas and web series */
export function serialExtra(id: string): Drama | undefined {
  return DRAMAS.find((d) => d.id === id) || WEB_SERIES.find((d) => d.id === id);
}

export const ALL_GENRES = Array.from(new Set(ALL_TITLES.flatMap((t) => t.genres))).sort();

export const COUNTS = {
  movies: MOVIE_TITLES.length,
  dramas: DRAMA_TITLES.length,
  series: SERIES_TITLES.length,
  total: ALL_TITLES.length,
};

export { kindLabel };
