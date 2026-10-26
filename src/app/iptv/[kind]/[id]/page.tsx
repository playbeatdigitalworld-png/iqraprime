"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import VideoPlayer from "@/components/VideoPlayer";
import IptvLineDialog from "@/components/IptvLineDialog";
import { encodeLine, readLine, useIptvLine } from "@/hooks/useIptvLine";

interface Episode {
  id: string;
  episode_num: number;
  title: string;
  container_extension: string;
  image?: string;
  plot?: string;
  duration?: string;
  season: number;
}

function authHeaders(): Record<string, string> {
  const l = readLine();
  return l ? { "x-iptv-line": encodeLine(l) } : {};
}

export default function ProviderTitlePage() {
  const params = useParams<{ kind: string; id: string }>();
  const kind = params?.kind === "series" ? "series" : "movie";
  const id = Number(params?.id);
  const { connected, ready } = useIptvLine();

  const [meta, setMeta] = useState<{ name: string; poster: string; plot: string; genre: string; year?: number | null; rating?: number } | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [season, setSeason] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [lineDialog, setLineDialog] = useState(false);

  useEffect(() => {
    if (!ready || !connected || !id) return;
    let dead = false;
    setLoading(true);

    (async () => {
      if (kind === "movie") {
        const r = await fetch(`/api/xtream/catalog?type=movies&page_size=1&page=1`, { headers: authHeaders(), cache: "no-store" }).catch(() => null);
        // find item in full list via catalog search by id isn't supported — use series-free approach:
        const lr = await fetch(`/api/xtream/resolve?kind=movie&id=${id}`, { headers: authHeaders(), cache: "no-store" }).catch(() => null);
        const rd = lr ? await lr.json().catch(() => null) : null;
        // fetch display info from catalog (search all pages is heavy) — use vod_info instead:
        const pr = await fetch(`/api/xtream/ping`, { headers: authHeaders(), cache: "no-store" }).catch(() => null);
        void pr; void r;
        if (!dead) {
          setMeta({
            name: rd?.name ? String(rd.name) : `Movie #${id}`,
            poster: "",
            plot: "",
            genre: "",
          });
          setLoading(false);
        }
      } else {
        const r = await fetch(`/api/xtream/series?id=${id}`, { headers: authHeaders(), cache: "no-store" }).catch(() => null);
        const d = r ? await r.json().catch(() => null) : null;
        if (!dead && d?.episodes) {
          const seasons = Array.from(new Set((d.episodes as Episode[]).map((e) => e.season))).sort((a, b) => a - b);
          setEpisodes(d.episodes as Episode[]);
          setSeasons(seasons);
          setSeason(seasons[0] ?? 1);
          setMeta({
            name: d.info?.name || `Series #${id}`,
            poster: d.info?.cover || "",
            plot: d.info?.plot || "",
            genre: d.info?.genre || "",
            year: d.info?.releaseDate ? new Date(d.info.releaseDate).getFullYear() : null,
            rating: Number(d.info?.rating) || 0,
          });
        }
        if (!dead) setLoading(false);
      }
    })();

    return () => { dead = true; };
  }, [kind, id, connected, ready]);

  const resolveMovie = useCallback(async () => {
    const r = await fetch(`/api/xtream/resolve?kind=movie&id=${id}`, { headers: authHeaders(), cache: "no-store" });
    const d = await r.json();
    return d?.url || null;
  }, [id]);

  const seasonEpisodes = episodes.filter((e) => e.season === (season ?? seasons[0] ?? 1));

  if (!ready) return <div className="mx-auto max-w-5xl px-4 pt-10 h-96 animate-pulse rounded-2xl bg-navy" />;

  if (!connected) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-16 pb-20 text-center">
        <h1 className="font-display text-2xl font-bold text-white">IPTV line required</h1>
        <p className="mt-3 text-sm text-mist">Connect your line to play this title in the IQRAPRIME Player.</p>
        <button onClick={() => setLineDialog(true)} className="btn-gold mt-6 rounded-lg px-6 py-2.5 text-sm">Connect IPTV Line</button>
        <IptvLineDialog open={lineDialog} onClose={() => setLineDialog(false)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 pb-16">
      <Link href="/iptv" className="text-xs font-semibold text-gold hover:text-gold-soft">← IPTV Library</Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div>
          {kind === "movie" ? (
            <VideoPlayer resolveUrl={resolveMovie} title={meta?.name || `Movie #${id}`} poster={meta?.poster || undefined} />
          ) : (
            <>
              <VideoPlayer
                key={`ep-${seasonEpisodes[0]?.id ?? "none"}`}
                src={undefined}
                title={seasonEpisodes[0] ? `S${season}·E${seasonEpisodes[0].episode_num} — ${meta?.name}` : (meta?.name || `Series #${id}`)}
                poster={seasonEpisodes[0]?.image || meta?.poster || undefined}
                resolveUrl={async () => {
                  const first = seasonEpisodes[0];
                  if (!first) return null;
                  const r = await fetch(`/api/xtream/resolve?kind=episode&id=${first.id}&ext=${first.container_extension}`, { headers: authHeaders(), cache: "no-store" });
                  const d = await r.json();
                  return d?.url || null;
                }}
              />
              {seasons.length > 1 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {seasons.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSeason(s)}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition ${season === s ? "bg-gold text-ink border-gold" : "border-gold/25 text-mist hover:text-gold"}`}
                    >
                      Season {s}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-4 grid gap-2">
                {seasonEpisodes.map((e) => (
                  <EpisodeRow key={e.id} e={e} />
                ))}
              </div>
            </>
          )}
        </div>

        <aside className="order-first lg:order-last">
          {loading ? (
            <div className="h-64 animate-pulse rounded-xl bg-navy" />
          ) : (
            <div>
              {meta?.poster && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={meta.poster} alt="" className="w-full rounded-xl border border-gold/20" />
              )}
              <h1 className="mt-3 font-display text-2xl font-bold text-white">{meta?.name}</h1>
              {meta?.genre && <p className="mt-1 text-xs text-gold">{meta.genre}</p>}
              {meta?.plot && <p className="mt-3 text-sm leading-relaxed text-mist line-clamp-6">{meta.plot}</p>}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function EpisodeRow({ e }: { e: Episode }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const play = async () => {
    setOpen((v) => !v);
    if (!url) {
      const r = await fetch(`/api/xtream/resolve?kind=episode&id=${e.id}&ext=${e.container_extension}`, { headers: authHeaders(), cache: "no-store" });
      const d = await r.json();
      setUrl(d?.url || null);
    }
  };

  return (
    <div className="rounded-xl border border-gold/15 bg-navy/70">
      <button onClick={play} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:border-gold/40">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold text-xs font-bold">
          {String(e.episode_num).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-white">{e.title}</span>
          <span className="block text-[11px] text-mist">Season {e.season}{e.duration ? ` · ${e.duration}` : ""}</span>
        </span>
        <span className="text-gold">{open ? "▾" : "▶"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          {url ? (
            <VideoPlayer key={e.id} src={url} title={e.title} poster={e.image} />
          ) : (
            <p className="text-xs text-mist">Resolving episode stream…</p>
          )}
        </div>
      )}
    </div>
  );
}
