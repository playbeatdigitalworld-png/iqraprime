import type { Metadata } from "next";
import Link from "next/link";
import BrowseGrid from "@/components/BrowseGrid";
import IptvRails, { type SectionSpec } from "@/components/IptvRails";
import { DRAMA_TITLES } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Pakistani Dramas",
  description:
    "Browse Pakistani dramas on IQRAPRIME — from Humsafar and Tere Bin to PTV golden-age classics.",
};

const dramaGenres = Array.from(new Set(DRAMA_TITLES.flatMap((t) => t.genres))).sort();

const PROVIDER_DRAMAS: SectionSpec[] = [
  { file: "pk-series", title: "Pakistani Dramas — Full Library", viewAllHref: "/iptv", limit: 20 },
  { file: "bd-series", title: "Bangladeshi Dramas — Live", viewAllHref: "/iptv", limit: 20 },
];

export default function DramasPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-16">
      <header className="mb-8">
        <p className="text-xs font-bold tracking-[0.3em] text-gold">BROWSE</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-white">
          Pakistani Dramas
        </h1>
        <p className="mt-2 text-sm text-mist max-w-2xl">
          {DRAMA_TITLES.length} serials that defined eras — Hum TV, ARY Digital, Geo TV and PTV
          classics, from Humsafar to Kabhi Main Kabhi Tum — plus the full live drama library from
          the provider with Pakistani and Bangladeshi serials,{" "}
          <Link href="/iptv" className="font-semibold text-gold hover:text-gold-soft">
            open the IPTV Library →
          </Link>
        </p>
      </header>
      <IptvRails sections={PROVIDER_DRAMAS} />
      <div className="mt-12">
        <BrowseGrid items={DRAMA_TITLES} allGenres={dramaGenres} />
      </div>
    </div>
  );
}
