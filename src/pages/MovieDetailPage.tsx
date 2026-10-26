import React, { useState, useEffect } from 'react';
import { Play, Film, Plus, Check, X, ShieldCheck, ExternalLink, Loader2 } from 'lucide-react';
import type { Movie } from '../types/index.js';
import { api } from '../services/api.js';
import { useWatchlist } from '../context/WatchlistContext.js';
import { LegalBadge } from '../components/common/LegalBadge.js';
import { MediaCard } from '../components/common/MediaCard.js';

interface MovieDetailPageProps {
  movie: Movie;
  allMovies: Movie[];
  onPlay: (movie: Movie, mode?: 'full' | 'trailer') => void;
  onOpenDetails: (movie: Movie) => void;
  onClose: () => void;
}

export const MovieDetailPage: React.FC<MovieDetailPageProps> = ({
  movie,
  allMovies,
  onPlay,
  onOpenDetails,
  onClose,
}) => {
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const inList = isInWatchlist(movie.id);

  // Provider catalog movie (Star IPTV VOD): enrich details from the line.
  const isCatalogMovie = movie.source === 'Star IPTV VOD' && movie.id.startsWith('vod-');
  const [info, setInfo] = useState<{ plot: string; genre: string[]; duration: string; year: number; rating: string; poster: string; backdrop: string } | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!isCatalogMovie) return;
    let alive = true;
    const numericId = Number(movie.id.replace('vod-', ''));
    api.getCatalogMovie(numericId)
      .then(({ movie: m }) => {
        if (!alive) return;
        setInfo({
          plot: m.plot || movie.description,
          genre: m.genre ? m.genre.split(',').map((g) => g.trim()).filter(Boolean) : movie.genre,
          duration: m.duration || '',
          year: Number(m.releasedate?.slice(0, 4)) || movie.year,
          rating: m.rating ? `${Number(m.rating).toFixed(1)}/10` : movie.rating,
          poster: m.poster || movie.poster,
          backdrop: m.backdrop || movie.backdrop,
        });
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [isCatalogMovie, movie.id]);

  const shownMovie: Movie = info
    ? { ...movie, description: info.plot, genre: info.genre, duration: info.duration, year: info.year, rating: info.rating || movie.rating, poster: info.poster, backdrop: info.backdrop }
    : movie;

  const handlePlay = async (mode: 'full' | 'trailer') => {
    if (!isCatalogMovie) {
      onPlay(shownMovie, mode);
      onClose();
      return;
    }
    setResolving(true);
    try {
      const resolved = await api.resolveCatalogPlay('vod', shownMovie.id);
      onPlay({ ...shownMovie, videoUrl: resolved.url }, mode);
      onClose();
    } catch {
      // leave the modal open; the user can retry
    } finally {
      setResolving(false);
    }
  };

  const canPlayFull = isCatalogMovie || (Boolean(shownMovie.videoUrl) && shownMovie.rightsStatus !== 'TRAILER_ONLY');
  const relatedMovies = allMovies
    .filter((m) => m.id !== shownMovie.id && m.genre.some((g) => shownMovie.genre.includes(g)))
    .slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="min-h-screen pb-16">
        {/* Backdrop & Hero Header */}
        <div className="relative w-full h-[55vh] min-h-[380px] max-h-[550px] overflow-hidden">
          <img
            src={shownMovie.backdrop || shownMovie.poster}
            alt={shownMovie.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center"
          />
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#04070B] via-[#04070B]/70 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#04070B] via-[#04070B]/50 to-transparent" />
          <div className="absolute inset-0 cine-vignette opacity-60" />

          {/* Top Close Button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 z-20 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/10 transition-colors"
            aria-label="Close details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Container */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-36 relative z-10">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Poster Card */}
            <div className="w-48 sm:w-60 shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#111A27] mx-auto md:mx-0">
              <img
                src={shownMovie.poster}
                alt={shownMovie.title}
                referrerPolicy="no-referrer"
                className="w-full aspect-[2/3] object-cover"
              />
            </div>

            {/* Info and Actions */}
            <div className="flex-1 text-left">
              {/* Unboxed Metadata */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#C6CBD4] mb-2">
                <LegalBadge status={shownMovie.rightsStatus} licenseText={shownMovie.license} />
                <span aria-hidden="true">·</span>
                <span>{shownMovie.year || ''}</span>
                <span aria-hidden="true">·</span>
                <span>{shownMovie.duration || ''}</span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-400 font-bold">{shownMovie.rating}</span>
                <span aria-hidden="true">·</span>
                <span>{shownMovie.genre.join(', ')}</span>
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-5xl font-extrabold text-white font-display tracking-tight mb-4">
                {shownMovie.title}
              </h1>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                {canPlayFull ? (
                  <button
                    onClick={() => handlePlay('full')}
                    disabled={resolving}
                    className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-brand-gradient hover:brightness-110 text-white font-semibold text-sm shadow-xl crimson-glow transition-all duration-200 active:scale-95 disabled:opacity-60"
                  >
                    {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                    <span>{resolving ? 'Preparing stream…' : 'Watch Now'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handlePlay('full')}
                    className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-brand-gradient hover:brightness-110 text-white font-semibold text-sm shadow-xl crimson-glow transition-all duration-200 active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Watch Trailer</span>
                  </button>
                )}

                {canPlayFull && shownMovie.trailerUrl && (
                  <button
                    onClick={() => {
                      onPlay(movie, 'trailer');
                      onClose();
                    }}
                    className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium border border-white/10 transition-colors"
                  >
                    <Film className="w-4 h-4 text-slate-300" />
                    <span>Preview Trailer</span>
                  </button>
                )}

                <button
                  onClick={() => toggleWatchlist(shownMovie.id, shownMovie.title)}
                  className={`flex items-center gap-2 px-5 py-3.5 rounded-xl border text-sm font-medium transition-colors ${
                    inList
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {inList ? <Check className="w-4 h-4 text-emerald-400" /> : <Plus className="w-4 h-4" />}
                  <span>{inList ? 'Saved in My List' : 'Add to My List'}</span>
                </button>
              </div>

              {/* Synopsis */}
              <div className="mb-6">
                <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-2 font-display">
                  Synopsis
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed max-w-2xl font-normal">
                  {shownMovie.description || 'Synopsis will be available shortly.'}
                </p>
              </div>

              {/* Rights, Provenance & Legal Verification Box */}
              <div className="p-4 rounded-xl bg-[#111A27] border border-white/10 max-w-2xl">
                <div className="flex items-center gap-2 text-xs font-semibold text-white mb-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Verified Legal Provenance & Licensing Record</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">License Class</span>
                    <span>{shownMovie.license}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Authorized Source</span>
                    <span>{shownMovie.source}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Statutory Attribution</span>
                    <span className="text-slate-400">{shownMovie.attribution}</span>
                  </div>
                  {shownMovie.licenseUrl && (
                    <div className="sm:col-span-2 pt-1 border-t border-white/5">
                      <a
                        href={movie.licenseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[#E5093A] hover:underline"
                      >
                        <span>View Source Verification Deed</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* More Like This */}
          {relatedMovies.length > 0 && (
            <div className="mt-14 pt-8 border-t border-white/10">
              <h3 className="text-lg md:text-xl font-bold text-white tracking-tight mb-4 font-display flex items-center gap-2.5">
                <span className="w-1 h-5 rounded-full bg-gradient-to-b from-[#E5093A] to-[#C0157F]" aria-hidden="true" />
                More Like This
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {relatedMovies.map((rel) => (
                  <MediaCard
                    key={rel.id}
                    movie={rel}
                    onPlay={onPlay}
                    onOpenDetails={onOpenDetails}
                    aspectRatio="poster"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
