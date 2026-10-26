import type { Metadata } from "next";
import IptvLibraryClient from "@/components/IptvLibraryClient";

export const metadata: Metadata = {
  title: "IPTV Library",
  description:
    "Browse your IPTV provider's full library — movies from every country, Hindi & Urdu web-series, playing in the IQRAPRIME Player.",
};

export default function IptvPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-16">
      <header>
        <p className="text-xs font-bold tracking-[0.3em] text-gold">FULL LIBRARY</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-white">
          IPTV <span className="text-gold gold-glow-text">Library</span>
        </h1>
        <p className="mt-2 text-sm text-mist max-w-2xl">
          Everything your IPTV line offers — movies from all countries and complete web-series with
          every episode, playable in the built-in IQRAPRIME Player.
        </p>
      </header>
      <IptvLibraryClient />
    </div>
  );
}
