import { MOVIES, type Movie } from "@/data/movies";
import { DRAMAS, type Drama } from "@/data/dramas";

export type { Movie, Drama };

export interface Title {
  id: string;
  kind: "movie" | "drama";
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
  poster: `/posters/${m.id}.svg`,
  backdrop: `/backdrops/${m.id}.svg`,
  meta: `${m.duration} · ${m.language}`,
});

const dramaToTitle = (d: Drama): Title => ({
  id: d.id,
  kind: "drama",
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
  poster: `/posters/${d.id}.svg`,
  backdrop: `/backdrops/${d.id}.svg`,
  meta: `S${d.seasons} · ${d.episodes} Eps · ${d.network}`,
});

export const ALL_TITLES: Title[] = [
  ...MOVIES.map(movieToTitle),
  ...DRAMAS.map(dramaToTitle),
];

export const MOVIE_TITLES = ALL_TITLES.filter((t) => t.kind === "movie");
export const DRAMA_TITLES = ALL_TITLES.filter((t) => t.kind === "drama");

export const TRENDING = ALL_TITLES.filter((t) => t.trending).sort(
  (a, b) => b.popularity - a.popularity
);

export const HERO_POOL = [...TRENDING, ...ALL_TITLES.filter((t) => t.popularity >= 90)].slice(0, 5);

export const TOP_RATED = [...ALL_TITLES].sort((a, b) => b.rating - a.rating).slice(0, 20);

export const NEW_RELEASES = [...ALL_TITLES]
  .sort((a, b) => b.year - a.year || b.popularity - a.popularity)
  .slice(0, 20);

export function byGenre(kind: "all" | "movie" | "drama", genre: string): Title[] {
  const pool = kind === "movie" ? MOVIE_TITLES : kind === "drama" ? DRAMA_TITLES : ALL_TITLES;
  if (!genre || genre === "All") return pool;
  return pool.filter((t) => t.genres.some((g) => g.toLowerCase() === genre.toLowerCase()));
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
    const hay = [t.title, ...t.cast, ...t.genres, t.language, String(t.year)].join(" ").toLowerCase();
    return hay.includes(query);
  }).sort((a, b) => b.popularity - a.popularity);
}

export function dramaById(id: string): Drama | undefined {
  return DRAMAS.find((d) => d.id === id);
}

export const DRAMA_EXTRA = (id: string): (Drama | undefined) => DRAMAS.find((d) => d.id === id);

export const ALL_GENRES = Array.from(new Set(ALL_TITLES.flatMap((t) => t.genres))).sort();
