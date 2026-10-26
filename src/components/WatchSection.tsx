"use client";

import { useEffect, useRef, useState } from "react";
import PrimePlayer from "./PrimePlayer";
import IptvLineDialog from "./IptvLineDialog";
import { encodeLine, readLine } from "@/hooks/useIptvLine";

interface ResolveResponse {
  playable: boolean;
  configured?: boolean;
  url?: string;
  name?: string;
  kind?: string;
  episodes?: number;
  message?: string;
}

/**
 * Watch section for a curated title:
 * asks the server to resolve the real provider stream and hands it to the
 * built-in PrimePlayer. No demo streams, no third-party players.
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
      try {
        const headers: Record<string, string> = {};
        const line = readLine();
        if (line) headers["x-iptv-line"] = encodeLine(line);
        // 1) server-configured provider line
        const r = await fetch(
          `/api/provider/resolve?title=${encodeURIComponent(title)}&year=${year}`,
          { cache: "no-store" }
        );
        let data = (await r.json()) as ResolveResponse;
        // 2) user's own line (device-stored) if server line isn't configured
        if ((!data.playable || !data.url) && line) {
          const r2 = await fetch(
            `/api/xtream/resolve?kind=match&title=${encodeURIComponent(title)}&year=${year}`,
            { headers, cache: "no-store" }
          );
          const d2 = (await r2.json()) as { found?: boolean; url?: string; name?: string; error?: string };
          if (d2?.found && d2.url) {
            data = { playable: true, configured: true, url: d2.url, name: d2.name, kind: "vod" };
          } else if (d2?.error !== "no_line") {
            data = { playable: false, configured: true };
          }
        }
        if (data.playable && data.url) {
          setRes(data);
          setState("ready");
        } else {
          setRes(data);
          setState("unlinked");
        }
      } catch {
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
        badge={res.kind === "series" ? "SERIES STREAM" : "PROVIDER STREAM"}
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
            {res?.configured === false
              ? "Connect your IPTV line once — then this title and the entire provider library play right here in the IQRAPRIME Player."
              : "No stream for this title in the connected provider library. Browse the IPTV Library for everything your line offers."}
          </p>
          <button onClick={() => setLineDialog(true)} className="btn-gold mt-4 rounded-lg px-5 py-2 text-xs font-bold">
            {res?.configured === false ? "Connect IPTV Line" : "Manage Line"}
          </button>
        </div>
      </div>
      <IptvLineDialog open={lineDialog} onClose={() => setLineDialog(false)} onSaved={() => window.location.reload()} />
    </div>
  );
}
