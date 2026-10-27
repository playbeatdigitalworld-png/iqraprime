import type { Metadata } from "next";
import Link from "next/link";
import BrowseGrid from "@/components/BrowseGrid";
import IptvRails, { type SectionSpec } from "@/components/IptvRails";
import { SERIES_TITLES } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Web Series",
  description:
    "Hindi and Urdu web series on IQRAPRIME — Scam 1992, The Family Man, Panchayat, Churails and more.",
};

const seriesGenres = Array.from(new Set(SERIES_TITLES.flatMap((t) => t.genres))).sort();

const PROVIDER_SERIES: SectionSpec[] = [
  { file: "in-web", title: "Hindi & Urdu Web Series — Live", viewAllHref: "/iptv", limit: 20 },
  { file: "in-series", title: "Indian Series — Full Library", viewAllHref: "/iptv", limit: 20 },
];

export default function WebSeriesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-16">
      <header className="mb-8">
        <p className="text-xs font-bold tracking-[0.3em] text-gold">BROWSE</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-white">Web Series</h1>
        <p className="mt-2 text-sm text-mist max-w-2xl">
          {SERIES_TITLES.length} gripping originals in Hindi and Urdu — crime sagas, spy
          thrillers, comedies and coming-of-age stories — plus the live provider library with
          thousands more Hindi &amp; Urdu web series,{" "}
          <Link href="/iptv" className="font-semibold text-gold hover:text-gold-soft">
            open the IPTV Library →
          </Link>
        </p>
      </header>
      <IptvRails sections={PROVIDER_SERIES} />
      <div className="mt-12">
        <BrowseGrid items={SERIES_TITLES} allGenres={seriesGenres} />
      </div>
    </div>
  );
}
