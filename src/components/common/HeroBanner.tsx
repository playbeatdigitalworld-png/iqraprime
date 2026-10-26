import React from 'react';
import { Play, Film, Plus, Check, Info } from 'lucide-react';
import type { Movie } from '../../types/index.js';
import { useWatchlist } from '../../context/WatchlistContext.js';
import { LegalBadge } from './LegalBadge.js';

interface HeroBannerProps {
  movie: Movie;
  onPlay: (movie: Movie, mode?: 'full' | 'trailer') => void;
  onOpenDetails: (movie: Movie) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ movie, onPlay, onOpenDetails }) => {
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const inList = isInWatchlist(movie.id);

  const canPlayFull = Boolean(movie.videoUrl) && movie.rightsStatus !== 'TRAILER_ONLY';

  return (
    <section className="relative w-full h-[72vh] min-h-[500px] max-h-[780px] md:h-[80vh] md:min-h-[560px] md:max-h-[840px] overflow-hidden flex items-end">
      {/* Cinematic artwork — full bleed, right-weighted composition */}
      <div className="absolute inset-0 z-0">
        <img
          src={movie.backdrop || movie.poster}
          alt={movie.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center scale-[1.06] md:[mask-image:linear-gradient(to_right,black_55%,black_78%,transparent_98%)] transition-[transform] duration-[1200ms] ease-out"
        />

        {/* Multistage cinematic scrims — lower fade, left text-shield, vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#04070B] via-[#04070B]/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#04070B] via-[#04070B]/72 to-transparent w-full md:w-2/3" />
        <div className="absolute inset-0 cine-vignette opacity-70" />

        {/* Soft crimson stage light behind the artwork (desktop) */}
        <div className="hidden md:block absolute right-[8%] top-1/4 w-[420px] h-[420px] rounded-full bg-[#E5093A]/[0.07] blur-[110px] pointer-events-none" />
      </div>

      {/* Hero Content — left-weighted, animated entrance */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 md:pb-24 w-full pt-28">
        <div className="max-w-2xl">
          {/* Metadata kicker: rights · year · duration · rating · genre */}
          <div className="animate-fade-up flex flex-wrap items-center gap-2 text-xs text-[#C6CBD4] mb-3.5">
            <LegalBadge status={movie.rightsStatus} licenseText={movie.license} />
            <span aria-hidden="true" className="text-white/25">|</span>
            <span className="font-medium">{movie.year}</span>
            <span aria-hidden="true" className="text-white/25">·</span>
            <span>{movie.duration}</span>
            <span aria-hidden="true" className="text-white/25">·</span>
            <span className="text-amber-400 font-semibold">{movie.rating}</span>
            <span aria-hidden="true" className="text-white/25">·</span>
            <span>{movie.genre.slice(0, 2).join(' / ')}</span>
          </div>

          {/* Cinematic title */}
          <h1
            className="animate-fade-up animate-fade-up-1 text-[28px] leading-[1.04] sm:text-5xl md:text-6xl lg:text-[68px] font-display font-extrabold text-white tracking-[-0.02em] mb-4 drop-shadow-[0_4px_28px_rgba(0,0,0,0.65)]"
          >
            {movie.title}
          </h1>

          {/* Short cinematic description */}
          <p className="animate-fade-up animate-fade-up-2 text-[13px] md:text-[15px] text-[#C6CBD4] line-clamp-2 md:line-clamp-3 mb-7 leading-relaxed max-w-xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
            {movie.description}
          </p>

          {/* Action row — Watch Now / Trailer / My List / Details */}
          <div className="animate-fade-up animate-fade-up-3 flex flex-wrap items-center gap-2.5 sm:gap-3">
            {canPlayFull ? (
              <button
                onClick={() => onPlay(movie, 'full')}
                className="flex items-center gap-2.5 px-6 sm:px-7 py-3.5 rounded-xl bg-brand-gradient hover:brightness-110 text-white font-semibold text-sm shadow-xl crimson-glow transition-all duration-200 active:scale-95 whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Watch Now</span>
              </button>
            ) : (
              <button
                onClick={() => onPlay(movie, 'trailer')}
                className="flex items-center gap-2.5 px-6 sm:px-7 py-3.5 rounded-xl bg-brand-gradient hover:brightness-110 text-white font-semibold text-sm shadow-xl crimson-glow transition-all duration-200 active:scale-95 whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Watch Trailer</span>
              </button>
            )}

            {canPlayFull && movie.trailerUrl && (
              <button
                onClick={() => onPlay(movie, 'trailer')}
                className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-white/[0.09] hover:bg-white/[0.15] border border-white/10 backdrop-blur-md text-white font-medium text-sm transition-colors duration-200 active:scale-95 whitespace-nowrap"
              >
                <Film className="w-4 h-4 text-[#C6CBD4]" />
                <span>Trailer</span>
              </button>
            )}

            <button
              onClick={() => toggleWatchlist(movie.id, movie.title)}
              aria-pressed={inList}
              className={`flex items-center gap-2 px-4 sm:px-5 py-3.5 rounded-xl border text-sm font-medium backdrop-blur-md transition-all duration-200 active:scale-95 whitespace-nowrap ${
                inList
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/[0.07] hover:bg-white/[0.12] border-white/15 text-white'
              }`}
              title={inList ? 'Remove from My List' : 'Add to My List'}
            >
              {inList ? <Check className="w-4 h-4 text-emerald-400" /> : <Plus className="w-4 h-4" />}
              <span className="hidden sm:inline">{inList ? 'In My List' : 'My List'}</span>
            </button>

            <button
              onClick={() => onOpenDetails(movie)}
              className="flex items-center gap-1.5 px-3 py-3.5 rounded-xl text-xs font-semibold text-[#8993A3] hover:text-white transition-colors duration-200"
            >
              <Info className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Details & License</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
