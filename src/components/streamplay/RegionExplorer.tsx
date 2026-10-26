import React, { useEffect, useState } from 'react';
import { ArrowRight, Globe2 } from 'lucide-react';
import {
  REGIONS, fetchRegionBuckets,
  type RegionBucket, type RegionKey,
} from './RegionData.js';

type Props = {
  onOpenRegion: (region: RegionKey) => void;
  /** Hide while the catalog is unavailable (anonymous without a line): we still render the section shell with an honest note. */
  catalogUnavailableNote?: boolean;
};

/**
 * RegionExplorer — "Explore by Country & Region" homepage section (§13).
 *
 * Regions/countries are derived ONLY from real provider category names
 * (see RegionData.ts). Regions without matching content never render.
 * Region cards are interactive and open the RegionBrowser overlay.
 */
export default function RegionExplorer({ onOpenRegion }: Props) {
  const [buckets, setBuckets] = useState<RegionBucket[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchRegionBuckets().then((res) => {
      if (!alive) return;
      if (res && res.length) setBuckets(res);
      else setFailed(true);
    });
    return () => { alive = false; };
  }, []);

  // Nothing verifiable → render nothing rather than a decorative country list.
  if (failed && !buckets) return null;

  return (
    <section className="sp2-section" aria-labelledby="region-heading">
      <div className="sp2-shell">
        <div className="sp2-rail-head">
          <div>
            <div className="sp2-rail-eyebrow">Discover the world</div>
            <h2 className="sp2-rail-title" id="region-heading">Explore by Country &amp; Region</h2>
            <p className="sp2-rail-sub">Stories from around the world.</p>
          </div>
        </div>

        {!buckets ? (
          <div className="sp2-region-grid mt-6" aria-hidden="true">
            {REGIONS.slice(0, 4).map((r) => (
              <div key={r.key} className="sp2-skeleton" style={{ aspectRatio: '16 / 8.4' }} />
            ))}
          </div>
        ) : (
          <div className="sp2-region-grid mt-6">
            {buckets.map((b) => (
              <button
                key={b.region.key}
                type="button"
                className="sp2-region-card"
                style={{ '--region-glow': b.region.glow, '--region-glow2': b.region.glow2 } as React.CSSProperties}
                onClick={() => onOpenRegion(b.region.key)}
                aria-label={`Explore ${b.region.name} — ${b.countries.length} territor${b.countries.length === 1 ? 'y' : 'ies'}, ${b.total} collections`}
              >
                <span className="sp2-region-bg" aria-hidden="true" />
                <span className="sp2-region-scrim" aria-hidden="true" />
                <span className="sp2-region-body">
                  <span className="min-w-0">
                    <span className="sp2-region-name block">{b.region.name}</span>
                    <span className="sp2-region-meta block truncate">
                      {b.region.tagline} · {b.countries.length} territor{b.countries.length === 1 ? 'y' : 'ies'} · {b.total} collections
                    </span>
                  </span>
                  <span className="sp2-region-glyph" aria-hidden="true">
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {failed && (
          <p className="mt-4 flex items-center gap-2 text-xs text-mist-500">
            <Globe2 className="w-3.5 h-3.5" aria-hidden="true" />
            Country browsing unlocks once your library line is connected.
          </p>
        )}
      </div>
    </section>
  );
}
