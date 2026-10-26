import Hero from "@/components/Hero";
import Row from "@/components/Row";
import { COUNTS, DRAMA_TITLES, HERO_POOL, NEW_RELEASES, REGION_POOLS, SERIES_TITLES, TOP_RATED, TRENDING } from "@/lib/catalog";

const webSeries = SERIES_TITLES;

export default function HomePage() {
  return (
    <>
      <Hero items={HERO_POOL} />

      <div className="pb-4">
        <Row title="Trending Now" items={TRENDING.slice(0, 14)} ranked href="/movies" />
        <Row title="New Releases" items={NEW_RELEASES.slice(0, 14)} />
        <Row title="Hindi Movies" items={REGION_POOLS.Bollywood.slice(0, 14)} href="/movies" />
        <Row title="Web Series — Hindi & Urdu" items={webSeries.slice(0, 14)} href="/web-series" viewAllLabel="All series" />
        <Row title="Pakistani Dramas" items={DRAMA_TITLES.slice(0, 14)} href="/dramas" viewAllLabel="All dramas" />
        <Row title="Bangladeshi Cinema" items={REGION_POOLS.Bangladeshi.slice(0, 14)} />
        <Row title="South Indian Cinema" items={REGION_POOLS["South Indian"].slice(0, 14)} />
        <Row title="Lollywood Picks" items={REGION_POOLS["Pakistani / Lollywood"].slice(0, 14)} />
        <Row title="Top Rated of All Time" items={TOP_RATED.slice(0, 14)} ranked />
        <Row title="Hollywood & International" items={REGION_POOLS["Hollywood & International"].slice(0, 14)} />
      </div>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-12" aria-label="About IQRAPRIME">
        <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-navy-2 to-ink p-6 sm:p-8">
          <p className="font-display text-2xl sm:text-3xl font-bold text-white">
            <span className="text-gold gold-glow-text">Kahani Jo Dil Chhoo Jaye.</span>
          </p>
          <p className="mt-3 max-w-3xl text-sm text-mist leading-relaxed">
            {COUNTS.movies} movies across Bollywood, Lollywood, Bangladeshi, South Indian and
            Hollywood cinema · {COUNTS.dramas} Pakistani dramas · {COUNTS.series} Hindi & Urdu
            web series. Install IQRAPRIME as an app and your stories travel with you.
          </p>
        </div>
      </section>
    </>
  );
}
