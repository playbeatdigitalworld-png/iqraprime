import React, { useState, useEffect } from 'react';
import { Channel, Movie, Series } from '../../types/playbeat';
import { Search, X, Play, Tv, Film, Layers, ChevronRight, Star } from 'lucide-react';
import { ChannelLogo } from '../common/ChannelLogo';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: Channel[];
  movies: Movie[];
  series: Series[];
  onWatchChannel: (channel: Channel) => void;
  onWatchMovie: (movie: Movie) => void;
  onSelectSeries: (series: Series) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  channels,
  movies,
  series,
  onWatchChannel,
  onWatchMovie,
  onSelectSeries
}) => {
  const [query, setQuery] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const trimmedQuery = query.toLowerCase().trim();

  const matchingChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(trimmedQuery) ||
    c.category.toLowerCase().includes(trimmedQuery) ||
    c.currentProgram.title.toLowerCase().includes(trimmedQuery)
  );

  const matchingMovies = movies.filter((m) =>
    m.title.toLowerCase().includes(trimmedQuery) ||
    m.genres.some((g) => g.toLowerCase().includes(trimmedQuery)) ||
    m.description.toLowerCase().includes(trimmedQuery)
  );

  const matchingSeries = series.filter((s) =>
    s.title.toLowerCase().includes(trimmedQuery) ||
    s.genres.some((g) => g.toLowerCase().includes(trimmedQuery)) ||
    s.description.toLowerCase().includes(trimmedQuery)
  );

  const totalResults = matchingChannels.length + matchingMovies.length + matchingSeries.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center p-4 pt-16 sm:pt-24 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-[#0c1326] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Bar Input */}
        <div className="p-4 border-b border-white/[0.08] flex items-center gap-3">
          <Search className="w-5 h-5 text-cyan-400 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search live channels, sports events, movies, series, genres..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder:text-slate-500 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-xs rounded-lg bg-white/[0.05] text-slate-400 hover:text-white border border-white/10"
          >
            Esc
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
          {!trimmedQuery ? (
            <div className="text-center py-12 space-y-3">
              <Search className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">Discover Authorized Entertainment</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Type keywords like "Sports", "Action", "Cyberpunk", or specific titles to browse channels and VODs.
              </p>
            </div>
          ) : totalResults === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-sm font-bold text-slate-300">No content found matching "{query}"</p>
              <p className="text-xs text-slate-400">Try searching for generic terms such as "Champions", "Sci-Fi", or "News".</p>
            </div>
          ) : (
            <>
              {/* Channels Section */}
              {matchingChannels.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                    <Tv className="w-3.5 h-3.5" />
                    <span>Live Channels ({matchingChannels.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {matchingChannels.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          onWatchChannel(c);
                          onClose();
                        }}
                        className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] flex items-center justify-between cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ChannelLogo src={c.logo} name={c.name} category={c.category} size="sm" />
                          <div className="truncate">
                            <span className="text-xs font-bold text-white block truncate group-hover:text-cyan-300">
                              {c.name}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {c.currentProgram.title}
                            </span>
                          </div>
                        </div>
                        <Play className="w-3.5 h-3.5 text-cyan-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Movies Section */}
              {matchingMovies.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                    <Film className="w-3.5 h-3.5" />
                    <span>Movies ({matchingMovies.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {matchingMovies.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          onWatchMovie(m);
                          onClose();
                        }}
                        className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] flex items-center justify-between cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img src={m.poster} alt={m.title} className="w-8 h-11 rounded object-cover shrink-0" />
                          <div className="truncate">
                            <span className="text-xs font-bold text-white block truncate group-hover:text-cyan-300">
                              {m.title}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {m.genres.join(', ')} · {m.year}
                            </span>
                          </div>
                        </div>
                        <Play className="w-3.5 h-3.5 text-cyan-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Series Section */}
              {matchingSeries.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                    <Layers className="w-3.5 h-3.5" />
                    <span>TV Series ({matchingSeries.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {matchingSeries.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          onSelectSeries(s);
                          onClose();
                        }}
                        className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] flex items-center justify-between cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img src={s.poster} alt={s.title} className="w-8 h-11 rounded object-cover shrink-0" />
                          <div className="truncate">
                            <span className="text-xs font-bold text-white block truncate group-hover:text-cyan-300">
                              {s.title}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {s.seasonCount} Seasons · {s.genres.join(', ')}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 group-hover:text-cyan-300 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
