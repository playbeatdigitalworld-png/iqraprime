import React, { useState, useMemo } from 'react';
import { Search, X, Play, Radio, Film } from 'lucide-react';
import type { Channel, Movie } from '../../types/index.js';
import { LegalBadge } from './LegalBadge.js';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  movies: Movie[];
  channels: Channel[];
  onPlayMovie: (movie: Movie) => void;
  onPlayChannel: (channel: Channel) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  movies,
  channels,
  onPlayMovie,
  onPlayChannel,
}) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'movies' | 'live'>('all');

  // Keyboard: Esc closes (§20 keyboard interaction)
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return { movies: [], channels: [] };

    const matchingMovies = movies.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.genre.some((g) => g.toLowerCase().includes(q)) ||
        m.license.toLowerCase().includes(q)
    );

    const matchingChannels = channels.filter(
      (c) =>
        c.channelName.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.language.toLowerCase().includes(q)
    );

    return {
      movies: activeCategory === 'live' ? [] : matchingMovies,
      channels: activeCategory === 'movies' ? [] : matchingChannels,
    };
  }, [query, movies, channels, activeCategory]);

  if (!isOpen) return null;

  const totalResults = filtered.movies.length + filtered.channels.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />
      <div className="relative w-full max-w-3xl rounded-2xl bg-[#0D1520] border border-white/10 shadow-2xl overflow-hidden z-10 flex flex-col max-h-[80vh]">
        {/* Search Header Bar */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-[#111A27]">
          <Search className="w-5 h-5 text-[#E5093A]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search verified films, directors, genres, or live channels..."
            className="flex-1 bg-transparent border-none text-white text-sm sm:text-base focus:outline-none placeholder:text-slate-500"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
            aria-label="Close search"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Segment Tabs */}
        {query && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[#080B12] border-b border-white/5 text-xs">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeCategory === 'all' ? 'bg-[#E5093A] text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Results ({movies.length + channels.length > 0 ? totalResults : 0})
            </button>
            <button
              onClick={() => setActiveCategory('movies')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeCategory === 'movies' ? 'bg-[#E5093A] text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              Cinema ({filtered.movies.length})
            </button>
            <button
              onClick={() => setActiveCategory('live')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeCategory === 'live' ? 'bg-[#E5093A] text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              Live Channels ({filtered.channels.length})
            </button>
          </div>
        )}

        {/* Search Results List */}
        <div className="p-4 overflow-y-auto space-y-4">
          {!query ? (
            <div className="py-12 text-center text-slate-400">
              <Film className="w-10 h-10 mx-auto mb-3 text-slate-600" />
              <p className="text-sm font-medium text-slate-300">Discover Authorized & Public Domain Titles</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Search through our catalog of verified classic films, open-source animated releases, and official live news broadcasts.
              </p>
              {/* Quick tags */}
              <div className="mt-4 flex flex-wrap justify-center gap-1.5 text-xs">
                {['Charade', 'Night of the Living Dead', 'DW News', 'France 24', 'Sci-Fi', 'Horror', 'NASA TV'].map(
                  (tag) => (
                    <button
                      key={tag}
                      onClick={() => setQuery(tag)}
                      className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                    >
                      {tag}
                    </button>
                  )
                )}
              </div>
            </div>
          ) : totalResults === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm font-medium text-slate-300">No matching titles found for "{query}"</p>
              <p className="text-xs text-slate-500 mt-1">
                StreamPlay strictly serves verified public broadcasts and open-domain cinema.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Channels results */}
              {filtered.channels.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Live Broadcast Channels ({filtered.channels.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filtered.channels.map((ch) => (
                      <div
                        key={ch.id}
                        onClick={() => {
                          onPlayChannel(ch);
                          onClose();
                        }}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-black/40 flex items-center justify-center p-1 shrink-0">
                          <img
                            src={ch.logo}
                            alt={ch.channelName}
                            referrerPolicy="no-referrer"
                            className="max-h-8 max-w-8 object-contain"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-white truncate">{ch.channelName}</span>
                            <span className="text-[9px] px-1 rounded bg-[#E5093A] text-white font-bold">LIVE</span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">
                            {ch.country} · {ch.category}
                          </p>
                        </div>
                        <Play className="w-4 h-4 text-slate-400 hover:text-white shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Movies results */}
              {filtered.movies.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Films & Cinema ({filtered.movies.length})
                  </h4>
                  <div className="space-y-2">
                    {filtered.movies.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          onPlayMovie(m);
                          onClose();
                        }}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer transition-colors"
                      >
                        <img
                          src={m.poster}
                          alt={m.title}
                          referrerPolicy="no-referrer"
                          className="w-10 h-14 rounded-md object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs font-semibold text-white truncate">{m.title}</h5>
                            <span className="text-[10px] text-amber-400">{m.rating}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span>{m.year}</span>
                            <span>·</span>
                            <span>{m.duration}</span>
                            <span>·</span>
                            <LegalBadge status={m.rightsStatus} />
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{m.description}</p>
                        </div>
                        <Play className="w-4 h-4 text-[#E5093A] shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
