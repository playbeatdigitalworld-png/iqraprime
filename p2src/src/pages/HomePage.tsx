import React, { useEffect, useMemo, useState } from 'react';
import type { Channel, Movie, WatchProgress, CatalogHighlights, CatalogHighlightItem, CatalogItem } from '../types/index.js';
import { api } from '../services/api.js';
import { creatorHubApi } from '../services/creatorHubApi.js';
import { useAuth } from '../context/AuthContext.js';
import StreamPlayHero from '../components/streamplay/StreamPlayHero.js';
import type { HeroSlide } from '../components/streamplay/StreamPlayHero.js';
import StreamPlayStats from '../components/streamplay/StreamPlayStats.js';
import StreamPlayRail from '../components/streamplay/StreamPlayRail.js';
import type { Item } from '../components/streamplay/StreamPlayRail.js';
import RegionExplorer from '../components/streamplay/RegionExplorer.js';
import RegionBrowser from '../components/streamplay/RegionBrowser.js';
import { PremiumCard } from '../components/streamplay/PremiumCard.js';
import { EmptyState } from '../components/common/States.js';
import { PWAInstallButton } from '../components/common/PWAInstallButton.js';
import type { RegionKey } from '../components/streamplay/RegionData.js';

interface HomePageProps {
  movies: Movie[];
  channels: Channel[];
  continueWatching: WatchProgress[];
  onPlayMovie: (movie: Movie, mode?: 'full' | 'trailer') => void;
  onPlayChannel: (channel: Channel) => void;
  onOpenDetails: (movie: Movie) => void;
  onNavigate: (tab: string) => void;
}

/**
 * Home — cinematic hero + real stats + premium rails (Phase 2).
 *
 * Content sources (all real, no fabrication):
 *  - Hero: curated featured movies with authorized artwork; falls back to a
 *    branded composition when nothing is available.
 *  - Rails: full provider catalog highlights (public, credential-free)
 *    + the member's own watch progress.
 *  - New Releases: provider "added" ordering — a legitimate catalog signal.
 *  - Explore by Country & Region: provider category-name prefixes only.
 *  - Creator Hub rail: real published creator videos (may be honestly empty).
 * Playback always resolves through the viewer's own line at /catalog/play;
 * anonymous visitors are routed to the Watch tab to sign in first.
 */
export const HomePage: React.FC<HomePageProps> = ({
  movies,
  channels,
  continueWatching,
  onPlayMovie,
  onPlayChannel,
  onOpenDetails,
  onNavigate,
}) => {
  const { user } = useAuth();
  const [highlights, setHighlights] = useState<CatalogHighlights | null>(null);
  const [creatorVideos, setCreatorVideos] = useState<Awaited<ReturnType<typeof creatorHubApi.listVideos>>['videos'] | null>(null);
  const [browseRegion, setBrowseRegion] = useState<RegionKey | 'all' | null>(null);

  const enabledChannels = channels.filter((c) => c.enabled);

  // Full provider catalog sample (public endpoint, credential-free payloads).
  // Session-cached so repeat visits render rails instantly.
  useEffect(() => {
    const KEY = 'sp_catalog_highlights_v1';
    let alive = true;
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.at && Date.now() - parsed.at < 30 * 60_000 && parsed.payload) {
          setHighlights(parsed.payload);
          return;
        }
      }
    } catch { /* ignore cache errors */ }
    api.getCatalogHighlights()
      .then((res) => {
        if (alive && res && (res.live.length || res.vod.length || res.series.length)) {
          setHighlights(res);
          try {
            sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), payload: res }));
          } catch { /* storage full — non-fatal */ }
        }
      })
      .catch(() => {
        // rails fall back to the local curated catalog below
      });
    return () => {
      alive = false;
    };
  }, []);

  // Real published creator videos for the discovery rail (empty state is truthful)
  useEffect(() => {
    let alive = true;
    creatorHubApi.listVideos({ limit: 14, sort: 'recent' })
      .then((res) => alive && setCreatorVideos(res.videos ?? []))
      .catch(() => alive && setCreatorVideos(null));
    return () => { alive = false; };
  }, []);

  /* ---------------- Rail item mapping ---------------- */
  function highlightToItem(h: CatalogHighlightItem): Item {
    return {
      id: h.id,
      title: h.name,
      subtitle: h.group || (h.isSeries ? 'Series' : undefined),
      image: h.poster || undefined,
      live: h.id.startsWith('live-'),
    };
  }

  /* ---------------- Hero slides (real content only) ---------------- */
  const heroSlides: HeroSlide[] = useMemo(() => {
    const featured = movies.filter((m) => m.featured && (m.backdrop || m.poster)).slice(0, 2);
    const curated: HeroSlide[] = featured.map((m) => ({
      id: `movie-${m.id}`,
      title: m.title,
      description: m.description || undefined,
      backdrop: m.backdrop || undefined,
      poster: m.poster || undefined,
      meta: [m.year ? String(m.year) : '', m.duration || '', m.genre?.[0] || ''].filter(Boolean) as string[],
      quality: '', // only render quality chips the catalog actually provides
      badge: 'FEATURED ON STREAMPLAY',
      onStart: () => onPlayMovie(m),
      onDetails: () => onOpenDetails(m),
      onTrailer: m.trailerUrl ? () => onPlayMovie(m, 'trailer') : undefined,
    }));

    const catalog = (highlights?.vod ?? []).filter((h) => h.poster).slice(0, 3);
    const fromCatalog: HeroSlide[] = catalog.map((h) => ({
      id: h.id,
      title: h.name,
      backdrop: h.poster, // provider exposes the poster art; used as backdrop cover
      poster: h.poster,
      meta: h.rating ? [`Rating ${h.rating}`] : [],
      badge: 'FROM THE LIBRARY',
      onStart: () => handlePlay(highlightToItem(h)),
    }));

    return [...curated, ...fromCatalog].slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movies, highlights]);

  /* ---------------- Rail item mapping ---------------- */
  const liveNowItems: Item[] = highlights?.live.length
    ? highlights.live.map(highlightToItem)
    : enabledChannels.map((c) => ({
        id: c.id,
        title: c.channelName,
        subtitle: c.category,
        image: c.logo || undefined,
        live: true,
      }));

  const continueWatchingItems: Item[] = continueWatching.map((p) => {
    const pct =
      p.durationSeconds > 0
        ? Math.min(100, Math.round((p.positionSeconds / p.durationSeconds) * 100))
        : 0;
    return {
      id: p.contentId,
      title: p.title,
      subtitle:
        p.contentType === 'channel'
          ? 'Live channel'
          : pct > 0
            ? `${pct}% watched`
            : 'Movie',
      image: p.poster || undefined,
      live: p.contentType === 'channel',
      progress: pct,
    };
  });

  // Featured: provider movies, fallback to curated movies
  const featuredItems: Item[] = highlights?.vod.length
    ? highlights.vod.map(highlightToItem)
    : [...movies.filter((m) => m.featured), ...movies.filter((m) => !m.featured)].map((m) => ({
        id: m.id,
        title: m.title,
        subtitle: [m.year, m.genre?.[0]].filter(Boolean).join(' · '),
        image: m.poster || undefined,
        live: false,
      }));

  const seriesItems: Item[] = (highlights?.series || []).map(highlightToItem);

  // New Releases: provider "added" ordering (newest additions first).
  // Only shown when the provider actually exposes an added timestamp.
  const newReleaseItems: Item[] = useMemo(() => {
    const vod = highlights?.vod ?? [];
    const withDates = vod.filter((h) => h.added);
    if (withDates.length < 4) return [];
    return [...withDates]
      .sort((a, b) => String(b.added).localeCompare(String(a.added)))
      .map(highlightToItem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlights]);

  /* ---------------- Playback (unchanged authorization flow) ---------------- */
  const findChannel = (id: string) => channels.find((c) => c.id === id);
  const findMovie = (id: string) => movies.find((m) => m.id === id);

  function handlePlay(item: Item) {
    // Catalog highlight items (live-*/vod-*/ser-*) resolve through the
    // viewer's own line at play time — never through mocked URLs.
    if (/^(live|vod|ser)-\d+$/.test(item.id)) {
      if (!user) {
        onNavigate('watch'); // sign in / connect line first
        return;
      }
      if (item.id.startsWith('ser-')) {
        onNavigate('movies-series'); // full series browser (episode picker)
        return;
      }
      const type = item.id.startsWith('live-') ? 'live' : 'vod';
      api.resolveCatalogPlay(type as 'live' | 'vod', item.id)
        .then((resolved) => {
          if (type === 'live') {
            onPlayChannel({
              id: item.id,
              channelName: item.title,
              logo: item.image || '',
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
          } else {
            onPlayMovie({
              id: item.id,
              title: item.title,
              description: '',
              poster: item.image || '',
              backdrop: item.image || '',
              year: 0,
              genre: [],
              duration: '',
              language: 'Multi-Language',
              rating: '',
              trailerUrl: '',
              source: 'Star IPTV VOD',
              license: 'Authorized Reseller Line',
              licenseUrl: '',
              attribution: resolved.line,
              rightsStatus: 'AUTHORIZED_RESELLER',
              featured: false,
              trending: false,
              enabled: true,
              videoUrl: resolved.url,
            } as Movie);
          }
        })
        .catch(() => onNavigate('watch'));
      return;
    }

    const channel = findChannel(item.id);
    if (channel) {
      onPlayChannel(channel);
      return;
    }
    const movie = findMovie(item.id);
    if (movie) onPlayMovie(movie);
  }

  // Catalog item playback shared with the RegionBrowser overlay
  const handleCatalogPlay = (ci: CatalogItem) => handlePlay({ id: ci.id, title: ci.name, image: ci.poster });

  const railsLoading = !highlights;

  return (
    <main className="min-h-screen bg-ink-950">
      <StreamPlayHero
        slides={heroSlides}
        onWatchNow={() => onNavigate('watch')}
        onExploreLive={() => onNavigate('live-tv')}
      />

      <StreamPlayStats />

      {/* Continue Watching — REAL progress, omitted entirely when empty */}
      {continueWatchingItems.length > 0 && (
        <StreamPlayRail
          title="Continue Watching"
          eyebrow="Pick up where you left off"
          items={continueWatchingItems}
          variant="landscape"
          cardWidth={280}
          onPlay={handlePlay}
          onViewAll={() => onNavigate('my-list')}
        />
      )}

      <StreamPlayRail
        title="Live TV"
        eyebrow="Streaming now"
        sub="Thousands of channels streaming around the clock — sign in to tune in."
        items={liveNowItems}
        variant="landscape"
        cardWidth={260}
        loading={railsLoading}
        onPlay={handlePlay}
        onViewAll={() => onNavigate('live-tv')}
      />

      <StreamPlayRail
        title="Featured Movies"
        eyebrow="On the marquee"
        items={featuredItems}
        variant="portrait"
        loading={railsLoading}
        onPlay={handlePlay}
        onViewAll={() => onNavigate('movies')}
      />

      {seriesItems.length > 0 && (
        <StreamPlayRail
          title="World Series"
          eyebrow="Box sets"
          sub="Binge-worthy stories from every corner of the map."
          items={seriesItems}
          variant="portrait"
          loading={railsLoading}
          onPlay={handlePlay}
          onViewAll={() => onNavigate('movies-series')}
        />
      )}

      {newReleaseItems.length > 0 && (
        <StreamPlayRail
          title="New Releases"
          eyebrow="Freshly added"
          sub="The newest additions to the StreamPlay library."
          items={newReleaseItems}
          variant="portrait"
          onPlay={handlePlay}
          onViewAll={() => onNavigate('movies')}
        />
      )}

      <RegionExplorer onOpenRegion={(rk) => setBrowseRegion(rk)} />

      {/* Official app & devices — install CTA + honest three-way viewing options */}
      <section className="sp2-section" aria-label="Watch on your devices">
        <div className="sp2-shell">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#111A27] via-[#0D1520] to-[#04070B] p-8 sm:p-12">
            <div
              className="absolute inset-0 pointer-events-none"
              aria-hidden="true"
              style={{ background: 'radial-gradient(55% 60% at 85% 15%, rgba(229,9,58,0.16), transparent 60%)' }}
            />
            <div className="relative grid lg:grid-cols-[1.2fr_0.8fr] gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E5093A]/10 border border-[#E5093A]/25 text-[#FF4D6F] text-[10px] font-bold tracking-[0.22em] uppercase mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5093A] animate-pulse" />
                  Official StreamPlay App
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-display tracking-tight leading-tight">
                  Take StreamPlay everywhere.
                  <span className="block text-[#8993A3] text-lg sm:text-2xl mt-2 font-semibold">
                    Install the app, stream in the browser, or connect a compatible player.
                  </span>
                </h2>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <PWAInstallButton />
                  <button
                    type="button"
                    onClick={() => onNavigate('devices')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[#C6CBD4] hover:text-white text-xs font-semibold transition-all duration-200"
                  >
                    Explore all device options
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="w-3.5 h-3.5" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Three device chips — honest capability summary */}
              <div className="grid gap-3">
                {[
                  { t: 'Install the app', d: 'Full-screen playback with home-screen launch — recommended' },
                  { t: 'Watch in browser', d: 'Instant streaming on any device, nothing to install' },
                  { t: 'Compatible player', d: 'Personal M3U/EPG line for Premium members — credentials stay server-side' },
                ].map((o, i) => (
                  <button
                    key={o.t}
                    type="button"
                    onClick={() => onNavigate('devices')}
                    className={`group flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-200 ${
                      i === 0
                        ? 'bg-[#E5093A]/10 border-[#E5093A]/35 hover:bg-[#E5093A]/15'
                        : 'bg-black/30 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <span
                      className={`flex items-center justify-center w-8 h-8 rounded-lg font-bold text-[11px] shrink-0 ${
                        i === 0 ? 'bg-[#E5093A] text-white shadow-md crimson-glow-sm' : 'bg-white/10 text-[#C6CBD4]'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold text-white font-display">{o.t}</span>
                      <span className="block text-[11px] text-[#8993A3] leading-relaxed">{o.d}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Creator Hub discovery — real published videos, honest empty state */}
      <section className="sp2-section" aria-label="Creator Hub">
        <div className="sp2-shell">
          <div className="sp2-rail-head">
            <div className="min-w-0">
              <div className="sp2-rail-eyebrow">Creator Hub</div>
              <h2 className="sp2-rail-title">Original creators. Fresh perspectives.</h2>
              <p className="sp2-rail-sub">Watch, follow and support creators publishing on StreamPlay.</p>
            </div>
            <button type="button" className="sp2-view-all" onClick={() => onNavigate('creator-hub')}>
              View all
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {creatorVideos === null ? null : creatorVideos.length === 0 ? (
            <EmptyState
              className="mt-6"
              title="No creator videos published yet"
              body="The Creator Hub is open — creators can upload from their Studio and published videos will appear right here."
              action={{ label: 'Open Creator Hub', onClick: () => onNavigate('creator-hub') }}
            />
          ) : (
            <div className="sp2-rail-scroller mt-6" style={{ gridAutoColumns: 'minmax(280px, 1fr)' }}>
              {creatorVideos.map((v) => (
                <PremiumCard
                  key={v.id}
                  variant="creator"
                  title={v.title}
                  image={v.thumb_url || undefined}
                  badge={{ label: v.kind === 'short' ? 'SHORT' : 'VIDEO' }}
                  corner={v.duration_seconds ? formatDuration(v.duration_seconds) : undefined}
                  subtitle={`${formatViews(v.valid_views)} · ${v.access.tier === 'paid' ? 'Premium' : 'Free'}`}
                  creator={v.creator ? {
                    name: v.creator.display_name || v.creator.handle,
                    handle: v.creator.handle ? `@${v.creator.handle}` : undefined,
                    verified: v.creator.is_verified,
                  } : undefined}
                  onClick={() => onNavigate('creator-hub')}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {browseRegion && (
        <RegionBrowser
          region={browseRegion}
          onClose={() => setBrowseRegion(null)}
          onPlayItem={handleCatalogPlay}
        />
      )}
    </main>
  );
};

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K views`;
  return `${n} view${n === 1 ? '' : 's'}`;
}

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m || 1}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
