import React, { useEffect, useState } from 'react';
import { Film, Heart, Monitor, Play, Search, Tv } from 'lucide-react';
import { ChannelRecord, MovieRecord, WebSeriesRecord } from '../../types/database';
import { useAuth } from '../../context/AuthContext';

const PAGE_SIZE = 60;

type Tab = 'home' | 'live' | 'movies' | 'series';

interface CatalogStats {
  configured: boolean;
  totalChannels: number;
  totalMovies: number;
  totalSeries: number;
  syncedAt?: string;
}

interface ChannelPage {
  total: number;
  items: ChannelRecord[];
}

interface MoviePage {
  total: number;
  movies: MovieRecord[];
}

interface SeriesPage {
  total: number;
  series: WebSeriesRecord[];
}

interface StreamingPortalProps {
  onWatchChannel: (channel: ChannelRecord) => void;
  onChannelsLoaded: (channels: ChannelRecord[]) => void;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const payload: unknown = await response.json();
    const message = typeof payload === 'object' && payload !== null && 'message' in payload &&
      typeof payload.message === 'string'
      ? payload.message
      : `Catalog request failed with HTTP ${response.status}`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function PaginationControls({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 pt-4">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"
      >
        Previous
      </button>
      <span className="text-sm text-slate-400">Page {page} of {pageCount}</span>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}

export const StreamingPortal: React.FC<StreamingPortalProps> = ({ onWatchChannel, onChannelsLoaded }) => {
  const { isFavorite, toggleFavorite, isSmartTVMode, toggleSmartTVMode } = useAuth();
  const [tab, setTab] = useState<Tab>('home');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [channels, setChannels] = useState<ChannelRecord[]>([]);
  const [movies, setMovies] = useState<MovieRecord[]>([]);
  const [series, setSeries] = useState<WebSeriesRecord[]>([]);
  const [channelTotal, setChannelTotal] = useState(0);
  const [movieTotal, setMovieTotal] = useState(0);
  const [seriesTotal, setSeriesTotal] = useState(0);
  const [channelPage, setChannelPage] = useState(1);
  const [moviePage, setMoviePage] = useState(1);
  const [seriesPage, setSeriesPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getJson<CatalogStats>('/api/stats')
      .then((data) => { if (active) setStats(data); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load catalog status');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(channelPage), pageSize: String(PAGE_SIZE) });
    if (search.trim()) params.set('search', search.trim());
    getJson<ChannelPage>(`/api/channels?${params}`)
      .then((data) => {
        if (!active) return;
        setChannels(data.items);
        onChannelsLoaded(data.items);
        setChannelTotal(data.total);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load live channels');
      });
    return () => { active = false; };
  }, [channelPage, search, onChannelsLoaded]);

  useEffect(() => {
    let active = true;
    getJson<MoviePage>(`/api/movies?page=${moviePage}&pageSize=${PAGE_SIZE}`)
      .then((data) => {
        if (!active) return;
        setMovies(data.movies);
        setMovieTotal(data.total);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load movies');
      });
    return () => { active = false; };
  }, [moviePage]);

  useEffect(() => {
    let active = true;
    getJson<SeriesPage>(`/api/series?page=${seriesPage}&pageSize=${PAGE_SIZE}`)
      .then((data) => {
        if (!active) return;
        setSeries(data.series);
        setSeriesTotal(data.total);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load series');
      });
    return () => { active = false; };
  }, [seriesPage]);

  const playMovie = (movie: MovieRecord) => onWatchChannel({
    id: movie.id,
    name: movie.officialTitle,
    officialName: movie.officialTitle,
    logo: movie.poster,
    category: movie.category,
    streamUrl: movie.streamUrl,
    isActive: true,
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'live', label: 'Live TV' },
    { id: 'movies', label: 'Movies' },
    { id: 'series', label: 'Series' },
  ];

  const channelCards = (
    <div className={`grid gap-3 ${isSmartTVMode ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'}`}>
      {channels.map((channel) => {
        const online = channel.streamHealth === 'ONLINE';
        return (
          <article key={channel.id} className="group overflow-hidden rounded-xl border border-white/10 bg-slate-900/70">
            <button
              type="button"
              onClick={() => onWatchChannel(channel)}
              className="flex aspect-video w-full items-center justify-center bg-black/40 p-5"
              aria-label={`Play ${channel.name}`}
            >
              {channel.logo
                ? <img src={channel.logo} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                : <Tv className="h-9 w-9 text-slate-600" />}
            </button>
            <div className="flex items-start justify-between gap-2 p-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-white">{channel.name}</h3>
                {channel.category && <p className="truncate text-xs text-slate-400">{channel.category}</p>}
                <p className={`mt-1 text-[10px] ${online ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {online ? 'Online' : channel.streamHealth === 'OFFLINE' ? 'Offline' : 'Not checked'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleFavorite(channel.id)}
                aria-label={isFavorite(channel.id) ? 'Remove favorite' : 'Add favorite'}
                className="shrink-0 rounded-md p-1 text-slate-400 hover:text-rose-400"
              >
                <Heart className={`h-4 w-4 ${isFavorite(channel.id) ? 'fill-rose-400 text-rose-400' : ''}`} />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );

  const movieCards = (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {movies.map((movie) => (
        <article key={movie.id} className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/70">
          <button type="button" onClick={() => playMovie(movie)} className="group relative aspect-[2/3] w-full bg-black/40">
            {movie.poster
              ? <img src={movie.poster} alt="" loading="lazy" className="h-full w-full object-cover" />
              : <Film className="mx-auto h-full w-9 text-slate-600" />}
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <Play className="h-8 w-8 fill-white" />
            </span>
          </button>
          <div className="p-3">
            <h3 className="truncate text-sm font-semibold text-white">{movie.officialTitle}</h3>
            {movie.category && <p className="truncate text-xs text-slate-400">{movie.category}</p>}
            {movie.rating && <p className="mt-1 text-xs text-amber-300">{movie.rating}</p>}
          </div>
        </article>
      ))}
    </div>
  );

  const seriesCards = (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {series.map((show) => (
        <article key={show.id} className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/70">
          <div className="aspect-[2/3] bg-black/40">
            {show.poster
              ? <img src={show.poster} alt="" loading="lazy" className="h-full w-full object-cover" />
              : <Film className="mx-auto h-full w-9 text-slate-600" />}
          </div>
          <div className="p-3">
            <h3 className="truncate text-sm font-semibold text-white">{show.title}</h3>
            {show.category && <p className="truncate text-xs text-slate-400">{show.category}</p>}
            {show.rating && <p className="mt-1 text-xs text-amber-300">{show.rating}</p>}
          </div>
        </article>
      ))}
    </div>
  );

  return (
    <main className={`min-h-screen bg-[#07090f] text-slate-100 ${isSmartTVMode ? 'text-base' : ''}`}>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090b14]/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-sm font-black text-white">
            <Tv className="h-5 w-5 text-amber-400" />
            PLAYBEAT IPTV
          </div>
          <nav className="flex items-center gap-1" aria-label="Catalog">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${tab === item.id ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-white/5'}`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {(tab === 'home' || tab === 'live') && (
              <label className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setChannelPage(1);
                  }}
                  placeholder="Search channels"
                  className="w-36 rounded-lg border border-white/10 bg-slate-900 py-2 pl-8 pr-2 text-xs text-white outline-none focus:border-amber-500 sm:w-48"
                />
              </label>
            )}
            <button
              type="button"
              onClick={toggleSmartTVMode}
              className={`flex items-center gap-1 rounded-lg border px-2 py-2 text-xs ${isSmartTVMode ? 'border-amber-400 text-amber-300' : 'border-white/10 text-slate-300'}`}
              aria-pressed={isSmartTVMode}
            >
              <Monitor className="h-4 w-4" />
              <span className="hidden sm:inline">TV mode</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {error && (
          <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {tab === 'home' && (
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-black p-6">
            <h1 className="text-2xl font-black text-white sm:text-4xl">Your provider catalog</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              <>Browse your provider's live channels, movies, and series. <a className="text-amber-300 underline" href="/admin">Manage provider settings</a>.</>
            </p>
            <div className="mt-5 flex flex-wrap gap-5 text-sm text-slate-300">
              <span>{(stats?.totalChannels ?? 0).toLocaleString()} channels</span>
              <span>{(stats?.totalMovies ?? 0).toLocaleString()} movies</span>
              <span>{(stats?.totalSeries ?? 0).toLocaleString()} series</span>
              {stats?.syncedAt
                ? <span>Last sync: {new Date(stats.syncedAt).toLocaleString()}</span>
                : stats && <span>Catalog has not synchronized yet.</span>}
            </div>
          </section>
        )}

        {(tab === 'home' || tab === 'live') && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-white">Live TV</h2>
            {channels.length ? channelCards : <p className="text-sm text-slate-400">No live channels are available in the current catalog.</p>}
            <PaginationControls page={channelPage} total={channelTotal} onChange={setChannelPage} />
          </section>
        )}

        {tab === 'movies' && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-white">Movies</h2>
            {movies.length ? movieCards : <p className="text-sm text-slate-400">No movies are available in the current catalog.</p>}
            <PaginationControls page={moviePage} total={movieTotal} onChange={setMoviePage} />
          </section>
        )}

        {tab === 'series' && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-white">Series</h2>
            {series.length ? seriesCards : <p className="text-sm text-slate-400">No series are available in the current catalog.</p>}
            <PaginationControls page={seriesPage} total={seriesTotal} onChange={setSeriesPage} />
          </section>
        )}
      </div>
    </main>
  );
};
