"use client";

import { useEffect, useRef, useState } from "react";
import type HlsType from "hls.js";

const DEMO_HLS = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

/**
 * IQRAPRIME player shell — hls.js wired and ready.
 * Plays a demo HLS stream until real per-title sources (Xtream/HLS) are connected
 * via the P_HOST/P_USER/P_PASS env or a direct .m3u8 URL.
 */
export default function Player({ title, poster }: { title: string; poster: string }) {
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!playing) return;
    let destroyed = false;
    let hls: HlsType | null = null;

    (async () => {
      const video = videoRef.current;
      if (!video) return;
      setStatus("loading");
      try {
        const Hls = (await import("hls.js")).default;
        if (destroyed) return;
        if (Hls.isSupported()) {
          hls = new Hls({ enableWorker: true, lowLatencyMode: false });
          hls.loadSource(DEMO_HLS);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!destroyed) {
              setStatus("idle");
              void video.play().catch(() => {});
            }
          });
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal) setStatus("error");
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = DEMO_HLS;
          setStatus("idle");
          void video.play().catch(() => {});
        } else {
          setStatus("error");
        }
      } catch {
        if (!destroyed) setStatus("error");
      }
    })();

    return () => {
      destroyed = true;
      hls?.destroy();
    };
  }, [playing]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-gold/25 bg-black">
      {playing ? (
        <>
          <video
            ref={videoRef}
            className="h-full w-full"
            playsInline
            controls
            poster={poster}
            aria-label={`Playing ${title}`}
          />
          <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-gold/90 px-2 py-1 text-[10px] font-bold tracking-wide text-ink">
            DEMO STREAM · CONNECT YOUR SOURCES VIA ENV
          </span>
        </>
      ) : (
        <button
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 flex h-full w-full items-center justify-center"
          aria-label={`Play ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
          <span className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-ink/30" />
          <span className="pulse-gold relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-gold to-gold-deep text-ink shadow-2xl transition group-hover:scale-105">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
            </svg>
          </span>
          <span className="absolute bottom-5 text-sm font-semibold text-white/90">
            Play {title}
          </span>
        </button>
      )}
      {playing && status === "loading" && (
        <div className="absolute inset-0 grid place-items-center bg-ink/70" role="status" aria-live="polite">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
            <p className="text-xs text-mist">Loading stream…</p>
          </div>
        </div>
      )}
      {playing && status === "error" && (
        <div className="absolute inset-0 grid place-items-center bg-ink/85 p-6 text-center">
          <div>
            <p className="text-sm font-semibold text-gold">Stream unavailable</p>
            <p className="mt-2 text-xs text-mist max-w-sm">
              Playback sources for this title will be connected via your streaming provider
              (Xtream Codes / HLS). The player shell is ready and working.
            </p>
            <button
              onClick={() => {
                setPlaying(false);
                setStatus("idle");
              }}
              className="btn-ghost mt-4 rounded-lg px-4 py-2 text-xs font-semibold"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
