"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useIptvLine } from "@/hooks/useIptvLine";
import IptvLineDialog from "./IptvLineDialog";
import { readLine, type IptvLine } from "@/hooks/useIptvLine";

interface Item {
  kind: "movie" | "series";
  id: number;
  name: string;
  poster: string;
  rating: number;
  year: number | null;
  category: string;
  plot?: string;
  genre?: string;
}

export default function IptvLibraryClient() {
  const { connected, ready } = useIptvLine();
  const [tab, setTab] = useState<"movies" | "series">("movies");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Item[]; total: number; pages: number; page: number; categories: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [lineDialog, setLineDialog] = useState(false);
  const [line, setLine] = useState<IptvLine | null>(null);

  useEffect(() => setLine(readLine()), [connected]);

  useEffect(() => {
    if (!connected) { setData(null); return; }
    let dead = false;
    setLoading(true);
    const l = readLine();
    const headers: Record<string, string> = { "cache-control": "no-cache" };
    if (l) headers["x-iptv-line"] = btoa(JSON.stringify(l));
    fetch(`/api/xtream/catalog?type=${tab}&q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&page=${page}&page_size=48`, { headers, cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!dead) setData(d); })
      .catch(() => {})
      .finally(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, [tab, q, category, page, connected]);

  if (!ready) {
    return <div className="mt-8 h-64 animate-pulse rounded-2xl bg-navy" />;
  }

  if (!connected) {
    return (
      <>
        <div className="mt-8 rounded-2xl border border-gold/25 bg-gradient-to-br from-navy-2 via-navy to-ink p-10 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-gold to-gold-deep text-ink">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="m8 21 4-3 4 3M8 10l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h2 className="mt-5 font-display text-2xl font-bold text-white">Connect your IPTV line</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-mist">
            Enter your Xtream Codes line once and the entire provider library opens here — movies
            from every country, Hindi & Urdu web-series, all with real playback inside the
            IQRAPRIME Player. Your line is stored on this device only.
          </p>
          <button onClick={() => setLineDialog(true)} className="btn-gold mt-6 rounded-lg px-8 py-3 text-sm">
            Connect IPTV Line
          </button>
        </div>
        <IptvLineDialog open={lineDialog} onClose={() => setLineDialog(false)} initial={line} />
      </>
    );
  }

  const items = data?.items;

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <div className="flex rounded-xl border border-gold/25 p-1" role="tablist" aria-label="Library type">
          {(["movies", "series"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => { setTab(t); setPage(1); setCategory(""); }}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === t ? "bg-gold text-ink" : "text-mist hover:text-white"}`}
            >
              {t === "movies" ? "All Movies" : "Web Series"}
            </button>
          ))}
        </div>

        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder={`Search ${tab === "movies" ? "movies" : "series"} on your line…`}
          aria-label="Search provider library"
          className="min-w-[220px] flex-1 rounded-xl border border-gold/25 bg-navy px-4 py-2 text-sm text-white placeholder:text-mist/60 outline-none focus:border-gold"
        />

        {data?.categories && data.categories.length > 0 && (
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            aria-label="Category filter"
            className="rounded-xl border border-gold/25 bg-navy px-3 py-2 text-sm text-white outline-none focus:border-gold max-w-[220px]"
          >
            <option value="">All categories ({data.categories.length})</option>
            {data.categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-navy" />
          ))}
        </div>
      ) : items && items.length > 0 ? (
        <>
          <p className="mt-4 text-xs text-mist" aria-live="polite">
            {data?.total.toLocaleString()} titles on your line · page {data?.page}/{data?.pages}
          </p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {items.map((it) => (
              <Link
                key={`${it.kind}-${it.id}`}
                href={`/iptv/${it.kind}/${it.id}`}
                className="group card-hover relative block rounded-xl overflow-hidden border border-gold/10 bg-navy"
              >
                <div className="relative aspect-[2/3] bg-navy-2">
                  {it.poster ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={it.poster} alt={`${it.name} poster`} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-4xl text-gold/30">I</div>
                  )}
                  {it.rating > 0 && (
                    <span className="absolute right-2 top-2 rounded-md bg-ink/80 backdrop-blur px-1.5 py-0.5 text-[11px] font-bold text-gold border border-gold/30">
                      ★ {it.rating.toFixed(1)}
                    </span>
                  )}
                  <span className="absolute left-2 bottom-2 rounded-md bg-gold/90 px-1.5 py-0.5 text-[10px] font-bold text-ink uppercase">
                    {it.kind === "series" ? "Series" : "Movie"}
                  </span>
                </div>
                <div className="p-2.5">
                  <h3 className="truncate text-sm font-semibold text-white group-hover:text-gold transition">{it.name}</h3>
                  <p className="mt-0.5 truncate text-[11px] text-mist">
                    {it.year || it.category}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {(data?.pages ?? 0) > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-ghost rounded-lg px-4 py-2 text-sm disabled:opacity-40">
                ← Previous
              </button>
              <span className="text-xs text-mist">Page {page} of {data?.pages}</span>
              <button onClick={() => setPage((p) => Math.min(data?.pages || 1, p + 1))} disabled={page >= (data?.pages || 1)} className="btn-ghost rounded-lg px-4 py-2 text-sm disabled:opacity-40">
                Next →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="mt-10 rounded-2xl border border-gold/20 bg-navy/60 p-10 text-center">
          <p className="font-display text-xl text-white">No titles found</p>
          <p className="mt-2 text-sm text-mist">Try a different search or category.</p>
        </div>
      )}

      <IptvLineDialog open={lineDialog} onClose={() => setLineDialog(false)} initial={line} />
    </>
  );
}
