import React, { useEffect, useState } from 'react';
import { Play, MonitorSmartphone, BadgeCheck, ShieldCheck, Users, ChevronLeft, ChevronRight, Info, Film } from 'lucide-react';

export interface HeroSlide {
  id: string;
  title: string;
  description?: string;
  /** Authorized catalog artwork (backdrop preferred, poster accepted). */
  backdrop?: string;
  poster?: string;
  /** REAL metadata chips only — year/runtime/genre/rating as provided by the catalog. */
  meta?: string[];
  /** Small quality chip rendered only when genuinely known ("HD", "4K"). */
  quality?: string;
  /** Eyebrow above the artwork caption, e.g. "A STREAMPLAY ORIGINAL". */
  badge?: string;
  onStart?: () => void;
  onDetails?: () => void;
  /** Present ONLY when a real trailer source exists. */
  onTrailer?: () => void;
}

type Props = {
  /** Real featured content. When empty, the branded StreamPlay hero renders. */
  slides: HeroSlide[];
  onWatchNow?: () => void;
  onExploreLive?: () => void;
};

const TRUST = [
  { icon: MonitorSmartphone, label: 'Multi-Device' },
  { icon: BadgeCheck, label: 'HD Streaming' },
  { icon: ShieldCheck, label: 'Ad-Free Experience' },
  { icon: Users, label: 'For Everyone' },
];

/**
 * StreamPlayHero — the cinematic homepage hero (Phase 2 §8).
 *
 * Layout: left column = headline/actions, right column = artwork panel.
 * When real featured catalog content is provided, its authorized artwork and
 * metadata drive the slide. Otherwise an original branded composition renders
 * (abstract cinematic art — never screenshots of fake UI or unlicensed posters).
 * Multi-slide is manual-only (restrained transitions, no autoplay, honors
 * prefers-reduced-motion).
 */
export default function StreamPlayHero({ slides, onWatchNow, onExploreLive }: Props) {
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();
  const count = slides.length;
  const slide = count > 0 ? slides[Math.min(index, count - 1)] : null;
  const hasSlides = !!slide;

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + count) % count);

  const start = slide?.onStart ?? onWatchNow;
  const explore = slide?.onDetails ?? onExploreLive;

  return (
    <section className="sp2-hero" aria-label="Featured on StreamPlay">
      {/* Full-bleed backdrop (desktop, real artwork only) */}
      {hasSlides && (slide!.backdrop || slide!.poster) && (
        <div className="sp2-hero-media hidden md:block" key={`bg-${slide!.id}`} style={{ animation: reduced ? undefined : 'spFadeIn .7s ease both' }}>
          <img
            src={slide!.backdrop || slide!.poster}
            alt=""
            referrerPolicy="no-referrer"
            onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
          />
        </div>
      )}
      {hasSlides && (slide!.backdrop || slide!.poster) && <div className="sp2-hero-scrim hidden md:block" aria-hidden="true" />}

      <div className="sp2-shell">
        <div className="sp2-hero-inner">
          {/* ---------- Left: copy + actions ---------- */}
          <div>
            <div className="sp2-hero-eyebrow">Bigger stories. Brighter worlds.</div>

            <h1 className="sp2-hero-title">
              {hasSlides ? (
                slide!.title
              ) : (
                <>Entertainment without <em>limits.</em></>
              )}
            </h1>

            <p className="sp2-hero-sub">
              {hasSlides
                ? (slide!.description || 'Live television, blockbuster movies, original series, and incredible creators — all in one place.')
                : 'Live television, blockbuster movies, original series, and incredible creators — all in one place.'}
            </p>

            {hasSlides && (slide!.meta?.length || slide!.quality) && (
              <div className="sp2-hero-meta">
                {slide!.meta?.filter(Boolean).map((m, i) => (
                  <span key={`${m}-${i}`}>{m}</span>
                ))}
                {slide!.quality && <span className="sp2-chip-hd">{slide!.quality}</span>}
              </div>
            )}

            <div className="sp2-hero-actions">
              <button type="button" className="sp2-btn sp2-btn--primary" onClick={start}>
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                Watch Now
              </button>
              <button type="button" className="sp2-btn sp2-btn--glass" onClick={explore}>
                {hasSlides ? (
                  <>
                    <Info className="w-4 h-4" aria-hidden="true" />
                    More Info
                  </>
                ) : (
                  'Explore Library'
                )}
              </button>
              {slide?.onTrailer && (
                <button type="button" className="sp2-btn sp2-btn--ghost" onClick={slide.onTrailer}>
                  <Film className="w-4 h-4" aria-hidden="true" />
                  Trailer
                </button>
              )}
            </div>

            <div className="sp2-hero-trust">
              {TRUST.map(({ icon: Icon, label }) => (
                <span key={label}>
                  <Icon aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* ---------- Right: artwork panel ---------- */}
          <div className="relative hidden md:block self-stretch">
            <div className="sp2-hero-art h-full" key={`art-${slide?.id ?? 'brand'}`} style={{ animation: reduced ? undefined : 'spFadeIn .6s ease both' }}>
            {hasSlides && (slide!.poster || slide!.backdrop) ? (
              <img
                src={slide!.poster || slide!.backdrop}
                alt={`${slide!.title} artwork`}
                referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="sp2-hero-art-fallback" aria-hidden="true" />
            )}
            <div className="sp2-hero-art-scrim" aria-hidden="true" />
            <div className="sp2-hero-art-caption">
              <small>{slide?.badge ?? 'STREAMPLAY ORIGINAL'}</small>
              <strong>{slide?.title ?? 'STREAMPLAY'}</strong>
              {!hasSlides && (
                <span className="mt-1 block text-[11px] tracking-[0.18em] uppercase text-mist-500">
                  Some worlds stay with you forever.
                </span>
              )}
            </div>
            </div>

            {/* Slide arrows scoped to the artwork column (never over copy) */}
            {count > 1 && (
              <>
                <button type="button" className="sp2-hero-arrow sp2-hero-arrow--art-prev" onClick={() => go(-1)} aria-label="Previous featured title">
                  <ChevronLeft aria-hidden="true" />
                </button>
                <button type="button" className="sp2-hero-arrow sp2-hero-arrow--art-next" onClick={() => go(1)} aria-label="Next featured title">
                  <ChevronRight aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Manual slide dots (only with multiple slides) */}
      {count > 1 && (
        <div className="sp2-hero-dots" role="tablist" aria-label="Featured titles">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show ${s.title}`}
              className={`sp2-hero-dot ${i === index ? 'is-active' : ''}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** SSR-safe reduced-motion check (avoids layout thrash from matchMedia in render). */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setReduced(mq.matches);
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.('change', fn);
    return () => mq.removeEventListener?.('change', fn);
  }, []);
  return reduced;
}
