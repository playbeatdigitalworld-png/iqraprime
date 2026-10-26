"use client";

import { useEffect, useState } from "react";
import VideoPlayer from "./VideoPlayer";
import IptvLineDialog from "./IptvLineDialog";
import { readLine, encodeLine } from "@/hooks/useIptvLine";

interface Props {
  title: string;
  year: number;
  poster: string;
}

/**
 * Curated-library player: matches the title against the connected IPTV line and
 * plays the REAL stream in the IQRAPRIME Player. No demo content, ever.
 */
export default function CuratedPlayer({ title, year, poster }: Props) {
  const [state, setState] = useState<"checking" | "unavailable" | "ready" | "noline">("checking");
  const [src, setSrc] = useState<string | null>(null);
  const [lineDialog, setLineDialog] = useState(false);

  useEffect(() => {
    let dead = false;
    setState("checking");
    (async () => {
      const l = readLine();
      if (!l) {
        // env line may exist on the server — try a match anyway
        const r = await fetch(`/api/xtream/resolve?kind=match&title=${encodeURIComponent(title)}&year=${year}`, { cache: "no-store" }).catch(() => null);
        const d = r ? await r.json().catch(() => null) : null;
        if (dead) return;
        if (d?.found && d.url) { setSrc(d.url); setState("ready"); }
        else setState(d?.error === "no_line" ? "noline" : "unavailable");
        return;
      }
      const r = await fetch(`/api/xtream/resolve?kind=match&title=${encodeURIComponent(title)}&year=${year}`, { headers: { "x-iptv-line": encodeLine(l) }, cache: "no-store" }).catch(() => null);
      const d = r ? await r.json().catch(() => null) : null;
      if (dead) return;
      if (d?.found && d.url) { setSrc(d.url); setState("ready"); }
      else setState(d?.error === "no_line" ? "noline" : "unavailable");
    })();
    return () => { dead = true; };
  }, [title, year]);

  if (state === "checking") {
    return (
      <div className="grid aspect-video w-full place-items-center rounded-2xl border border-gold/25 bg-navy/60">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          <p className="text-xs text-mist">Checking playback sources…</p>
        </div>
      </div>
    );
  }

  if (state === "ready" && src) {
    return <VideoPlayer src={src} title={title} poster={poster} />;
  }

  return (
    <>
      <div className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-br from-navy-2 to-ink text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="relative max-w-md p-6">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-gold to-gold-deep text-ink">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="m8 21 4-3 4 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <p className="mt-4 font-display text-lg font-bold text-white">
            {state === "noline" ? "Connect your IPTV line to play" : "Not on your line yet"}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-mist">
            {state === "noline"
              ? "Real playback streams come from your IPTV line. Connect it once — then every title in the library plays here."
              : "This title isn't available on the connected line right now. Open the IPTV Library to browse everything your line offers."}
          </p>
          <button onClick={() => setLineDialog(true)} className="btn-gold mt-4 rounded-lg px-5 py-2 text-xs font-bold">
            {state === "noline" ? "Connect IPTV Line" : "Manage Line"}
          </button>
        </div>
      </div>
      <IptvLineDialog open={lineDialog} onClose={() => setLineDialog(false)} />
    </>
  );
}
