"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type HlsType from "hls.js";

interface Props {
  src?: string;
  resolveUrl?: () => Promise<string | null>;
  title: string;
  poster?: string;
}

const fmt = (s: number) => {
  if (!isFinite(s)) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};

/**
 * IQRAPRIME PLAYER — fully custom-built playback engine.
 * Own controls, own UI, hls.js internally for adaptive streams. No third-party player UI.
 */
export default function VideoPlayer({ src, resolveUrl, title, poster }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<HlsType | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [levels, setLevels] = useState<string[]>([]);
  const [level, setLevel] = useState(-1);
  const [speed, setSpeed] = useState(1);
  const [showUI, setShowUI] = useState(true);
  const [fs, setFs] = useState(false);

  const loadSource = useCallback(async (url: string) => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setLoading(true);
    hlsRef.current?.destroy();
    hlsRef.current = null;

    const isHls = /\.m3u8(\?|$)/i.test(url) || /\/live\//i.test(url);
    try {
      if (isHls) {
        const Hls = (await import("hls.js")).default;
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, maxBufferLength: 30 });
          hlsRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setLevels(["Auto", ...hls.levels.map((l) => (l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)}k`))]);
            setLevel(-1);
            void video.play().catch(() => {});
          });
          hls.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => setLevel(-1));
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal) {
              if (data.type === "networkError") setError("Network error — check your IPTV line connection.");
              else if (data.type === "mediaError") {
                hls.recoverMediaError();
              } else setError("Stream unavailable from provider.");
              setLoading(false);
              setPlaying(false);
            }
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          void video.play().catch(() => {});
        } else {
          setError("HLS not supported in this browser.");
          setLoading(false);
        }
      } else {
        video.src = url;
        void video.play().catch(() => {});
      }
    } catch {
      setError("Could not start playback.");
      setLoading(false);
    }
  }, []);

  const start = useCallback(async () => {
    setStarted(true);
    let url = src || null;
    if (!url && resolveUrl) {
      setLoading(true);
      url = await resolveUrl();
    }
    if (url) await loadSource(url);
    else setError("no_source");
  }, [src, resolveUrl, loadSource]);

  // Wire video events
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !started) return;
    const onTime = () => {
      setCur(v.currentTime);
      if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
    };
    const onMeta = () => setDur(v.duration);
    const onPlay = () => { setPlaying(true); setLoading(false); };
    const onPause = () => setPlaying(false);
    const onWait = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onErr = () => { setError("Playback error — the source may be offline."); setLoading(false); };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("waiting", onWait);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("error", onErr);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("waiting", onWait);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("error", onErr);
    };
  }, [started]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) { v.volume = vol; v.muted = muted; }
  }, [vol, muted]);

  useEffect(() => () => { hlsRef.current?.destroy(); }, []);

  // autohide controls
  const poke = useCallback(() => {
    setShowUI(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing && !videoRef.current?.paused) setShowUI(false);
    }, 3000);
  }, [playing]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }, []);

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (v && isFinite(v.duration)) v.currentTime = t;
  }, []);

  const toggleFs = useCallback(async () => {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen().catch(() => {});
      setFs(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setFs(false);
    }
  }, []);

  const onKey = useCallback((e: KeyboardEvent) => {
    const v = videoRef.current;
    if (!v || !started) return;
    if (e.key === " " || e.key === "k") { e.preventDefault(); togglePlay(); }
    else if (e.key === "ArrowRight") seek(v.currentTime + 10);
    else if (e.key === "ArrowLeft") seek(v.currentTime - 10);
    else if (e.key === "f") void toggleFs();
    else if (e.key === "m") setMuted((m) => !m);
    poke();
  }, [started, togglePlay, seek, toggleFs, poke]);

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const setQuality = (idx: number) => {
    const hls = hlsRef.current;
    if (hls) hls.currentLevel = idx - 1; // -1 = auto
    setLevel(idx);
  };

  const changeSpeed = (s: number) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
  };

  return (
    <div
      ref={wrapRef}
      className="group relative aspect-video w-full select-none overflow-hidden rounded-2xl border border-gold/25 bg-black"
      onMouseMove={poke}
      onMouseLeave={() => playing && setShowUI(false)}
      aria-label={`IQRAPRIME Player — ${title}`}
    >
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        className="h-full w-full bg-black"
        onDoubleClick={() => void toggleFs()}
        controls={false}
      />

      {/* branding */}
      {started && showUI && (
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-lg bg-ink/70 px-2.5 py-1.5 backdrop-blur">
          <span className="grid h-5 w-5 place-items-center rounded bg-gradient-to-br from-gold to-gold-deep text-[10px] font-black text-ink">I</span>
          <span className="text-[11px] font-bold tracking-wider text-gold">IQRAPRIME PLAYER</span>
        </div>
      )}

      {/* initial state */}
      {!started && !error && (
        <button onClick={() => void start()} className="absolute inset-0 flex items-center justify-center" aria-label={`Play ${title}`}>
          {poster && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/40 to-ink/30" />
          <span className="pulse-gold relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-gold to-gold-deep text-ink transition group-hover:scale-105">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
            </svg>
          </span>
          <span className="absolute bottom-5 text-sm font-semibold text-white/90">Play {title}</span>
        </button>
      )}

      {/* loading */}
      {started && loading && !error && (
        <div className="absolute inset-0 grid place-items-center" role="status" aria-live="polite">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
            <p className="text-xs text-mist">Connecting to stream…</p>
          </div>
        </div>
      )}

      {/* error / no source */}
      {started && error && (
        <div className="absolute inset-0 grid place-items-center bg-ink/90 p-6 text-center">
          <div className="max-w-md">
            <p className="font-display text-lg font-bold text-gold">
              {error === "no_source" ? "Stream not found on your line" : "Playback problem"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-mist">
              {error === "no_source"
                ? "This title isn't available on the connected IPTV line yet. Browse the IPTV Library for everything your line offers."
                : error === "no_line"
                  ? "Connect your IPTV line to unlock real playback."
                  : error}
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={() => { setError(null); setStarted(false); }}
                className="btn-ghost rounded-lg px-4 py-2 text-xs font-semibold"
              >
                Back
              </button>
              <button
                onClick={() => { setError(null); void start(); }}
                className="btn-gold rounded-lg px-4 py-2 text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* control bar */}
      {started && !error && (
        <div
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/95 via-ink/60 to-transparent px-4 pb-3 pt-10 transition-opacity duration-300 ${showUI ? "opacity-100" : "opacity-0"}`}
        >
          {/* seek bar */}
          <div className="relative h-1.5 w-full cursor-pointer rounded-full bg-white/20" onClick={(e) => {
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            seek(((e.clientX - rect.left) / rect.width) * dur);
          }} role="slider" aria-label="Seek" aria-valuenow={Math.round(cur)} aria-valuemax={Math.round(dur) || 0}>
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/25" style={{ width: dur ? `${(buffered / dur) * 100}%` : "0%" }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-gold to-gold-deep" style={{ width: dur ? `${(cur / dur) * 100}%` : "0%" }}>
              <span className="absolute -right-1.5 -top-1 h-3.5 w-3.5 rounded-full bg-gold shadow" />
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-3">
            <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="text-white hover:text-gold transition">
              {playing ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4h4v16H7zM13 4h4v16h-4z" /></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" /></svg>
              )}
            </button>

            <span className="text-[11px] tabular-nums text-white/85">
              {fmt(cur)} <span className="text-white/40">/ {fmt(dur)}</span>
            </span>

            <div className="flex items-center gap-1.5">
              <button onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} className="text-white/85 hover:text-gold">
                {muted || vol === 0 ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M3.6 3.6 20.4 20.4l-1.4 1.4-3.7-3.7H13v-2.3l-2-2V18l-5-4H3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3l4.3-3.4c.4-.3 1-.3 1.4 0l1.5 1.2L5 2.2l1.4-1.4Zm10.4 6.8a5 5 0 0 1 0 3.3l1.6 1.6A7 7 0 0 0 16 8.4l-2 2Z" /></svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 4V5L7 9H3Zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4ZM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z" /></svg>
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : vol}
                onChange={(e) => { setVol(Number(e.target.value)); setMuted(false); }}
                aria-label="Volume"
                className="h-1 w-16 accent-[#FFBD24]"
              />
            </div>

            <div className="ml-auto flex items-center gap-2.5">
              {levels.length > 1 && (
                <select
                  value={level}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  aria-label="Quality"
                  className="rounded-md border border-white/20 bg-ink/80 px-1.5 py-1 text-[11px] text-white outline-none"
                >
                  {levels.map((l, i) => (
                    <option key={i} value={i}>{l}</option>
                  ))}
                </select>
              )}
              <select
                value={speed}
                onChange={(e) => changeSpeed(Number(e.target.value))}
                aria-label="Playback speed"
                className="rounded-md border border-white/20 bg-ink/80 px-1.5 py-1 text-[11px] text-white outline-none"
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                  <option key={s} value={s}>{s}x</option>
                ))}
              </select>
              <button
                onClick={() => void videoRef.current?.requestPictureInPicture?.().catch(() => {})}
                aria-label="Picture in picture"
                className="text-white/85 hover:text-gold"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" /><rect x="12" y="11" width="7" height="6" rx="1" fill="currentColor" /></svg>
              </button>
              <button onClick={() => void toggleFs()} aria-label="Fullscreen" className="text-white/85 hover:text-gold">
                {fs ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M9 4v5H4m16 0h-5V4m0 16v-5h5M4 15h5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 9V4h5m6 0h5v5m0 6v5h-5M9 20H4v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
