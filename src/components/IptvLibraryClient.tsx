"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readLine, useIptvLine } from "@/hooks/useIptvLine";
import { getSeries, getSeriesCategories, getVodCategories, getVodStreams, type Category } from "@/lib/iptv-client";
import IptvLineDialog from "./IptvLineDialog";

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

/** Buckets the provider's categories into viewer-friendly country sections. */
const COUNTRY_RULES: { label: string; test: RegExp }[] = [
  { label: "India", test: /india|bollywood|hindi|telugu|tamil|malayalam|kannada|punjabi|marathi|bengali.*indian|south/i },
  { label: "Bangladesh", test: /bangla|dhaka|kolkata/i },
  { label: "Pakistan", test: /pakistan|urdu|lollywood|lahore|karachi/i },
  { label: "USA & UK", test: /hollywood|english|usa|us |uk |british|american|canada/i },
  { label: "Korea", test: /korean|k-?drama|seoul/i },
  { label: "China & Asia", test: /china|chinese|japan|japanese|thai|viet|philippine|indo|malay|asia/i },
  { label: "Turkey", test: /turk/i },
  { label: "Middle East", test: /arab|arabic|persian|iran|iraq|egypt|lebanon|dubai|hindustan.*arab/i },
  { label: "Europe", test: /spain|spanish|france|french|germany|german|italy|italian|russia|netherland|dutch|poland|nordic|sweden|norway|denmark|portug|latino|latin|espanol/i },
  { label: "Africa", test: /africa|nigeria|nollywood|ghana|kenya|somali/i },
];

function countryFor(category: string): string {
  for (const r of COUNTRY_RULES) if (r.test.test(category)) return r.label;
  return "Worldwide";
}

export default function IptvLibraryClient() {
  const { connectedSoft, ready, ping } = useIptvLine();
  const [tab, setTab] = useState<"movies" | "series">("movies");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");
  const [page, setPage] = useState(1);
  const [all, setAll] = useState<Item[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lineDialog, setLineDialog] = useState(false);

  const PAGE_SIZE = 48;

  useEffect(() => {
    if (!ready) return;
    const l = readLine();
    if (!l) return;
    let dead = false;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        let items: Item[];
        if (tab === "movies") {
          const [cats, streams] = await Promise.all([getVodCategories(l), getVodStreams(l)]);
          if (dead) return;
          setCategories(cats);
          const catName = new Map(cats.map((c) => [String(c.category_id), c.category_name]));
          items = streams.map((s) => {
            const added = s.added ? new Date(Number(s.added) * 1000) : null;
            return {
              kind: "movie" as const,
              id: s.stream_id,
              name: String(s.name || "").replace(/\.$/, ""),
              poster: s.stream_icon || "",
              rating: Math.round((Number(s.rating) || 0) * 10) / 10,
              year: added && !isNaN(added.getTime()) ? added.getFullYear() : null,
              category: catName.get(String(s.category_id)) || "Other",
            };
          });
        } else {
          const [cats, series] = await Promise.all([getSeriesCategories(l), getSeries(l)]);
          if (dead) return;
          setCategories(cats);
          const catName = new Map(cats.map((c) => [String(c.category_id), c.category_name]));
          items = series.map((s) => ({
            kind: "series" as const,
            id: s.series_id,
            name: String(s.name || "").replace(/\.$/, ""),
            poster: s.cover || "",
            rating: Math.round((Number(s.rating) || 0) * 10) / 10,
            year: s.releaseDate ? new Date(s.releaseDate).getFullYear() || null : null,
            category: catName.get(String(s.category_id)) || "Other",
            plot: s.plot || "",
            genre: s.genre || "",
          }));
        }
        if (!dead) setAll(items);
      } catch (e) {
        if (!dead) {
          setAll([]);
          setErr((e as Error).message || "Could not load the provider library.");
        }
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => { dead = true; };
  }, [tab, ready, ping?.auth]);

  const countries = useMemo(() => {
    if (!all) return [];
    const counts = new Map<string, number>();
    for (const it of all) {
      const c = countryFor(it.category);
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);

  const filtered = useMemo(() => {
    if (!all) return [];
    let list = all;
    if (country) list = list.filter((it) => countryFor(it.category) === country);
    if (category) list = list.filter((it) => it.category === category);
    const nq = q.trim().toLowerCase();
    if (nq) list = list.filter((it) => it.name.toLowerCase().includes(nq));
    return list;
  }, [all, country, category, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const items = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  if (!ready) {
    return <div className="mt-8 h-64 animate-pulse rounded-2xl bg-navy" />;
  }

  if (!connectedSoft) {
    return (
      <>
        <div className="mt-8 rounded-2xl border border-red-500/30 bg-gradient-to-br from-navy-2 via-navy to-ink p-10 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-gold to-gold-deep text-ink">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="m8 21 4-3 4 3M8 10l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h2 className="mt-5 font-display text-2xl font-bold text-white">IPTV line not connected</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-mist">
            {ping && !ping.auth
              ? ping.error === "unreachable" || ping.error === "timeout" || ping.error === "network" || ping.error === "bad_response"
                ? "The provider server could not be reached from this device. Check the server address inside the line settings, or try again when your provider is back online."
                : "Your line was rejected by the provider — check the username and password in line settings."
              : "No IPTV line is configured on this device."}
          </p>
          <button onClick={() => setLineDialog(true)} className="btn-gold mt-6 rounded-lg px-8 py-3 text-sm">
            Open Line Settings
          </button>
        </div>
        <IptvLineDialog open={lineDialog} onClose={() => setLineDialog(false)} />
      </>
    );
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <div className="flex rounded-xl border border-gold/25 p-1" role="tablist" aria-label="Library type">
          {(["movies", "series"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => { setTab(t); setPage(1); setCategory(""); setCountry(""); setQ(""); }}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === t ? "bg-gold text-ink" : "text-mist hover:text-white"}`}
            >
              {t === "movies" ? "All Movies" : "Web Series"}
            </button>
          ))}
        </div>

        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder={`Search ${tab === "movies" ? "movies" : "series"}…`}
          aria-label="Search provider library"
          className="min-w-[200px] flex-1 rounded-xl border border-gold/25 bg-navy px-4 py-2 text-sm text-white placeholder:text-mist/60 outline-none focus:border-gold"
        />

        <select
          value={country}
          onChange={(e) => { setCountry(e.target.value); setPage(1); }}
          aria-label="Country filter"
          className="rounded-xl border border-gold/25 bg-navy px-3 py-2 text-sm text-white outline-none focus:border-gold max-w-[200px]"
        >
          <option value="">All countries</option>
          {countries.map(([c, n]) => (
            <option key={c} value={c}>{c} ({n.toLocaleString()})</option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          aria-label="Category filter"
          className="rounded-xl border border-gold/25 bg-navy px-3 py-2 text-sm text-white outline-none focus:border-gold max-w-[220px]"
        >
          <option value="">All categories ({categories.length})</option>
          {categories.map((c) => (
            <option key={c.category_id} value={c.category_name}>{c.category_name}</option>
          ))}
        </select>
      </div>

      {err ? (
        <div className="mt-10 rounded-2xl border border-red-500/30 bg-red-500/5 p-10 text-center">
          <p className="font-display text-xl text-white">Provider library unavailable</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-mist">{err}</p>
          <button onClick={() => setLineDialog(true)} className="btn-ghost mt-5 rounded-lg px-5 py-2 text-sm">Check line settings</button>
        </div>
      ) : loading ? (
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-navy" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <>
          <p className="mt-4 text-xs text-mist" aria-live="polite">
            {filtered.length.toLocaleString()} {tab === "movies" ? "movies" : "series"} · page {cur}/{pages}
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
                    {countryFor(it.category)}
                  </span>
                </div>
                <div className="p-2.5">
                  <h3 className="truncate text-sm font-semibold text-white group-hover:text-gold transition">{it.name}</h3>
                  <p className="mt-0.5 truncate text-[11px] text-mist">
                    {[it.year, it.category].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={cur <= 1} className="btn-ghost rounded-lg px-4 py-2 text-sm disabled:opacity-40">
                ← Previous
              </button>
              <span className="text-xs text-mist">Page {cur} of {pages}</span>
              <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={cur >= pages} className="btn-ghost rounded-lg px-4 py-2 text-sm disabled:opacity-40">
                Next →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="mt-10 rounded-2xl border border-gold/20 bg-navy/60 p-10 text-center">
          <p className="font-display text-xl text-white">No titles found</p>
          <p className="mt-2 text-sm text-mist">Try a different search, country or category.</p>
        </div>
      )}

      <IptvLineDialog open={lineDialog} onClose={() => setLineDialog(false)} />
    </>
  );
}
