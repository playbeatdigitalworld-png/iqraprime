import React, { useEffect, useState } from "react";
import { MonitorPlay, Clapperboard, Tv, Layers } from "lucide-react";
import type { CatalogStatsInfo } from "../../types/index.js";

type Stat = {
  value: string;
  label: string;
  description: string;
  exact: string;
  icon: React.ComponentType<{ className?: string }>;
};

/** Format a real provider count exactly like the owner's stat bar style. */
function formatCompact(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}M+`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}K+`;
  }
  return `${n}+`;
}

/**
 * Live provider catalog stats — every number is a REAL measurement from the
 * Star IPTV provider API (never invented). Falls back to the last verified
 * build-time values when the metrics endpoint is unreachable.
 */
const FALLBACK: CatalogStatsInfo = {
  live: { total: 14177, familySafe: 14111, categories: 262 },
  vod: { total: 219999, familySafe: 219323, categories: 256 },
  series: { total: 17168, familySafe: 17162, categories: 101 },
  episodes: 512461,
  episodesMethod: 'sampled',
  episodesSampled: 812,
  measuredAt: "2026-10-07T22:53:12.418Z",
  source: "verified-build",
};

export default function StreamPlayStats() {
  const [catalogStats, setCatalogStats] = useState<CatalogStatsInfo>(FALLBACK);

  useEffect(() => {
    let alive = true;
    fetch("/api/catalog/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("stats"))))
      .then((data) => {
        if (alive && data?.stats) setCatalogStats(data.stats);
      })
      .catch(() => {
        // keep verified fallback — never show invented numbers
      });
    return () => {
      alive = false;
    };
  }, []);

  const stats: Stat[] = [
    {
      value: formatCompact(catalogStats.live.familySafe),
      label: "Channels",
      description: "Live channels",
      exact: `${catalogStats.live.familySafe.toLocaleString()} live channels`,
      icon: MonitorPlay,
    },
    {
      value: formatCompact(catalogStats.vod.familySafe),
      label: "Movies",
      description: "On-demand films",
      exact: `${catalogStats.vod.familySafe.toLocaleString()} movies`,
      icon: Clapperboard,
    },
    {
      value: formatCompact(catalogStats.series.familySafe),
      label: "World Series",
      description: "Binge-worthy shows",
      exact: `${catalogStats.series.familySafe.toLocaleString()} series`,
      icon: Tv,
    },
    {
      value: catalogStats.episodes
        ? catalogStats.episodesMethod === 'sampled'
          ? `≈${formatCompact(catalogStats.episodes)}`
          : formatCompact(catalogStats.episodes)
        : "—",
      label: "Episodes",
      description: "Series episodes",
      exact: catalogStats.episodes
        ? catalogStats.episodesMethod === 'sampled'
          ? `≈${catalogStats.episodes.toLocaleString()} episodes (uniform random sample of ${catalogStats.episodesSampled ?? '—'} series across the library)`
          : `${catalogStats.episodes.toLocaleString()} episodes`
        : "Full series episode library",
      icon: Layers,
    },
  ];

  return (
    <section className="sp2-stats" aria-label="Catalog size">
      <div className="sp2-shell">
        <div className="sp2-stats-tray">
          {stats.map((stat) => (
            <div className="sp2-stat" key={stat.label} title={stat.exact}>
              <div className="sp2-stat-icon" aria-hidden="true">
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="sp2-stat-value">{stat.value}</div>
                <div className="sp2-stat-label">{stat.label}</div>
                <div className="sp2-stat-desc">{stat.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
