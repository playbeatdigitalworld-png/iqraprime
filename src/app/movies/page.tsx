import type { Metadata } from "next";
import BrowseGrid from "@/components/BrowseGrid";
import { MOVIE_TITLES, ALL_GENRES } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Movies",
  description: "Browse curated movies on IQRAPRIME — Bollywood, Hollywood and Lollywood hits.",
};

const movieGenres = Array.from(new Set(MOVIE_TITLES.flatMap((t) => t.genres))).sort();

export default function MoviesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-16">
      <header className="mb-8">
        <p className="text-xs font-bold tracking-[0.3em] text-gold">BROWSE</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-white">
          Movies
        </h1>
        <p className="mt-2 text-sm text-mist max-w-2xl">
          {MOVIE_TITLES.length} handpicked films — blockbusters, classics and award winners from
          Bollywood, Hollywood and Lollywood.
        </p>
      </header>
      <BrowseGrid items={MOVIE_TITLES} allGenres={movieGenres.length ? movieGenres : ALL_GENRES} />
    </div>
  );
}
