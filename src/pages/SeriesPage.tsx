import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { CatalogCategory, CatalogItem, CatalogSeriesInfo, Movie } from '../types/index.js';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { Loader2, Search, Tv, Play, X, Star, Clock } from 'lucide-react';

interface SeriesPageProps {
  onPlayMovie: (movie: Movie, mode?: 'full' | 'trailer') => void;
}

const PAGE_SIZE = 60;

/**
 * Series — the provider's full series catalog (categories, search, pagination)
 * with season/episode browsing, streamed from the viewer's own Star IPTV line.
 */
export const SeriesPage: React.FC<SeriesPageProps> = ({ onPlayMovie }) => {
  const { user } = useAuth();
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

  const [selectedSeries, setSelectedSeries] = useState<CatalogSeriesInfo | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeSeason, setActiveSeason] = useState<number>(0);
  const [playingEpisode, setPlayingEpisode] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = () => {
      api.getCatalogCategories('series')
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
  }, [user, reloadKey]);

  useEffect(() => {
    if (!user || !categoryId) { setItems([]); return; }
    let alive = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = () => {
      setLoading(true);
      setError(null);
      api.getCatalogItems('series', categoryId, page, PAGE_SIZE)
        .then((res) => {
          if (!alive) return;
          setTotal(res.totalInCategory);
          setItems((prev) => (page === 1 ? res.items : [...prev, ...res.items]));
        })
        .catch((e) => {
          if (!alive) return;
          setError(e.message || 'Failed to load series');
          if (attempts < 1) { attempts += 1; timer = setTimeout(load, 2500); }
        })
        .finally(() => alive && setLoading(false));
    };
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [user, categoryId, page, reloadKey]);

  const runSearch = useCallback(async () => {
    if (!search.trim()) { setSearchResults(null); return; }
    setSearching(true);
    setError(null);
    try {
      const res = await api.searchCatalog('series', search.trim(), categoryId || undefined);
      setSearchResults(res.items);
    } catch (e: any) {
      setError(e.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [search, categoryId]);

  const openSeries = useCallback(async (item: CatalogItem) => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await api.getCatalogSeries(item.numericId);
      setSelectedSeries(res.series);
      setActiveSeason(res.series.seasons[0]?.season ?? 0);
    } catch (e: any) {
      setError(e.message || 'Failed to load series');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const playEpisode = useCallback(async (series: CatalogSeriesInfo, episode: { id: string; title: string; season: number; episodeNum: number }) => {
    setPlayingEpisode(episode.id);
    setError(null);
    try {
      const resolved = await api.resolveCatalogPlay('series', series.id, episode.id);
      onPlayMovie({
        id: `ep-${episode.id}`,
        title: `${series.name} — S${String(episode.season).padStart(2, '0')}E${String(episode.episodeNum).padStart(2, '0')} ${episode.title}`.trim(),
        description: series.plot || '',
        poster: series.poster || '',
        backdrop: series.backdrop || series.poster || '',
        year: Number(series.releaseDate?.slice(0, 4)) || 0,
        genre: series.genre ? series.genre.split(',').map((g) => g.trim()).filter(Boolean) : [],
        duration: '',
        language: 'Multi-Language',
        rating: '',
        videoUrl: resolved.url,
        trailerUrl: '',
        source: 'Star IPTV Series',
        license: 'Authorized Reseller Line',
        licenseUrl: '',
        attribution: resolved.line,
        rightsStatus: 'AUTHORIZED_RESELLER',
        enabled: true,
      }, 'full');
    } catch (e: any) {
      setError(e.message || 'Playback failed');
    } finally {
      setPlayingEpisode(null);
    }
  }, [onPlayMovie]);

  const visible: CatalogItem[] = searchResults ?? items;
  const currentSeason = useMemo(
    () => selectedSeries?.seasons.find((s) => s.season === activeSeason) ?? selectedSeries?.seasons[0],
    [selectedSeries, activeSeason],
  );

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 min-h-screen">
        <div className="py-20 text-center bg-[#111A27]/40 rounded-2xl border border-white/5 p-8">
          <Tv className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">Sign in to browse series</h3>
          <p className="text-xs text-slate-400 mt-1">The full series library streams from your Star IPTV line.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[#E5093A] uppercase tracking-wider">
          <Tv className="w-3.5 h-3.5" />
          <span>Full Series Library — Your Star IPTV Line</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
          Series & Episodes
        </h1>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6 bg-[#111A27] p-4 rounded-2xl border border-white/5">
        <div className="flex items-center gap-3 flex-1">
          <Tv className="w-4 h-4 text-[#E5093A] shrink-0" />
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
            placeholder="Search all series (Enter)…"
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

      {/* Series Grid */}
      {visible.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {visible.map((item) => (
              <button
                key={item.id}
                onClick={() => openSeries(item)}
                className="group text-left rounded-xl overflow-hidden bg-[#111A27] border border-white/5 hover:border-white/20 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E5093A]"
              >
                <div className="relative aspect-[2/3] bg-[#080B12]">
                  {item.poster ? (
                    <img src={item.poster} alt={item.name} referrerPolicy="no-referrer" loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Tv className="w-8 h-8 text-slate-700" /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-90" />
                  {item.rating && Number(item.rating) > 0 && (
                    <span className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-bold text-amber-400">
                      <Star className="w-2.5 h-2.5 fill-amber-400" />{Number(item.rating).toFixed(1)}
                    </span>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-[11px] font-semibold text-white leading-tight line-clamp-2">{item.name}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {!searchResults && items.length < total && (
            <div className="flex flex-col items-center gap-2 mt-8">
              <span className="text-[11px] text-slate-500">Showing {items.length} of {total} series in this category</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white border border-white/10 disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Load More Series'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="py-20 text-center bg-[#111A27]/40 rounded-2xl border border-white/5 p-8">
          <Tv className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">{loading ? 'Loading series…' : 'No series found'}</h3>
          <p className="text-xs text-slate-400 mt-1">{searchResults ? 'Try a different search.' : 'Pick a category above to browse the library.'}</p>
        </div>
      )}

      {/* Series Detail Modal */}
      {(selectedSeries || detailLoading) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-xl" onClick={() => { setSelectedSeries(null); }}>
          <div className="min-h-screen p-4 sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="max-w-5xl mx-auto rounded-2xl bg-[#0B0F17] border border-white/10 overflow-hidden">
              {detailLoading || !selectedSeries ? (
                <div className="p-16 flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#E5093A] animate-spin" /></div>
              ) : (
                <>
                  {/* Hero */}
                  <div className="relative">
                    <div className="h-56 sm:h-72 w-full overflow-hidden bg-[#111A27]">
                      {selectedSeries.backdrop || selectedSeries.poster ? (
                        <img src={selectedSeries.backdrop || selectedSeries.poster} alt={selectedSeries.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/60 to-transparent" />
                    <button
                      onClick={() => setSelectedSeries(null)}
                      className="absolute top-4 right-4 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/10"
                      aria-label="Close details"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-4 left-5 right-5 flex items-end gap-4">
                      {selectedSeries.poster && (
                        <img src={selectedSeries.poster} alt="" referrerPolicy="no-referrer" className="hidden sm:block w-24 rounded-lg border border-white/10 shadow-xl" />
                      )}
                      <div>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight">{selectedSeries.name}</h2>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-300">
                          {selectedSeries.releaseDate && <span>{selectedSeries.releaseDate.slice(0, 4)}</span>}
                          {selectedSeries.rating && Number(selectedSeries.rating) > 0 && (
                            <span className="flex items-center gap-1 text-amber-400 font-bold"><Star className="w-3 h-3 fill-amber-400" />{Number(selectedSeries.rating).toFixed(1)}</span>
                          )}
                          {selectedSeries.episodeRunTime ? <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{selectedSeries.episodeRunTime}m</span> : null}
                          {selectedSeries.genre && <span className="line-clamp-1">{selectedSeries.genre}</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 sm:p-6 space-y-5">
                    {selectedSeries.plot && (
                      <p className="text-sm text-slate-300 leading-relaxed">{selectedSeries.plot}</p>
                    )}

                    {/* Season selector */}
                    {selectedSeries.seasons.length > 1 && (
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                        {selectedSeries.seasons.map((s) => (
                          <button
                            key={s.season}
                            onClick={() => setActiveSeason(s.season)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                              (currentSeason?.season ?? 0) === s.season
                                ? 'bg-[#E5093A] text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-white/10'
                            }`}
                          >
                            {s.season === 0 ? 'Specials' : `Season ${s.season}`}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Episodes */}
                    <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
                      {(currentSeason?.episodes ?? []).map((ep) => (
                        <button
                          key={ep.id}
                          onClick={() => playEpisode(selectedSeries, ep)}
                          disabled={playingEpisode === ep.id}
                          className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-left transition-colors disabled:opacity-50 group"
                        >
                          <span className="w-10 shrink-0 text-center text-xs font-bold text-slate-400">E{String(ep.episodeNum).padStart(2, '0')}</span>
                          <span className="flex-1 text-xs font-medium text-white line-clamp-1">{ep.title}</span>
                          {ep.info?.duration ? <span className="hidden sm:block text-[10px] text-slate-500">{Math.round(Number(ep.info.duration) / 60)}m</span> : null}
                          <span className="p-1.5 rounded-lg bg-[#E5093A]/20 text-[#E5093A] group-hover:bg-[#E5093A] group-hover:text-white transition-colors">
                            {playingEpisode === ep.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
