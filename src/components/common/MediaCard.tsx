import React, { useState } from 'react';
import { Play, Plus, Check, Info } from 'lucide-react';
import type { Movie, WatchProgress } from '../../types/index.js';
import { useWatchlist } from '../../context/WatchlistContext.js';

interface MediaCardProps {
  movie: Movie;
  progress?: WatchProgress;
  onPlay: (movie: Movie, mode?: 'full' | 'trailer') => void;
  onOpenDetails: (movie: Movie) => void;
  aspectRatio?: 'poster' | 'landscape';
}

/**
 * Visual-first premium OTT card: full-bleed artwork, minimal overlaid
 * metadata, hover action reveal. Mobile shows the overlay persistently
 * (no hover dependency).
 */
export const MediaCard: React.FC<MediaCardProps> = ({
  movie,
  progress,
  onPlay,
  onOpenDetails,
  aspectRatio = 'landscape',
}) => {
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const inList = isInWatchlist(movie.id);
  const [imgError, setImgError] = useState(false);

  const canPlayFull = Boolean(movie.videoUrl) && movie.rightsStatus !== 'TRAILER_ONLY';
  const progressPercent =
    progress && progress.durationSeconds > 0
      ? Math.min(100, Math.round((progress.positionSeconds / progress.durationSeconds) * 100))
      : 0;

  return (
    <div
      onClick={() => onPlay(movie, canPlayFull ? 'full' : 'trailer')}
      role="button"
      tabIndex={0}
      aria-label={`Play ${movie.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPlay(movie, canPlayFull ? 'full' : 'trailer');
        }
      }}
      className={`group relative cursor-pointer rounded-2xl overflow-hidden bg-[#111A27] border border-white/[0.06] hover:border-white/[0.16] transition-all duration-300 hover:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)] hover:-translate-y-1 shrink-0 focus-within:-translate-y-1 ${
        aspectRatio === 'poster' ? 'w-[150px] sm:w-[186px]' : 'w-[248px] sm:w-[308px]'
      }`}
    >
      {/* Full-bleed artwork */}
      <div
        className={`relative w-full overflow-hidden bg-[#0B1018] ${
          aspectRatio === 'poster' ? 'aspect-[2/3]' : 'aspect-video'
        }`}
      >
        {!imgError ? (
          <img
            src={aspectRatio === 'poster' ? movie.poster : movie.backdrop || movie.poster}
            alt={movie.title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#141B25] to-[#070B12] text-center">
            <span className="text-xs font-semibold text-white font-display mb-1">{movie.title}</span>
            <span className="text-[10px] text-[#8993A3]">{movie.year}</span>
          </div>
        )}

        {/* Bottom gradient + overlaid minimal metadata */}
        <div className="absolute inset-x-0 bottom-0 pt-14 pb-3 px-3 bg-gradient-to-t from-[#04070B]/95 via-[#04070B]/55 to-transparent z-10">
          <h3 className="text-[13px] sm:text-sm font-semibold text-white tracking-tight line-clamp-1 drop-shadow">
            {movie.title}
          </h3>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#8993A3]">
            <span>{movie.year}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{movie.genre[0]}</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-400/90 font-semibold">{movie.rating}</span>
          </div>
        </div>

        {/* Rights status — quiet corner dot-label, never a bulky pill */}
        <div className="absolute top-2.5 left-2.5 z-10 opacity-80">
          <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase text-white/85 bg-black/45 backdrop-blur-md rounded-md px-1.5 py-0.5 border border-white/[0.08]">
            <span className="w-1 h-1 rounded-full bg-emerald-400" />
            <span className="hidden sm:inline">
              {movie.rightsStatus === 'PUBLIC_DOMAIN'
                ? 'Public Domain'
                : movie.rightsStatus === 'OPEN_LICENSE'
                  ? 'Open License'
                  : movie.rightsStatus === 'TRAILER_ONLY'
                    ? 'Trailer'
                    : 'Verified'}
            </span>
            <span className="sm:hidden">✓</span>
          </span>
        </div>

        {/* Continue-watching progress */}
        {progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10 z-20">
            <div
              className="h-full bg-gradient-to-r from-[#E5093A] to-[#C0157F]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Hover action reveal (desktop; mobile relies on overlay + tap) */}
        <div className="absolute inset-0 z-20 bg-gradient-to-t from-[#04070B]/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 hidden sm:flex items-center justify-center gap-2.5">
          <button
            onClick={() => onPlay(movie, canPlayFull ? 'full' : 'trailer')}
            className="w-11 h-11 rounded-full bg-brand-gradient text-white flex items-center justify-center shadow-xl crimson-glow-sm transition-transform duration-200 hover:scale-110 active:scale-95"
            title={canPlayFull ? 'Watch Full Feature' : 'Watch Official Trailer'}
            aria-label={`Play ${movie.title}`}
          >
            <Play className="w-4 h-4 fill-white ml-0.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleWatchlist(movie.id, movie.title);
            }}
            className={`w-10 h-10 rounded-full border backdrop-blur-md flex items-center justify-center transition-transform duration-200 hover:scale-110 active:scale-95 ${
              inList
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300'
                : 'bg-black/55 border-white/20 text-white hover:bg-black/75'
            }`}
            title={inList ? 'Remove from My List' : 'Add to My List'}
            aria-label={inList ? 'Remove from My List' : 'Add to My List'}
          >
            {inList ? <Check className="w-4 h-4 text-emerald-400" /> : <Plus className="w-4 h-4" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails(movie);
            }}
            className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-black/75 transition-transform duration-200 hover:scale-110 active:scale-95"
            title="Inspect Details & Rights"
            aria-label={`Details for ${movie.title}`}
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
