"use client";

import { useEffect, useRef, useState } from "react";
import PrimePlayer from "./PrimePlayer";
import IptvLineDialog from "./IptvLineDialog";
import { readLine } from "@/hooks/useIptvLine";
import { getVodStreams, movieStreamUrl, type VodStream } from "@/lib/iptv-client";

interface ResolveResponse {
  playable: boolean;
  url?: string;
  name?: string;
  message?: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\((19|20)\d{2}\)/g, " ")
    .replace(/[._\-+:[\]']/g, " ")
    .replace(/\b(4k|1080p|720p|480p|hdrip|webrip|web[\s-]?dl|bluray|bdrip|hdtv|x264|x265|hevc|aac|aac5\.1|hq|hdr|multi|dual[\s-]?audio|hindi|urdu|tamil|telugu|punjabi|malayalam|bangla|english|movie|film|full|hd|dubbed)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Score a provider stream against a curated title (name + year). */
function scoreStream(v: VodStream, target: string, year: number): number {
  const n = norm(v.name || "");
  if (!n) return 0;
  const t = norm(target);
  if (!t) return 0;
  let s = 0;
  if (n === t) s = 100;
  else if (n.includes(t) || t.includes(n)) s = 80;
  else {
    const words = t.split(" ").filter((w) => w.length > 1);
    if (words.length > 1) {
      const hit = words.filter((w) => n.includes(w)).length;
      if (hit === words.length) s = 60;
      else if (hit >= words.length - 1 && hit > 1) s = 45;
    }
  }
  if (!s) return 0;
  // year proximity via the `added` timestamp helps pick the right edition
  const addedNum = Number(v.added);
  if (addedNum > 0) {
    const y = new Date(addedNum * 1000).getFullYear();
    if (y === year) s += 12;
    else if (Math.abs(y - year) <= 2) s += 6;
  }
  return s;
}

/**
 * Watch section for a curated title:
 * matches the title against the provider library straight from the browser and
 * hands the real stream to the built-in IQRAPRIME Player. No demo streams, no third-party players.
 */
export default function WatchSection({ title, year, poster }: { title: string; year: number; poster: string }) {
  const [state, setState] = useState<"resolving" | "ready" | "unlinked">("resolving");
  const [res, setRes] = useState<ResolveResponse | null>(null);
  const [lineDialog, setLineDialog] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    (async () => {
      const line = readLine();
      if (!line) {
        setState("unlinked");
        return;
      }
      try {
        const streams = await getVodStreams(line);
        const scored = streams
          .map((v) => ({ v, s: scoreStream(v, title, year) }))
          .filter((x) => x.s >= 60)
          .sort((a, b) => b.s - a.s);
        const best = scored[0];
        if (best) {
          const ext = best.v.container_extension || "mp4";
          setRes({
            playable: true,
            url: best.v.direct_source || movieStreamUrl(line, best.v.stream_id, ext),
            name: best.v.name,
          });
          setState("ready");
        } else {
          setRes({ playable: false });
          setState("unlinked");
        }
      } catch (e) {
        setRes({ playable: false, message: (e as Error).message });
        setState("unlinked");
      }
    })();
  }, [title, year]);

  if (state === "ready" && res?.url) {
    return (
      <PrimePlayer
        src={res.url}
        title={res.name || title}
        poster={poster}
        badge="PROVIDER STREAM"
      />
    );
  }

  if (state === "resolving") {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-gold/25 bg-navy grid place-items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          <p className="text-xs text-mist">Resolving playback source…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-gold/25 bg-navy grid place-items-center p-6 text-center">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15" />
        <div className="relative">
          <p className="font-display text-lg font-bold text-white">{title}</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-mist">
            {res?.message
              ? `Provider unreachable right now — ${res.message}`
              : "No stream for this title in the connected provider library. Browse the IPTV Library for everything your line offers."}
          </p>
          <button onClick={() => setLineDialog(true)} className="btn-gold mt-4 rounded-lg px-5 py-2 text-xs font-bold">
            Manage IPTV Line
          </button>
        </div>
      </div>
      <IptvLineDialog open={lineDialog} onClose={() => setLineDialog(false)} onSaved={() => window.location.reload()} />
    </div>
  );
}
