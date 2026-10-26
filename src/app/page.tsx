import Hero from "@/components/Hero";
import Row from "@/components/Row";
import {
  HERO_POOL,
  MOVIE_TITLES,
  DRAMA_TITLES,
  NEW_RELEASES,
  TOP_RATED,
  TRENDING,
  ALL_TITLES,
} from "@/lib/catalog";

const bollywood = MOVIE_TITLES.filter((t) => t.language === "Hindi").slice(0, 14);
const lollywood = MOVIE_TITLES.filter((t) =>
  ["Punjabi", "Urdu"].includes(t.language)
).slice(0, 14);
const hollywood = MOVIE_TITLES.filter((t) => t.language === "English").slice(0, 14);

export default function HomePage() {
  return (
    <>
      <Hero items={HERO_POOL} />

      <div className="pb-4">
        <Row title="Trending Now" items={TRENDING.slice(0, 14)} ranked href="/movies" />
        <Row title="New Releases" items={NEW_RELEASES.slice(0, 14)} />
        <Row
          title="Pakistani Dramas"
          items={DRAMA_TITLES.slice(0, 14)}
          href="/dramas"
          viewAllLabel="All dramas"
        />
        <Row title="Top Rated of All Time" items={TOP_RATED.slice(0, 14)} ranked />
        <Row title="Lollywood Picks" items={lollywood} />
        <Row title="Bollywood Hits" items={bollywood} />
        <Row title="Hollywood & International" items={hollywood} />
      </div>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-12" aria-label="About IQRAPRIME">
        <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-navy-2 to-ink p-6 sm:p-8">
          <p className="font-display text-2xl sm:text-3xl font-bold text-white">
            <span className="text-gold gold-glow-text">Kahani Jo Dil Chhoo Jaye.</span>
          </p>
          <p className="mt-3 max-w-3xl text-sm text-mist leading-relaxed">
            {ALL_TITLES.length} handpicked movies and Pakistani dramas — from Lollywood&apos;s biggest
            blockbusters to PTV&apos;s golden-age classics. Install IQRAPRIME as an app and your
            stories travel with you, online or offline.
          </p>
        </div>
      </section>
    </>
  );
}
