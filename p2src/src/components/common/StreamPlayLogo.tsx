import React from 'react';

interface MarkProps {
  className?: string;
  /** Render the obsidian tile behind the mark (icon-style usage) */
  withTile?: boolean;
}

/**
 * StreamPlay brand mark — ORIGINAL abstract folded-ribbon "S".
 * Two interlocking angular ribbon folds (crimson→pink gradient) with
 * darker facet faces for depth. Reads cleanly from 16px to TV surfaces.
 */
export const StreamPlayMark: React.FC<MarkProps> = ({ className = 'w-8 h-8', withTile = true }) => (
  <svg viewBox="0 0 512 512" className={className} role="img" aria-label="StreamPlay" aria-hidden="false">
    <defs>
      <linearGradient id="spTop" x1="0.3" y1="0" x2="0.7" y2="1">
        <stop offset="0" stopColor="#FF4D6F" />
        <stop offset="1" stopColor="#E5093A" />
      </linearGradient>
      <linearGradient id="spBot" x1="0.7" y1="1" x2="0.3" y2="0">
        <stop offset="0" stopColor="#B90732" />
        <stop offset="1" stopColor="#E5093A" />
      </linearGradient>
      <linearGradient id="spTile" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#141B25" />
        <stop offset="0.55" stopColor="#0B1018" />
        <stop offset="1" stopColor="#04070B" />
      </linearGradient>
      <radialGradient id="spToplight" cx="0.5" cy="0.04" r="0.9">
        <stop offset="0" stopColor="#3A4A63" stopOpacity="0.55" />
        <stop offset="0.5" stopColor="#1B2D4A" stopOpacity="0.12" />
        <stop offset="1" stopColor="#1B2D4A" stopOpacity="0" />
      </radialGradient>
    </defs>

    {withTile && (
      <>
        <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#spTile)" />
        <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#spToplight)" />
        <rect
          x="17.5"
          y="17.5"
          width="477"
          height="477"
          rx="110.5"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.09"
          strokeWidth="3"
        />
      </>
    )}

    <g strokeLinejoin="round" strokeWidth="14">
      {/* top ribbon: angled terminal, bar, right fold down to interlock tip */}
      <path
        d="M118,96 L154,64 L408,64 L408,148 L270,148 L270,258 L128,206 Z"
        fill="url(#spTop)"
        stroke="url(#spTop)"
      />
      <path d="M408,148 L270,148 L408,262 Z" fill="#A10732" />
      {/* bottom ribbon: 180-degree rotation of the top */}
      <path
        d="M394,416 L358,448 L104,448 L104,364 L242,364 L242,254 L384,306 Z"
        fill="url(#spBot)"
        stroke="url(#spBot)"
      />
      <path d="M104,364 L242,364 L104,250 Z" fill="#A10732" />
    </g>
  </svg>
);

interface WordmarkProps {
  /** Hide "Play" accent on very compact surfaces */
  className?: string;
  accentClassName?: string;
}

/**
 * StreamPlay wordmark — "Stream" off-white + "Play" crimson, Sora display.
 */
export const StreamPlayWordmark: React.FC<WordmarkProps> = ({
  className = 'text-lg md:text-xl font-extrabold tracking-tight text-white',
  accentClassName = 'text-[#E5093A]',
}) => (
  <span className={`font-display whitespace-nowrap leading-none select-none ${className}`}>
    Stream<span className={accentClassName}>Play</span>
  </span>
);

interface LogoProps {
  /** Icon size class */
  iconClassName?: string;
  /** Wordmark size class */
  textClassName?: string;
  showTagline?: boolean;
}

/**
 * Horizontal lockup: mark + wordmark (+ optional subtle pilot tagline).
 */
export const StreamPlayLogo: React.FC<LogoProps> = ({
  iconClassName = 'w-9 h-9',
  textClassName = 'text-lg md:text-xl font-extrabold tracking-tight text-white',
  showTagline = true,
}) => (
  <span className="flex items-center gap-2.5">
    <StreamPlayMark className={`${iconClassName} drop-shadow-[0_2px_10px_rgba(229,9,58,0.35)]`} />
    <span className="flex flex-col items-start">
      <StreamPlayWordmark className={textClassName} />
      {showTagline && (
        <span className="hidden sm:block text-[8px] font-semibold tracking-[0.32em] uppercase text-[#8993A3] -mt-0.5">
          Watch · Explore · Enjoy
        </span>
      )}
    </span>
  </span>
);
