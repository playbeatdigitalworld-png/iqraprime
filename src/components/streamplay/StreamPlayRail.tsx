import React, { useRef, useState, useCallback, useEffect } from 'react';

export type Item = {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  live?: boolean;
  /** 0–100 resume progress (Continue Watching rail). */
  progress?: number;
  /** Optional corner chip, e.g. "HD", "NEW". */
  corner?: string;
};

type Props = {
  title: string;
  eyebrow?: string;
  sub?: string;
  items: Item[];
  onPlay?: (item: Item) => void;
  onViewAll?: () => void;
  /** portrait (2:3 posters) or landscape (16:9) card shape */
  variant?: 'portrait' | 'landscape';
  /** Render shimmer skeletons instead of cards (initial load). */
  loading?: boolean;
  skeletonCount?: number;
  /** Wider cards forContinue-watching style rails. */
  cardWidth?: number;
};

const PEEK = 'minmax(150px, 1fr)';

/**
 * StreamPlayRail — premium horizontal content rail (Phase 2 §7/§10).
 * Scroll-snap scroller, edge fades, hover arrows, real metadata only.
 */
export default function StreamPlayRail({
  title,
  eyebrow,
  sub,
  items,
  onPlay,
  onViewAll,
  variant = 'portrait',
  loading = false,
  skeletonCount = 8,
  cardWidth,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [fades, setFades] = useState({ left: false, right: false });

  const updateFades = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setFades({ left: el.scrollLeft > 8, right: el.scrollLeft < max - 8 });
  }, []);

  useEffect(() => {
    updateFades();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateFades, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateFades) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', updateFades);
      ro?.disconnect();
    };
  }, [updateFades, items.length, loading]);

  const nudge = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(320, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  if (!loading && items.length === 0) return null;

  const gridStyle: React.CSSProperties = {
    gridAutoColumns: cardWidth ? `minmax(${cardWidth}px, 1fr)` : PEEK,
  };

  return (
    <section className="sp2-rail sp2-section" aria-label={title}>
      <div className="sp2-shell">
        <div className="sp2-rail-head">
          <div className="min-w-0">
            {eyebrow && (
              <div className={`sp2-rail-eyebrow ${title === 'Live TV' ? 'sp2-rail-eyebrow--live' : ''}`}>{eyebrow}</div>
            )}
            <h2 className="sp2-rail-title">{title}</h2>
            {sub && <p className="sp2-rail-sub">{sub}</p>}
          </div>
          {onViewAll && !loading && items.length > 0 && (
            <button type="button" className="sp2-view-all" onClick={onViewAll}>
              View all
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <div className="sp2-rail-fade is-left" style={{ opacity: fades.left ? 1 : 0 }} />
        <div className="sp2-rail-fade is-right" style={{ opacity: fades.right ? 1 : 0 }} />

        <div className="sp2-shell relative">
          <button
            type="button"
            className={`sp2-rail-nav sp2-rail-nav--prev ${fades.left ? 'is-on' : ''}`}
            onClick={() => nudge(-1)}
            aria-label={`Scroll ${title} backwards`}
            tabIndex={fades.left ? 0 : -1}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="sp2-rail-scroller" ref={scrollerRef} style={gridStyle}>
            {loading
              ? Array.from({ length: skeletonCount }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-white/[0.05] bg-surface-700/50 p-2 pb-3" style={{ minWidth: cardWidth ?? 150 }}>
                    <div
                      className="sp2-skeleton rounded-xl"
                      style={{ aspectRatio: variant === 'portrait' ? '2 / 3' : '16 / 9' }}
                    />
                    <div className="sp2-skeleton h-3 rounded mt-2.5 w-3/4" />
                    <div className="sp2-skeleton h-2.5 rounded mt-1.5 w-1/2" />
                  </div>
                ))
              : items.map((item) => (
                  <article
                    key={item.id}
                    className="sp2-card"
                    role="button"
                    tabIndex={0}
                    aria-label={`Play ${item.title}`}
                    onClick={() => onPlay?.(item)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPlay?.(item); } }}
                  >
                    <div className="sp2-card-art" style={{ aspectRatio: variant === 'portrait' ? '2 / 3' : '16 / 9' }}>
                      <RailImage src={item.image} title={item.title} />
                      <div className="sp2-card-scrim" />
                      {item.live && <span className="sp2-badge sp2-badge--live">LIVE</span>}
                      {item.corner && <span className="sp2-badge-corner">{item.corner}</span>}
                      <button type="button" className="sp2-card-play" tabIndex={-1} aria-hidden="true">
                        <i><svg viewBox="0 0 24 24"><path d="M9 6v12l10-6z" fill="currentColor" /></svg></i>
                      </button>
                      {typeof item.progress === 'number' && (
                        <div className="sp2-progress" aria-hidden="true">
                          <i style={{ width: `${Math.min(100, Math.max(2, item.progress))}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="sp2-card-meta">
                      <h3>{item.title}</h3>
                      {item.subtitle && <p>{item.subtitle}</p>}
                    </div>
                  </article>
                ))}
          </div>

          <button
            type="button"
            className={`sp2-rail-nav sp2-rail-nav--next ${fades.right ? 'is-on' : ''}`}
            onClick={() => nudge(1)}
            aria-label={`Scroll ${title} forwards`}
            tabIndex={fades.right ? 0 : -1}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

/** Rail image with branded letter fallback (never a broken-image icon). */
function RailImage({ src, title }: { src?: string; title: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="sp2-card-fallback" aria-hidden="true">
        <span>{title.charAt(0).toUpperCase()}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
