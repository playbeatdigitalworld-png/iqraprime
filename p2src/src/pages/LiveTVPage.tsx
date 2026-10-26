import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Channel, CatalogCategory, CatalogItem } from '../types/index.js';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { ChannelCard } from '../components/common/ChannelCard.js';
import { Radio, Search, Loader2, Tv } from 'lucide-react';

interface LiveTVPageProps {
  channels: Channel[];
  onPlayChannel: (channel: Channel) => void;
}

const PAGE_SIZE = 60;

/**
 * Live TV — for signed-in pilot users the full provider channel catalog
 * (thousands of channels by category, search, pagination) resolved against
 * their own Star IPTV line. Anonymous visitors keep the curated public grid.
 */
export const LiveTVPage: React.FC<LiveTVPageProps> = ({ channels, onPlayChannel }) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [catLoading, setCatLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const catalogAvailable = Boolean(user);

  // Load categories once signed in — auto-retries transient provider slowness
  useEffect(() => {
    if (!catalogAvailable) return;
    let alive = true;
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = () => {
      setCatLoading(true);
      api.getCatalogCategories('live')
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
        })
        .finally(() => alive && setCatLoading(false));
    };
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [catalogAvailable, reloadKey]);

  // Load items for the selected category (+ page) — auto-retries transient
  // provider slowness once (cold provider caches can exceed first-fetch latency)
  useEffect(() => {
    if (!categoryId) { setItems([]); return; }
    let alive = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = () => {
      setLoading(true);
      setError(null);
      api.getCatalogItems('live', categoryId, page, PAGE_SIZE)
        .then((res) => {
          if (!alive) return;
          setTotal(res.totalInCategory);
          setItems((prev) => (page === 1 ? res.items : [...prev, ...res.items]));
        })
        .catch((e) => {
          if (!alive) return;
          setError(e.message || 'Failed to load channels');
          if (attempts < 1) { attempts += 1; timer = setTimeout(load, 2500); }
        })
        .finally(() => alive && setLoading(false));
    };
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [categoryId, page, reloadKey]);

  const runSearch = useCallback(async () => {
    if (!search.trim()) { setSearchResults(null); return; }
    setSearching(true);
    setError(null);
    try {
      const res = await api.searchCatalog('live', search.trim(), categoryId || undefined);
      setSearchResults(res.items);
    } catch (e: any) {
      setError(e.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [search, categoryId]);

  const visible: CatalogItem[] = searchResults ?? items;

  const tuneIn = useCallback(async (item: CatalogItem) => {
    try {
      const resolved = await api.resolveCatalogPlay('live', item.id);
      onPlayChannel({
        id: item.id,
        channelName: item.name,
        logo: item.poster || '',
        country: 'Star IPTV Line',
        language: 'Multi-Language',
        category: 'Entertainment' as const,
        streamUrl: resolved.url,
        sourceUrl: 'Authorized Star IPTV Feed',
        sourceName: resolved.line,
        rightsStatus: 'AUTHORIZED_RESELLER',
        commercialUse: false,
        attributionRequired: false,
        lastVerified: new Date().toISOString(),
        enabled: true,
      });
    } catch (e: any) {
      setError(e.message || 'Playback failed');
    }
  }, [onPlayChannel]);

  const mappedChannels = useMemo(() => visible.map((item) => ({
    id: item.id,
    channelName: item.name,
    logo: item.poster || '',
    country: 'Star IPTV Line',
    language: 'Multi-Language',
    category: 'Entertainment' as const,
    streamUrl: '',
    sourceUrl: '',
    sourceName: 'Star IPTV Line',
    rightsStatus: 'AUTHORIZED_RESELLER' as const,
    commercialUse: false,
    attributionRequired: false,
    lastVerified: new Date().toISOString(),
    enabled: true,
  })), [visible]);

  // ---- anonymous fallback: original curated grid ----
  if (!catalogAvailable) {
    return <CuratedLiveTV channels={channels} onPlayChannel={onPlayChannel} />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 min-h-screen">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[#E5093A] uppercase tracking-wider">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>Full Channel Line-up — Your Star IPTV Line</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
          Live TV Guide
        </h1>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6 bg-[#111A27] p-4 rounded-2xl border border-white/5">
        <div className="flex items-center gap-3 flex-1">
          <Tv className="w-4 h-4 text-[#E5093A] shrink-0" />
          <select
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setPage(1); setSearchResults(null); setSearch(''); }}
            disabled={catLoading}
            className="w-full bg-[#080B12] text-xs text-slate-200 border border-white/10 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#E5093A]"
          >
            {catLoading && <option>Loading categories…</option>}
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
            placeholder="Search channels (Enter)…"
            className="w-full bg-[#080B12] text-xs text-white pl-8 pr-3 py-2.5 rounded-lg border border-white/10 focus:outline-none focus:border-[#E5093A] placeholder:text-slate-500"
          />
          {searching && <Loader2 className="w-4 h-4 text-[#E5093A] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
        </div>
      </div>

      {/* Search hint / reset */}
      {(searchResults || search) && (
        <div className="flex items-center justify-between mb-4 text-xs text-slate-400">
          <span>
            {searchResults ? `${searchResults.length} results for "${search}"` : 'Press Enter to search'}
          </span>
          {searchResults && (
            <button onClick={() => { setSearchResults(null); setSearch(''); }} className="text-[#E5093A] hover:underline">
              Clear search
            </button>
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

      {/* Channel Grid */}
      {mappedChannels.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {mappedChannels.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} onPlay={() => {
                const item = visible.find((i) => i.id === ch.id);
                if (item) tuneIn(item);
              }} />
            ))}
          </div>
          {!searchResults && items.length < total && (
            <div className="flex flex-col items-center gap-2 mt-8">
              <span className="text-[11px] text-slate-500">Showing {items.length} of {total} channels in this category</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white border border-white/10 disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Load More Channels'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="py-20 text-center bg-[#111A27]/40 rounded-2xl border border-white/5 p-8">
          <Tv className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">{loading || catLoading ? 'Loading channels…' : 'No channels found'}</h3>
          <p className="text-xs text-slate-400 mt-1">{searchResults ? 'Try a different search.' : 'Pick a category above to browse the full line-up.'}</p>
        </div>
      )}
    </div>
  );
};

/** Original curated grid — shown to anonymous visitors. */
const CuratedLiveTV: React.FC<LiveTVPageProps> = ({ channels, onPlayChannel }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredChannels = useMemo(() => {
    return channels.filter((c) => {
      if (!c.enabled) return false;
      const matchesSearch =
        !searchQuery ||
        c.channelName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [channels, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 min-h-screen">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[#E5093A] uppercase tracking-wider">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>Free-to-Air Public Broadcasts</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
          Live TV Guide
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
          Sign in to unlock the full private line-up — thousands of channels, movies, and series on your Star IPTV line.
        </p>
      </div>
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8 bg-[#111A27] p-4 rounded-2xl border border-white/5">
        <div className="relative flex-1 sm:w-60">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search curated channels…"
            className="w-full bg-[#080B12] text-xs text-white pl-8 pr-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-[#E5093A] placeholder:text-slate-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
        {filteredChannels.map((c) => (
          <ChannelCard key={c.id} channel={c} onPlay={onPlayChannel} />
        ))}
      </div>
    </div>
  );
};
