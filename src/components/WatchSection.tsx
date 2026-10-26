"use client";

import { useEffect, useRef, useState } from "react";
import PrimePlayer from "./PrimePlayer";

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
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    (async () => {
      try {
        const r = await fetch(
          `/api/provider/resolve?title=${encodeURIComponent(title)}&year=${year}`,
          { cache: "no-store" }
        );
        const data = (await r.json()) as ResolveResponse;
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
              ? "The playback line is not connected on this server yet. Once P_HOST / P_USER / P_PASS are set in the environment, this title plays automatically from the live provider library."
              : "No stream for this title in the connected provider library. Browse the provider sections for the full playable catalog."}
          </p>
        </div>
      </div>
    </div>
  );
}
