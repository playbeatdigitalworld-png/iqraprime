import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Movie, CatalogCategory, CatalogItem } from '../types/index.js';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { MediaCard } from '../components/common/MediaCard.js';
import { Film, Search, Loader2, Clapperboard } from 'lucide-react';

interface MoviesPageProps {
  movies: Movie[];
  onPlayMovie: (movie: Movie, mode?: 'full' | 'trailer') => void;
  onOpenDetails: (movie: Movie) => void;
  publicDomainOnly?: boolean;
}

const PAGE_SIZE = 60;

/**
 * Cinema — for signed-in pilot users the provider's full VOD catalog
 * (categories, search, pagination) streamed from their own Star IPTV line.
 * Anonymous / public-domain mode keeps the curated free cinema grid.
 */
export const MoviesPage: React.FC<MoviesPageProps> = ({
  movies,
  onPlayMovie,
  onOpenDetails,
  publicDomainOnly = false,
}) => {
  const { user } = useAuth();
  const catalogMode = Boolean(user) && !publicDomainOnly;

  // ---------- curated (existing behavior) ----------
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [selectedLicense, setSelectedLicense] = useState<string>(publicDomainOnly ? 'PUBLIC_DOMAIN' : 'All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const genres = ['All', 'Sci-Fi', 'Mystery', 'Comedy', 'Horror', 'Animation', 'Action'];

  const filteredMovies = useMemo(() => {
    return movies.filter((m) => {
      if (!m.enabled) return false;
      const matchesGenre = selectedGenre === 'All' || m.genre.includes(selectedGenre);
      const matchesLicense =
        selectedLicense === 'All'
          ? true
          : selectedLicense === 'PUBLIC_DOMAIN'
          ? m.rightsStatus === 'PUBLIC_DOMAIN'
          : m.rightsStatus === 'OPEN_LICENSE';
      const matchesSearch =
        !searchQuery ||
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.genre.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesGenre && matchesLicense && matchesSearch;
    });
  }, [movies, selectedGenre, selectedLicense, searchQuery]);

  // ---------- provider catalog mode ----------
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!catalogMode) return;
    let alive = true;
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = () => {
      api.getCatalogCategories('vod')
        .then((res) => {
          if (!alive) return;
          setCategories(res.categories);
          if (res.categories.length) setCategoryId(res.categories[0].id);
        })
        .catch((e) => {
          if (!alive) return;
          setError(e.message || 'Catalog unavailable');
          if (retries < 2) {
            retries += 1;
            timer = setTimeout(load, 2500 * retries);
          }
        });
    };
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [catalogMode, reloadKey]);

  useEffect(() => {
    if (!catalogMode || !categoryId) { setItems([]); return; }
    let alive = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = () => {
      setLoading(true);
      setError(null);
      api.getCatalogItems('vod', categoryId, page, PAGE_SIZE)
        .then((res) => {
          if (!alive) return;
          setTotal(res.totalInCategory);
          setItems((prev) => (page === 1 ? res.items : [...prev, ...res.items]));
        })
        .catch((e) => {
          if (!alive) return;
          setError(e.message || 'Failed to load movies');
          if (attempts < 1) { attempts += 1; timer = setTimeout(load, 2500); }
        })
        .finally(() => alive && setLoading(false));
    };
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [catalogMode, categoryId, page, reloadKey]);

  const runSearch = useCallback(async () => {
    if (!search.trim()) { setSearchResults(null); return; }
    setSearching(true);
    setError(null);
    try {
      const res = await api.searchCatalog('vod', search.trim(), categoryId || undefined);
      setSearchResults(res.items);
    } catch (e: any) {
      setError(e.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [search, categoryId]);

  const itemToMovie = useCallback((item: CatalogItem): Movie => ({
    id: item.id,
    title: item.name,
    description: item.plot || '',
    poster: item.poster || '',
    backdrop: item.poster || '',
    year: Number((item.name.match(/\((\d{4})\)/) || [])[1] || 0) || Number(item.releaseDate?.slice(0, 4)) || 0,
    genre: item.genre ? item.genre.split(',').map((g) => g.trim()).filter(Boolean) : [],
    duration: '',
    language: 'Multi-Language',
    rating: item.rating ? `${item.rating}/10` : '',
    trailerUrl: '',
    source: 'Star IPTV VOD',
    license: 'Authorized Reseller Line',
    licenseUrl: '',
    attribution: item.group || 'Star IPTV Authorized Line',
    rightsStatus: 'AUTHORIZED_RESELLER',
    featured: false,
    trending: false,
    enabled: true,
  }), []);

  const playCatalogMovie = useCallback(async (item: CatalogItem) => {
    try {
      const resolved = await api.resolveCatalogPlay('vod', item.id);
      onPlayMovie({ ...itemToMovie(item), videoUrl: resolved.url }, 'full');
    } catch (e: any) {
      setError(e.message || 'Playback failed');
    }
  }, [itemToMovie, onPlayMovie]);

  const visible: CatalogItem[] = searchResults ?? items;

  if (!catalogMode) {
    return (
      <CuratedMovies
        movies={movies}
        onPlayMovie={onPlayMovie}
        onOpenDetails={onOpenDetails}
        publicDomainOnly={publicDomainOnly}
        selectedGenre={selectedGenre}
        setSelectedGenre={setSelectedGenre}
        selectedLicense={selectedLicense}
        setSelectedLicense={setSelectedLicense}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        genres={genres}
        filteredMovies={filteredMovies}
        resetFilters={() => {
          setSelectedGenre('All');
          setSelectedLicense(publicDomainOnly ? 'PUBLIC_DOMAIN' : 'All');
          setSearchQuery('');
        }}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[#E5093A] uppercase tracking-wider">
          <Clapperboard className="w-3.5 h-3.5" />
          <span>Full Movie Library — Your Star IPTV Line</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
          Cinema & Features
        </h1>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6 bg-[#111A27] p-4 rounded-2xl border border-white/5">
        <div className="flex items-center gap-3 flex-1">
          <Film className="w-4 h-4 text-[#E5093A] shrink-0" />
          <select
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setPage(1); setSearchResults(null); setSearch(''); }}
            className="w-full bg-[#080B12] text-xs text-slate-200 border border-white/10 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#E5093A]"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="relative md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
            placeholder="Search all movies (Enter)…"
            className="w-full bg-[#080B12] text-xs text-white pl-8 pr-3 py-2.5 rounded-lg border border-white/10 focus:outline-none focus:border-[#E5093A] placeholder:text-slate-500"
          />
          {searching && <Loader2 className="w-4 h-4 text-[#E5093A] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
        </div>
      </div>

      {(searchResults || search) && (
        <div className="flex items-center justify-between mb-4 text-xs text-slate-400">
          <span>{searchResults ? `${searchResults.length} results for "${search}"` : 'Press Enter to search'}</span>
          {searchResults && (
            <button onClick={() => { setSearchResults(null); setSearch(''); }} className="text-[#E5093A] hover:underline">Clear search</button>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-between gap-3 flex-wrap">
          <span>{error}</span>
          <button
            onClick={() => { setError(null); setReloadKey((k) => k + 1); }}
            className="px-3 py-1.5 rounded-lg bg-[#E5093A] hover:bg-[#B90732] text-white text-[11px] font-bold transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {visible.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {visible.map((item) => {
              const movie = itemToMovie(item);
              return (
                <div key={item.id} className="w-full">
                  <MediaCard
                    movie={movie}
                    onPlay={() => playCatalogMovie(item)}
                    onOpenDetails={(m) => onOpenDetails(m)}
                    aspectRatio="poster"
                  />
                </div>
              );
            })}
          </div>
          {!searchResults && items.length < total && (
            <div className="flex flex-col items-center gap-2 mt-8">
              <span className="text-[11px] text-slate-500">Showing {items.length} of {total} movies in this category</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white border border-white/10 disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Load More Movies'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="py-20 text-center bg-[#111A27]/40 rounded-2xl border border-white/5 p-8">
          <Film className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">{loading ? 'Loading movies…' : 'No movies found'}</h3>
          <p className="text-xs text-slate-400 mt-1">{searchResults ? 'Try a different search.' : 'Pick a category above to browse the library.'}</p>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Curated grid (existing design, extracted verbatim for anonymous visitors
// and the public-domain cinema tab).
// ---------------------------------------------------------------------------
interface CuratedProps {
  movies: Movie[];
  onPlayMovie: (movie: Movie, mode?: 'full' | 'trailer') => void;
  onOpenDetails: (movie: Movie) => void;
  publicDomainOnly: boolean;
  selectedGenre: string;
  setSelectedGenre: (g: string) => void;
  selectedLicense: string;
  setSelectedLicense: (l: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  genres: string[];
  filteredMovies: Movie[];
  resetFilters: () => void;
}

const CuratedMovies: React.FC<CuratedProps> = ({
  onPlayMovie,
  onOpenDetails,
  publicDomainOnly,
  selectedGenre,
  setSelectedGenre,
  selectedLicense,
  setSelectedLicense,
  searchQuery,
  setSearchQuery,
  genres,
  filteredMovies,
  resetFilters,
}) => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 min-h-screen">
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[#E5093A] uppercase tracking-wider">
        <Film className="w-3.5 h-3.5" />
        <span>{publicDomainOnly ? 'Public Domain Archives' : 'Curated Cinema & Masterpieces'}</span>
      </div>
      <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
        {publicDomainOnly ? 'Public Domain & Open Cinema' : 'Cinema & Features'}
      </h1>
      <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
        Sign in to unlock the full movie library on your Star IPTV line.
      </p>
    </div>

    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8 bg-[#111A27] p-4 rounded-2xl border border-white/5">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 md:pb-0">
        {genres.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGenre(g)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              selectedGenre === g
                ? 'bg-[#E5093A] text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {!publicDomainOnly && (
          <select
            value={selectedLicense}
            onChange={(e) => setSelectedLicense(e.target.value)}
            className="bg-[#080B12] text-xs text-slate-200 border border-white/10 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-[#E5093A]"
          >
            <option value="All">All Licenses</option>
            <option value="PUBLIC_DOMAIN">Public Domain Only</option>
            <option value="OPEN_LICENSE">Open Creative Commons</option>
          </select>
        )}
        <div className="relative flex-1 sm:w-60">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, actor, genre..."
            className="w-full bg-[#080B12] text-xs text-white pl-8 pr-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-[#E5093A] placeholder:text-slate-500"
          />
        </div>
      </div>
    </div>

    {filteredMovies.length > 0 ? (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
        {filteredMovies.map((movie) => (
          <div key={movie.id} className="w-full">
            <MediaCard
              movie={movie}
              onPlay={onPlayMovie}
              onOpenDetails={onOpenDetails}
              aspectRatio="poster"
            />
          </div>
        ))}
      </div>
    ) : (
      <div className="py-20 text-center bg-[#111A27]/40 rounded-2xl border border-white/5 p-8">
        <Film className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-white">No movies matched your selection</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Try resetting your genre filter or search query.
        </p>
        <button
          onClick={resetFilters}
          className="mt-4 px-4 py-2 rounded-lg bg-white/10 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
        >
          Reset Filters
        </button>
      </div>
    )}

    <div className="mt-12 p-4 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3 text-xs text-slate-400">
      <ShieldIcon />
      <p>
        StreamPlay hosts no pirated commercial releases. Every stream source is audited against the USA Copyright Office records or Open Source Foundation deeds.
      </p>
    </div>
  </div>
);

const ShieldIcon = () => (
  <svg className="w-5 h-5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
);
