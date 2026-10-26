import type { Metadata } from "next";
import BrowseGrid from "@/components/BrowseGrid";
import { SERIES_TITLES } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Web Series",
  description:
    "Hindi and Urdu web series on IQRAPRIME — Scam 1992, The Family Man, Panchayat, Churails and more.",
};

const seriesGenres = Array.from(new Set(SERIES_TITLES.flatMap((t) => t.genres))).sort();

export default function WebSeriesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-16">
      <header className="mb-8">
        <p className="text-xs font-bold tracking-[0.3em] text-gold">BROWSE</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-white">Web Series</h1>
        <p className="mt-2 text-sm text-mist max-w-2xl">
          {SERIES_TITLES.length} gripping originals in Hindi and Urdu — crime sagas, spy
          thrillers, comedies and coming-of-age stories.
        </p>
      </header>
      <BrowseGrid items={SERIES_TITLES} allGenres={seriesGenres} />
    </div>
  );
}
