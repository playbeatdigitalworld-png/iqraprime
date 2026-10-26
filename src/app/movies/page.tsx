import type { Metadata } from "next";
import RegionBrowser from "@/components/RegionBrowser";
import { MOVIE_TITLES, REGION_POOLS } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Movies",
  description:
    "Browse movies on IQRAPRIME — Indian, Pakistani, Bangladeshi, South Indian and Hollywood cinema.",
};

export default function MoviesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-16">
      <header className="mb-8">
        <p className="text-xs font-bold tracking-[0.3em] text-gold">BROWSE</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-white">Movies</h1>
        <p className="mt-2 text-sm text-mist max-w-2xl">
          {MOVIE_TITLES.length} handpicked films across all countries — Bollywood, Lollywood,
          Bangladeshi, South Indian and Hollywood hits.
        </p>
      </header>
      <RegionBrowser pools={REGION_POOLS} />
    </div>
  );
}
