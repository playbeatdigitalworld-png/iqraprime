import type { Metadata } from "next";
import Link from "next/link";
import RegionBrowser from "@/components/RegionBrowser";
import IptvRails, { type SectionSpec } from "@/components/IptvRails";
import { MOVIE_TITLES, REGION_POOLS } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Movies",
  description:
    "Browse movies on IQRAPRIME — Indian, Pakistani, Bangladeshi, South Indian and Hollywood cinema.",
};

const PROVIDER_MOVIES: SectionSpec[] = [
  { file: "in-2026", title: "Indian Movies — New in 2026", viewAllHref: "/iptv", limit: 20 },
  { file: "en-2026", title: "Hollywood — New in 2026", viewAllHref: "/iptv", limit: 20 },
  { file: "in-hindi", title: "Hindi Movies — Full Library", viewAllHref: "/iptv", limit: 20 },
  { file: "in-south", title: "South Indian — Full Library", viewAllHref: "/iptv", limit: 20 },
  { file: "pk-movies", title: "Pakistani Movies — Full Library", viewAllHref: "/iptv", limit: 20 },
  { file: "bd-movies", title: "Bangladeshi Movies — Full Library", viewAllHref: "/iptv", limit: 20 },
  { file: "in-hindi-dubbed", title: "Hindi Dubbed Movies", viewAllHref: "/iptv", limit: 20 },
];

export default function MoviesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-16">
      <header className="mb-8">
        <p className="text-xs font-bold tracking-[0.3em] text-gold">BROWSE</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-white">Movies</h1>
        <p className="mt-2 text-sm text-mist max-w-2xl">
          {MOVIE_TITLES.length} handpicked films across all countries — plus the full live provider
          library of 210,000+ movies from India, Pakistan, Bangladesh, Hollywood and beyond,{" "}
          <Link href="/iptv" className="font-semibold text-gold hover:text-gold-soft">
            open the IPTV Library →
          </Link>
        </p>
      </header>
      <IptvRails sections={PROVIDER_MOVIES} />
      <div className="mt-12">
        <RegionBrowser pools={REGION_POOLS} />
      </div>
    </div>
  );
}
