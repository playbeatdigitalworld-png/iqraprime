"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import PrimePlayer from "@/components/PrimePlayer";
import IptvLineDialog from "@/components/IptvLineDialog";
import { proxiedImg } from "@/lib/imgproxy";
import { readLine, useIptvLine } from "@/hooks/useIptvLine";
import {
  episodeStreamUrl,
  getSeriesInfo,
  getVodInfo,
  movieStreamUrl,
  type EpisodeInfo,
  type SeriesInfoResult,
  type VodInfoResult,
} from "@/lib/iptv-client";

export default function ProviderTitlePage() {
  const params = useParams<{ kind: string; id: string }>();
  const kind = params?.kind === "series" ? "series" : "movie";
  const id = Number(params?.id);
  const { connectedSoft, ready, ping } = useIptvLine();

  const [meta, setMeta] = useState<VodInfoResult | SeriesInfoResult | null>(null);
  const [season, setSeason] = useState<number | null>(null);
  const [currentEp, setCurrentEp] = useState<EpisodeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [lineDialog, setLineDialog] = useState(false);

  useEffect(() => {
    if (!ready || !id) return;
    const l = readLine();
    if (!l) return;
    let dead = false;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        if (kind === "movie") {
          const info = await getVodInfo(l, id);
          if (!dead) setMeta(info);
        } else {
          const info = await getSeriesInfo(l, id);
          if (!dead && info) {
            setMeta(info);
            const seasons = Array.from(new Set(info.episodes.map((e) => e.season))).sort((a, b) => a - b);
            setSeason(seasons[0] ?? 1);
            const first = info.episodes.find((e) => e.season === (seasons[0] ?? 1));
            setCurrentEp(first ?? null);
          }
        }
      } catch (e) {
        if (!dead) setErr((e as Error).message || "Could not load this title from the provider.");
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => { dead = true; };
  }, [kind, id, ready]);

  const episodes = useMemo(() => (meta && "episodes" in meta ? meta.episodes : []), [meta]);
  const seasons = useMemo(
    () => Array.from(new Set(episodes.map((e) => e.season))).sort((a, b) => a - b),
    [episodes]
  );
  const seasonEpisodes = useMemo(
    () => episodes.filter((e) => e.season === (season ?? seasons[0] ?? 1)),
    [episodes, season, seasons]
  );

  const movieUrl = useCallback((): string | null => {
    const l = readLine();
    if (!l || kind !== "movie") return null;
    const container = (meta as VodInfoResult | null)?.container || "mp4";
    return movieStreamUrl(l, id, container);
  }, [kind, id, meta]);

  const episodeUrl = useCallback((): string | null => {
    const l = readLine();
    if (!l || !currentEp) return null;
    return episodeStreamUrl(l, Number(currentEp.id), currentEp.container_extension || "mp4");
  }, [currentEp]);

  const isSeries = kind === "series";
  const displayTitle = isSeries
    ? currentEp
      ? `S${currentEp.season} · E${currentEp.episode_num} — ${(meta as SeriesInfoResult)?.name || `Series #${id}`}`
      : (meta as SeriesInfoResult)?.name || `Series #${id}`
    : (meta as VodInfoResult)?.name || `Movie #${id}`;
  const poster = (meta?.poster || "").trim();
  const activeSrc = isSeries ? episodeUrl() : movieUrl();

  if (!ready) return <div className="mx-auto max-w-5xl px-4 pt-10 h-96 animate-pulse rounded-2xl bg-navy" />;

  if (!connectedSoft) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-16 pb-20 text-center">
        <h1 className="font-display text-2xl font-bold text-white">IPTV line not connected</h1>
        <p className="mt-3 text-sm text-mist">
          {ping && !ping.auth && ping.error === "rejected"
            ? "Your line was rejected by the provider — check the username and password in line settings."
            : "The provider server could not be reached. Check the line settings and try again."}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button onClick={() => setLineDialog(true)} className="btn-gold rounded-lg px-6 py-2.5 text-sm">Line Settings</button>
          <Link href="/iptv" className="btn-ghost rounded-lg px-6 py-2.5 text-sm">← Library</Link>
        </div>
        <IptvLineDialog open={lineDialog} onClose={() => setLineDialog(false)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 pb-16">
      <Link href="/iptv" className="text-xs font-semibold text-gold hover:text-gold-soft">← IPTV Library</Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div>
          {loading ? (
            <div className="aspect-video w-full animate-pulse rounded-xl bg-navy" />
          ) : err ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-8 text-center">
              <p className="font-display text-lg text-white">Could not open this title</p>
              <p className="mt-2 text-sm leading-relaxed text-mist">{err}</p>
            </div>
          ) : activeSrc ? (
            <PrimePlayer
              key={isSeries ? `ep-${currentEp?.id}` : `mv-${id}`}
              src={activeSrc}
              title={displayTitle}
              poster={proxiedImg(poster, displayTitle) || undefined}
              badge={isSeries ? "WEB SERIES" : "MOVIE"}
            />
          ) : (
            <div className="rounded-xl border border-gold/20 bg-navy/60 p-8 text-center">
              <p className="text-sm text-mist">{isSeries ? "No episode selected." : "Stream unavailable."}</p>
            </div>
          )}

          {isSeries && seasons.length > 1 && (
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

          {isSeries && (
            <div className="mt-4 space-y-2">
              <h2 className="text-xs font-bold tracking-widest text-gold">EPISODES ({seasonEpisodes.length})</h2>
              {seasonEpisodes.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setCurrentEp(e)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    currentEp?.id === e.id
                      ? "border-gold bg-gold/10"
                      : "border-gold/15 bg-navy/70 hover:border-gold/40"
                  }`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold text-xs font-bold">
                    {String(e.episode_num).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${currentEp?.id === e.id ? "text-gold" : "text-white"}`}>{e.title}</span>
                    <span className="block text-[11px] text-mist">
                      Season {e.season}{e.duration ? ` · ${e.duration}` : ""}
                    </span>
                  </span>
                  <span className={`text-sm ${currentEp?.id === e.id ? "text-gold" : "text-gold/60"}`}>▶</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="order-first lg:order-last">
          {loading ? (
            <div className="h-64 animate-pulse rounded-xl bg-navy" />
          ) : (
            <div>
              {poster && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={proxiedImg(poster, displayTitle)} alt="" className="w-full rounded-xl border border-gold/20" />
              )}
              <h1 className="mt-3 font-display text-2xl font-bold text-white">
                {isSeries ? (meta as SeriesInfoResult)?.name : (meta as VodInfoResult)?.name}
              </h1>
              {meta?.genre && <p className="mt-1 text-xs text-gold">{meta.genre}</p>}
              {isSeries && episodes.length > 0 && (
                <p className="mt-1 text-xs text-mist">{episodes.length} episodes · {seasons.length} season{seasons.length > 1 ? "s" : ""}</p>
              )}
              {meta?.plot && <p className="mt-3 text-sm leading-relaxed text-mist line-clamp-6">{meta.plot}</p>}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
