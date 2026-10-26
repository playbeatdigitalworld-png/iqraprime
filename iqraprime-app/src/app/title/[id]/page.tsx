import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ALL_TITLES, byId, related, serialExtra } from "@/lib/catalog";
import WatchSection from "@/components/WatchSection";
import MyListButton from "@/components/MyListButton";
import PosterImg from "@/components/PosterImg";
import Row from "@/components/Row";

export function generateStaticParams() {
  return ALL_TITLES.map((t) => ({ id: t.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = byId(id);
  if (!t) return { title: "Not found" };
  return {
    title: `${t.title} (${t.year})`,
    description: t.synopsis,
  };
}

export default async function TitlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = byId(id);
  if (!t) notFound();
  const serial = serialExtra(t.id);
  const episodeList = serial
    ? Array.from({ length: Math.min(serial.episodes, 24) }, (_, i) => i + 1)
    : [];

  return (
    <div className="pb-4">
      {/* Backdrop header */}
      <div className="relative h-[38vh] min-h-[280px] -mt-16 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={t.backdrop} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/30" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 -mt-40 relative z-10 grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* Poster */}
        <div className="hidden lg:block">
          <PosterImg
            id={t.id}
            fallback={t.poster}
            alt={`${t.title} poster`}
            className="w-full rounded-2xl border border-gold/25 shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
          />
        </div>

        {/* Details */}
        <div className="fade-up">
          <p className="text-xs font-bold tracking-[0.3em] text-gold">
            {t.kind === "movie" ? "MOVIE" : t.kind === "drama" ? "PAKISTANI DRAMA" : "WEB SERIES"}
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-5xl font-bold text-white gold-glow-text">
            {t.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mist">
            <span className="rounded-md bg-gold/15 border border-gold/40 px-2 py-0.5 font-bold text-gold">
              ★ {t.rating.toFixed(1)}
            </span>
            <span>{t.year}</span>
            <span className="text-gold/60">•</span>
            <span>{t.meta}</span>
            <span className="text-gold/60">•</span>
            
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {t.genres.map((g) => (
              <span key={g} className="rounded-full border border-gold/25 px-3 py-1 text-xs text-mist">
                {g}
              </span>
            ))}
          </div>
          <p className="mt-5 max-w-3xl text-sm sm:text-base leading-relaxed text-white/85">
            {t.synopsis}
          </p>
          <p className="mt-4 text-sm text-mist">
            <span className="font-semibold text-gold">Starring: </span>
            {t.cast.join(", ")}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="#watch" className="btn-gold inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
              </svg>
              Play Now
            </Link>
            <MyListButton id={t.id} />
          </div>

          {/* Watch section */}
          <section id="watch" className="mt-10 scroll-mt-24" aria-label="Watch">
            <h2 className="font-display text-xl font-bold text-white mb-4">
              Watch <span className="text-gold">{t.title}</span>
            </h2>
            <WatchSection title={t.title} year={t.year} poster={t.backdrop} />
            {serial && serial.episodes > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-gold tracking-wide">
                  EPISODES — SEASON {serial.seasons} · {serial.episodes} TOTAL
                </h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {episodeList.map((n) => (
                    <div
                      key={n}
                      className="flex items-center gap-3 rounded-xl border border-gold/15 bg-navy/70 px-4 py-3 hover:border-gold/40 transition"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold text-xs font-bold">
                        {String(n).padStart(2, "0")}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-white">Episode {n}</span>
                        <span className="block text-[11px] text-mist">{serial.episodeDuration} · {serial.network}</span>
                      </span>
                    </div>
                  ))}
                </div>
                {serial.episodes > 24 && (
                  <p className="mt-3 text-xs text-mist">
                    + {serial.episodes - 24} more episodes in this season
                  </p>
                )}
              </div>
            )}
            {serial && serial.episodes === 0 && (
              <div className="mt-6 rounded-xl border border-gold/25 bg-gradient-to-br from-navy-2 to-ink px-5 py-4">
                <p className="text-sm font-bold text-gold tracking-wide">COMING SOON</p>
                <p className="mt-1 text-sm text-mist">
                  {serial.title} premieres on {serial.network}. Episodes will appear here as they
                  air — add it to My List to keep it close.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      <Row title="More Like This" items={related(t, 14)} />
    </div>
  );
}
