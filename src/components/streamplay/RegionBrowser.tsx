import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Clapperboard, Tv, TvMinimalPlay, Globe2 } from 'lucide-react';
import type { CatalogCategory, CatalogItem } from '../../types/index.js';
import { api } from '../../services/api.js';
import { PremiumCard } from './PremiumCard.js';
import { EmptyState } from '../common/States.js';
import {
  REGIONS, buildRegionBuckets, cleanCategoryName,
  type CatalogType, type RegionKey, type RegionBucket,
} from './RegionData.js';

type Props = {
  region: RegionKey | 'all';
  onClose: () => void;
  /** Same play handler the homepage rails use (login-gated resolve flow). */
  onPlayItem: (item: CatalogItem) => void;
  onOpenDetails?: (item: CatalogItem) => void;
};

const PAGE_SIZE = 24;

/**
 * RegionBrowser — full-screen country/region discovery overlay (§13).
 *
 * Selects a region (or "all"), picks a country, then browses REAL categories
 * from the provider catalog grouped by Live TV / Movies / Series. Playing an
 * item routes through the existing authorized resolve flow — playback
 * authorization, stream resolution and credentials handling are untouched.
 */
export default function RegionBrowser({ region, onClose, onPlayItem }: Props) {
  const [selectedRegion, setSelectedRegion] = useState<RegionKey | 'all'>(region);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [type, setType] = useState<CatalogType>('vod');
  const [buckets, setBuckets] = useState<RegionBucket[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [cats, setCats] = useState<CatalogCategory[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  // Bumped by the Retry button. Changing state to its CURRENT value is a no-op
  // in React (the effect would never re-run), so a retry needs a real value
  // change — this nonce re-triggers the item-loading effect below.
  const [itemsRetry, setItemsRetry] = useState(0);

  // Load category lists once (real data only)
  useEffect(() => {
    let alive = true;
    Promise.all([api.getCatalogCategories('live'), api.getCatalogCategories('vod'), api.getCatalogCategories('series')])
      .then(([l, v, s]) => {
        if (!alive) return;
        setBuckets(buildRegionBuckets({ live: l.categories ?? [], vod: v.categories ?? [], series: s.categories ?? [] }));
      })
      .catch((e) => alive && setLoadError(e?.message || 'The catalog is not reachable right now.'));
    return () => { alive = false; };
  }, []);

  const regionBuckets = useMemo(() => {
    if (!buckets) return [];
    return selectedRegion === 'all' ? buckets : buckets.filter((b) => b.region.key === selectedRegion);
  }, [buckets, selectedRegion]);

  const country = useMemo(() => {
    for (const rb of regionBuckets) {
      const found = rb.countries.find((c) => c.country.key === selectedCountry);
      if (found) return found;
    }
    return null;
  }, [regionBuckets, selectedCountry]);

  // Categories for the selected country + type
  useEffect(() => {
    if (!country) { setCats([]); setActiveCat(null); return; }
    const list = country.categories[type] ?? [];
    setCats(list);
    setActiveCat(list.length ? list[0].id : null);
    setPage(1);
  }, [country, type]);

  // Items for the active category (paged)
  useEffect(() => {
    if (!activeCat) { setItems([]); setTotal(0); return; }
    let alive = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = () => {
      setItemsLoading(true);
      setItemsError(null);
      api.getCatalogItems(type, activeCat, page, PAGE_SIZE)
        .then((res) => {
          if (!alive) return;
          setTotal(res.totalInCategory ?? res.items.length);
          setItems((prev) => (page === 1 ? res.items : [...prev, ...res.items]));
        })
        .catch((e) => {
          if (!alive) return;
          setItemsError(e?.message || 'Could not load this collection.');
          if (attempts < 1) { attempts += 1; timer = setTimeout(load, 2500); }
        })
        .finally(() => alive && setItemsLoading(false));
    };
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [type, activeCat, page, itemsRetry]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const TYPE_TABS: Array<{ key: CatalogType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'live', label: 'Live TV', icon: TvMinimalPlay },
    { key: 'vod', label: 'Movies', icon: Clapperboard },
    { key: 'series', label: 'Series', icon: Tv },
  ];

  const visibleRegions = regionBuckets.length ? regionBuckets : buckets ?? [];

  return (
    <>
      <div className="sp2-browse-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="sp2-browse-panel" role="dialog" aria-modal="true" aria-label="Explore by country and region">
        {/* Header */}
        <div className="sp2-browse-head">
          <div className="sp2-shell py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button type="button" className="sp2-btn sp2-btn--glass !min-h-[40px] !px-3.5" onClick={onClose} aria-label="Close explorer">
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                Back
              </button>
              <div className="min-w-0">
                <h2 className="sp2-rail-title truncate">Explore by Country &amp; Region</h2>
                <p className="sp2-rail-sub !mt-0.5">Stories from around the world.</p>
              </div>
            </div>
          </div>
          {/* Region + type controls */}
          <div className="sp2-shell pb-3.5 space-y-2.5">
            <div className="sp2-chip-row" role="tablist" aria-label="Regions">
              <button
                type="button"
                role="tab"
                aria-selected={selectedRegion === 'all'}
                className={`sp2-chip ${selectedRegion === 'all' ? 'is-active' : ''}`}
                onClick={() => { setSelectedRegion('all'); setSelectedCountry(null); }}
              >
                All regions
              </button>
              {(buckets ?? []).map((b) => (
                <button
                  key={b.region.key}
                  type="button"
                  role="tab"
                  aria-selected={selectedRegion === b.region.key}
                  className={`sp2-chip ${selectedRegion === b.region.key ? 'is-active' : ''}`}
                  onClick={() => { setSelectedRegion(b.region.key); setSelectedCountry(null); }}
                >
                  {b.region.name}
                  <small>{b.total}</small>
                </button>
              ))}
            </div>

            {country && (
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="sp2-chip-row" role="tablist" aria-label="Content type">
                  {TYPE_TABS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={type === t.key}
                      className={`sp2-chip ${type === t.key ? 'is-active' : ''}`}
                      onClick={() => setType(t.key)}
                    >
                      <t.icon className="w-3.5 h-3.5" aria-hidden="true" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Country chips for the visible regions */}
            <div className="sp2-chip-row" aria-label="Countries">
              {visibleRegions.flatMap((rb) => rb.countries.map((cb) => (
                <button
                  key={cb.country.key}
                  type="button"
                  aria-pressed={selectedCountry === cb.country.key}
                  className={`sp2-chip ${selectedCountry === cb.country.key ? 'is-active' : ''}`}
                  onClick={() => { setSelectedCountry(cb.country.key); }}
                >
                  {selectedRegion === 'all' && <span className="opacity-60 font-semibold">{rb.region.name} ·</span>}
                  {cb.country.label}
                  <small>{cb.total}</small>
                </button>
              )))}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="sp2-browse-body">
          <div className="sp2-shell">
            {loadError && !buckets && (
              <EmptyState
                icon={<GlobeIcon />}
                title="Library not connected yet"
                body={loadError}
                className="mt-4"
              />
            )}

            {!loadError && !buckets && (
              <div className="sp2-region-grid mt-4" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="sp2-skeleton" style={{ aspectRatio: '16 / 8.4' }} />
                ))}
              </div>
            )}

            {buckets && !country && (
              <EmptyState
                icon={<GlobeIcon />}
                title="Pick a country to start exploring"
                body="Choose a territory above — collections come straight from the live catalog and always reflect what is really available."
                className="mt-4"
              />
            )}

            {country && cats.length === 0 && (
              <EmptyState
                icon={<GlobeIcon />}
                title={`No ${TYPE_TABS.find((t) => t.key === type)?.label.toLowerCase()} collections for ${country.country.label} right now`}
                body="Try another content type or a neighboring country — availability is always shown truthfully."
                className="mt-4"
              />
            )}

            {country && cats.length > 0 && (
              <>
                <div className="sp2-chip-row mt-1" aria-label="Collections">
                  {cats.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={activeCat === c.id}
                      className={`sp2-chip ${activeCat === c.id ? 'is-active' : ''}`}
                      onClick={() => { setActiveCat(c.id); setPage(1); }}
                    >
                      {cleanCategoryName(c.name) || c.name}
                    </button>
                  ))}
                </div>

                {itemsError && (
                  <div className="sp2-errorbar mt-4">
                    <span>{itemsError}</span>
                    <button type="button" className="sp2-btn sp2-btn--primary !min-h-[34px] !px-4 !text-[11px]" onClick={() => setItemsRetry((n) => n + 1)}>Retry</button>
                  </div>
                )}

                <div className="grid mt-5 gap-3 sm:gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(170px, 100%), 1fr))' }}>
                  {itemsLoading && items.length === 0
                    ? Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="rounded-2xl border border-white/[0.05] bg-surface-700/50 p-2 pb-3">
                          <div className="sp2-skeleton rounded-xl" style={{ aspectRatio: type === 'live' ? '16 / 9' : '2 / 3' }} />
                          <div className="sp2-skeleton h-3 rounded mt-2.5 w-3/4" />
                        </div>
                      ))
                    : items.map((item) => (
                        <PremiumCard
                          key={item.id}
                          variant={type === 'live' ? 'landscape' : 'portrait'}
                          title={item.name}
                          subtitle={cleanCategoryName(item.group || '') || undefined}
                          image={item.poster}
                          badge={type === 'live' ? { label: 'LIVE', tone: 'live' } : (item.releaseDate ? { label: String(item.releaseDate).slice(0, 4) } : null)}
                          corner={item.rating ? String(item.rating) : undefined}
                          onClick={() => onPlayItem(item)}
                        />
                      ))}
                </div>

                {!itemsLoading && items.length > 0 && items.length < total && (
                  <div className="flex flex-col items-center gap-2 mt-7">
                    <span className="text-[11px] text-mist-500">Showing {items.length} of {total.toLocaleString()}</span>
                    <button
                      type="button"
                      className="sp2-btn sp2-btn--glass !text-xs"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={itemsLoading}
                    >
                      {itemsLoading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
                      Load more
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const GlobeIcon = () => <Globe2 className="w-7 h-7" aria-hidden="true" />;
