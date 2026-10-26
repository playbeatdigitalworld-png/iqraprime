import type { Metadata } from "next";
import BrowseGrid from "@/components/BrowseGrid";
import { FRESH_2026 } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "New in 2026",
  description:
    "Every 2026 release on IQRAPRIME — the year's biggest Bollywood & South Indian blockbusters, Pakistani dramas, Hindi web series, Hollywood and Bangladeshi films, all in one place.",
};

const genres2026 = Array.from(new Set(FRESH_2026.flatMap((t) => t.genres))).sort();

export default function New2026Page() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-16">
      <header className="mb-8">
        <p className="text-xs font-bold tracking-[0.3em] text-gold">FRESH OFF THE REEL</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-white">
          New in <span className="text-gold gold-glow-text">2026</span>
        </h1>
        <p className="mt-2 text-sm text-mist max-w-2xl">
          {FRESH_2026.length} releases from the current year — Jailer 2, King, Ramayana, Toxic,
          Zanjeerain, Dar-e-Nijaat, Panchayat Season 5 and more, front and centre.
        </p>
      </header>
      <BrowseGrid items={FRESH_2026} allGenres={genres2026} />
    </div>
  );
}
