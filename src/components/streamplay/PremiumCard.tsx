import React, { useState } from 'react';

/**
 * PremiumCard — the reusable OTT card (Phase 2 spec §16).
 *
 * Variants:
 *  - portrait   2:3 poster (movies, series)
 *  - landscape  16:9 backdrop (new releases, creator videos)
 *  - channel    16:9 with LIVE badge + centered channel logo
 *  - continue   16:9 with resume progress bar + episode/percent meta
 *  - creator    landscape video card with creator identity row
 *
 * Interaction rules:
 *  - ONE primary click target (the whole card = play/details).
 *  - Handler contract (prevents double actions): exactly ONE handler runs per
 *    click. The center play button fires `onPlay` when provided, otherwise
 *    `onClick` — never both. The card body always fires `onClick` only.
 *  - No nested clickable controls inside the artwork (prevents double-play).
 *  - Hover elevation + artwork zoom on pointer devices; static on touch.
 *  - Focus-visible ring via :focus-visible + global outline.
 *  - Broken/missing artwork falls back to a branded letter tile.
 */

export type PremiumCardVariant = 'portrait' | 'landscape' | 'channel' | 'continue' | 'creator';

export interface PremiumCardProps {
  variant?: PremiumCardVariant;
  title: string;
  /** Small line under the title (year · genre, "S1 E2 · 18 min left", channel category…). */
  subtitle?: string;
  image?: string;
  badge?: { label: string; tone?: 'live' | 'default' } | null;
  corner?: string;
  /** 0–100 resume progress (continue variant). */
  progress?: number;
  /** Channel logo (channel variant) — letter fallback when missing. */
  logo?: string;
  /** Creator identity row (creator variant). */
  creator?: { name: string; handle?: string; avatar?: string; verified?: boolean };
  onClick?: () => void;
  onPlay?: () => void;
  className?: string;
  ariaLabel?: string;
}

function Artwork({
  src, alt, fallbackLetter, logoStyle,
}: { src?: string; alt: string; fallbackLetter: string; logoStyle?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="sp2-card-fallback" aria-hidden="true">
        <span>{fallbackLetter}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={logoStyle ? { objectFit: 'contain', padding: '18%' } : undefined}
    />
  );
}

export const PremiumCard: React.FC<PremiumCardProps> = ({
  variant = 'portrait',
  title,
  subtitle,
  image,
  badge,
  corner,
  progress,
  logo,
  creator,
  onClick,
  onPlay,
  className = '',
  ariaLabel,
}) => {
  const letter = title.charAt(0).toUpperCase() || 'S';
  const showCenterPlay = variant === 'portrait' || variant === 'landscape' || variant === 'creator';

  return (
    <article
      className={`sp2-card sp2-card--${variant} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      aria-label={ariaLabel ?? title}
    >
      <div className="sp2-card-art">
        {/* Channel variant: dark tray + contained logo */}
        {variant === 'channel' && logo ? (
          <div className="absolute inset-0 grid place-items-center bg-[#0B1119]">
            <Artwork src={logo} alt="" fallbackLetter={letter} logoStyle />
          </div>
        ) : variant === 'channel' ? (
          <div className="sp2-card-fallback" aria-hidden="true"><span>{letter}</span></div>
        ) : (
          <Artwork src={image} alt="" fallbackLetter={letter} />
        )}

        <div className="sp2-card-scrim" />

        {badge && (
          <span className={`sp2-badge ${badge.tone === 'live' ? 'sp2-badge--live' : ''}`}>
            {badge.label}
          </span>
        )}
        {corner && <span className="sp2-badge-corner">{corner}</span>}

        {showCenterPlay && (
          <button
            type="button"
            className="sp2-card-play"
            aria-label={`Play ${title}`}
            tabIndex={-1}
            onClick={(e) => {
              // Exactly one action per activation: prefer the explicit play
              // callback; fall back to the card's primary click. (The previous
              // `onPlay?.() ?? onClick?.()` chain fired BOTH handlers whenever
              // an `onPlay` handler returned undefined — e.g. any void React
              // handler — causing double navigation/playback.)
              e.stopPropagation();
              if (onPlay) {
                onPlay();
              } else {
                onClick?.();
              }
            }}
          >
            <i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12l10-6z" fill="currentColor" /></svg></i>
          </button>
        )}

        {variant === 'continue' && typeof progress === 'number' && (
          <div className="sp2-progress" aria-hidden="true">
            <i style={{ width: `${Math.min(100, Math.max(2, progress))}%` }} />
          </div>
        )}

        {(variant === 'channel' || variant === 'continue') && (
          <div className="sp2-card-meta sp2-card-meta--overlay">
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
        )}
      </div>

      {(variant === 'portrait' || variant === 'landscape') && (
        <div className="sp2-card-meta">
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
      )}

      {variant === 'creator' && creator && (
        <div className="sp2-card-meta">
          <div className="flex items-center gap-2">
            {creator.avatar ? (
              <img
                src={creator.avatar}
                alt=""
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover ring-1 ring-white/15 shrink-0"
                loading="lazy"
              />
            ) : (
              <span className="w-7 h-7 rounded-full bg-surface-650 grid place-items-center text-[10px] font-extrabold text-mist-300 shrink-0 ring-1 ring-white/10">
                {creator.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="truncate">
                {creator.name}
                {creator.verified && (
                  <svg className="inline-block w-3 h-3 ml-1 text-crimson-500" viewBox="0 0 24 24" fill="currentColor" aria-label="Verified creator">
                    <path d="M12 2l2.4 2.4 3.4-.5 1 3.3 3 1.6-1.5 3.2 1.5 3.2-3 1.6-1 3.3-3.4-.5L12 22l-2.4-2.4-3.4.5-1-3.3-3-1.6L3.7 12 2.2 8.8l3-1.6 1-3.3 3.4.5z" />
                    <path d="M10.6 14.9l-2.3-2.3 1-1 1.3 1.3 3.6-3.6 1 1z" fill="#04070B" />
                  </svg>
                )}
              </h3>
              {creator.handle && <p className="truncate">{creator.handle}</p>}
            </div>
          </div>
        </div>
      )}
    </article>
  );
};
