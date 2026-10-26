import React, { useState } from 'react';
import { Movie } from '../../types/playbeat';
import { Play, Plus, Check, Star, Info, Film, Sparkles, Filter, Search } from 'lucide-react';

interface MoviesViewProps {
  movies: Movie[];
  onWatchMovie: (movie: Movie) => void;
  onToggleMyList: (title: string) => void;
  isItemInMyList: (title: string) => boolean;
}

export const MoviesView: React.FC<MoviesViewProps> = ({
  movies,
  onWatchMovie,
  onToggleMyList,
  isItemInMyList
}) => {
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMovieForDetails, setSelectedMovieForDetails] = useState<Movie | null>(null);

  if (movies.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8 lg:py-16">
        <div className="relative overflow-hidden rounded-3xl border border-amber-200/15 bg-gradient-to-br from-[#10192a] via-[#080d18] to-[#080d18] px-6 py-12 text-center sm:px-12">
          <div className="absolute -right-12 -top-24 h-72 w-72 rounded-full border border-amber-200/10" />
          <div className="absolute -right-2 -top-14 h-52 w-52 rounded-full border border-sky-300/10" />
          <div className="relative mx-auto max-w-xl space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-200/[0.07] text-amber-200">
              <Film className="h-7 w-7" />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200">Catalog setup</div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Your movie collection will appear here</h1>
            <p className="mx-auto max-w-lg text-sm leading-6 text-slate-400">
              Connect an authorized HTTPS VOD provider to load real movie titles, artwork, and streams. No sample content is shown.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const genres = ['All', 'Action', 'Sci-Fi', 'Drama', 'Adventure', 'Crime', 'Biography', 'Animation', 'Comedy'];

  const filteredMovies = movies.filter((m) => {
    const matchesGenre = selectedGenre === 'All' || m.genres.includes(selectedGenre);
    if (!matchesGenre) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.director.toLowerCase().includes(q) ||
      m.cast.some((c) => c.toLowerCase().includes(q)) ||
      m.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-2xl font-black text-white font-display tracking-tight flex items-center gap-2">
            <Film className="w-6 h-6 text-cyan-400" />
            <span>PlayBeat Blockbuster Cinema</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Movies and playback supplied by the configured provider
          </p>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search titles, cast, director..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#0c1326] border border-white/10 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {/* Genre Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {genres.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGenre(g)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              selectedGenre === g
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'bg-[#0c1326] text-slate-400 hover:text-white border border-white/10'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Movies Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-5">
        {filteredMovies.map((movie) => {
          const inList = isItemInMyList(movie.title);
          return (
            <div
              key={movie.id}
              onClick={() => onWatchMovie(movie)}
              className="group bg-[#0c1326]/70 hover:bg-[#111b33] border border-white/[0.08] hover:border-cyan-500/50 rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] shadow-xl shadow-black/50 flex flex-col justify-between"
            >
              <div className="aspect-[2/3] w-full overflow-hidden bg-black relative">
                <img
                  src={movie.poster}
                  alt={movie.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c1326] via-transparent to-transparent opacity-90" />

                <div className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/15">
                  {movie.rating}
                </div>

                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMovieForDetails(movie);
                    }}
                    className="p-1.5 rounded-md bg-black/60 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
                    title="Movie details"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMyList(movie.title);
                    }}
                    className="p-1.5 rounded-md bg-black/60 hover:bg-cyan-500 text-white backdrop-blur-md transition-colors"
                    title="Add to My List"
                  >
                    {inList ? (
                      <Check className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                  <div className="w-12 h-12 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shadow-xl shadow-cyan-400/40 group-hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 fill-slate-950 translate-x-0.5" />
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-cyan-400 font-mono font-semibold">
                  <span>{movie.year}</span>
                  <span>{movie.duration}</span>
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                  {movie.title}
                </h3>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {movie.description}
                </p>
                <div className="pt-2 flex items-center justify-between text-[10px] text-slate-500 border-t border-white/[0.06]">
                  <span className="truncate max-w-[120px]">{movie.director}</span>
                  <span className="text-cyan-400 font-mono">Provider stream</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredMovies.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <Film className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Movies Found</h3>
          <p className="text-xs text-slate-400">
            Try adjusting your search query or selecting a different genre filter.
          </p>
        </div>
      )}

      {/* Movie Details Modal */}
      {selectedMovieForDetails && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-950 border border-white/15 rounded-3xl overflow-hidden shadow-2xl space-y-4 text-white">
            <div className="relative aspect-video w-full overflow-hidden bg-black">
              <img
                src={selectedMovieForDetails.backdrop}
                alt={selectedMovieForDetails.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              <button
                onClick={() => setSelectedMovieForDetails(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/60 hover:bg-white/20 text-white"
              >
                <Info className="w-4 h-4" />
              </button>
              <div className="absolute bottom-4 left-6 right-6 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                    {selectedMovieForDetails.rating}
                  </span>
                  <span className="text-slate-300 font-mono">{selectedMovieForDetails.year}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-300">{selectedMovieForDetails.duration}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-cyan-400 font-medium">{selectedMovieForDetails.genres.join(', ')}</span>
                </div>
                <h2 className="text-2xl font-black text-white font-display">
                  {selectedMovieForDetails.title}
                </h2>
              </div>
            </div>

            <div className="p-6 pt-0 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedMovieForDetails.description}
              </p>

              <div className="grid grid-cols-2 gap-4 text-xs bg-white/[0.03] p-3 rounded-xl border border-white/10 font-mono">
                <div>
                  <span className="text-slate-400 block">Director:</span>
                  <span className="text-white font-bold">{selectedMovieForDetails.director}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Audio / Tech:</span>
                  <span className="text-cyan-300 font-bold">{selectedMovieForDetails.language}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block">Starring:</span>
                  <span className="text-slate-200">{selectedMovieForDetails.cast.join(', ')}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    const m = selectedMovieForDetails;
                    setSelectedMovieForDetails(null);
                    onWatchMovie(m);
                  }}
                  className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Start Watching in 4K</span>
                </button>
                <button
                  onClick={() => {
                    onToggleMyList(selectedMovieForDetails.title);
                  }}
                  className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
                >
                  {isItemInMyList(selectedMovieForDetails.title) ? 'In My List' : 'Add to My List'}
                </button>
                <button
                  onClick={() => setSelectedMovieForDetails(null)}
                  className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-semibold text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
