"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type HlsType from "hls.js";

interface Level {
  index: number;
  height: number;
  bitrate: number;
}

interface Props {
  src: string | null;
  title: string;
  poster?: string;
  autoPlay?: boolean;
  onBack?: () => void;
  badge?: string;
}

function formatTime(s: number): string {
  if (!isFinite(s)) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function detectType(src: string): "hls" | "dash-less" | "file" {
  const clean = src.split("?")[0].toLowerCase();
  if (clean.endsWith(".m3u8")) return "hls";
  return "file";
}

/**
 * IQRAPRIME native player — 100% custom-built UI on the HTML5 video engine.
 * HLS (m3u8) via hls.js with manual quality switching; progressive files (mp4/mkv/webm) natively.
 * No third-party player UI or embeds.
 */
export default function PrimePlayer({ src, title, poster, autoPlay = true, onBack, badge }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<HlsType | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [menu, setMenu] = useState<"none" | "quality" | "speed">("none");

  // Load source
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setError(null);
    setLoading(true);
    let cancelled = false;

    (async () => {
      const kind = detectType(src);
      if (kind === "hls") {
        const Hls = (await import("hls.js")).default;
        if (cancelled) return;
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, maxBufferLength: 30 });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (cancelled) return;
            const ls = hls.levels.map((l, i) => ({
              index: i,
              height: l.height || 0,
              bitrate: l.bitrate,
            }));
            setLevels(ls);
            setLoading(false);
            if (autoPlay) void video.play().catch(() => {});
          });
          hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setCurrentLevel(data.level));
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal) {
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
              else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
              else setError("Stream could not be loaded. The source may be offline.");
            }
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src; // Safari native HLS
          setLoading(false);
          if (autoPlay) void video.play().catch(() => {});
        } else {
          setError("HLS is not supported in this browser.");
        }
      } else {
        video.src = src;
        setLoading(false);
        if (autoPlay) void video.play().catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
  }, [src, autoPlay]);

  // Media events
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      setTime(v.currentTime);
      if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
    };
    const onMeta = () => setDuration(v.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWait = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onErr = () =>
      setError("Playback failed. The source may be unavailable or unsupported.");
    const onEnded = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("durationchange", onMeta);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("waiting", onWait);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("error", onErr);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("durationchange", onMeta);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("waiting", onWait);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("error", onErr);
      v.removeEventListener("ended", onEnded);
    };
  }, [src]);

  // Fullscreen tracking
  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }, []);

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v || !isFinite(t)) return;
    v.currentTime = Math.max(0, Math.min(t, v.duration || t));
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const changeVolume = useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
  }, []);

  const setQuality = useCallback((idx: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = idx;
    setCurrentLevel(idx);
    setMenu("none");
  }, []);

  const changeRate = useCallback((r: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = r;
    setRate(r);
    setMenu("none");
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current;
    if (!shell) return;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    else await shell.requestFullscreen().catch(() => {});
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          seek((videoRef.current?.currentTime ?? 0) + 10);
          break;
        case "ArrowLeft":
          seek((videoRef.current?.currentTime ?? 0) - 10);
          break;
        case "ArrowUp":
          changeVolume(Math.min(1, (videoRef.current?.volume ?? 1) + 0.1));
          break;
        case "ArrowDown":
          changeVolume(Math.max(0, (videoRef.current?.volume ?? 0) - 0.1));
          break;
        case "m":
          toggleMute();
          break;
        case "f":
          void toggleFullscreen();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seek, changeVolume, toggleMute, toggleFullscreen]);

  // Auto-hide controls
  const bumpControls = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing && menu === "none") setShowControls(false);
    }, 2800);
  }, [playing, menu]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    []
  );

  const progressPct = duration ? (time / duration) * 100 : 0;
  const bufferPct = duration ? (buffered / duration) * 100 : 0;

  if (!src) {
    return (
      <div className="relative aspect-video w-full rounded-2xl border border-gold/25 bg-navy grid place-items-center p-6 text-center">
        <div>
          <p className="font-display text-lg font-bold text-white">{title}</p>
          <p className="mt-2 text-sm text-mist max-w-md">
            No playback source is linked to this title yet. Connect your streaming line
            (IPTV/HLS) in the server environment and every title gets its real stream
            automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={shellRef}
      className="group relative aspect-video w-full select-none overflow-hidden rounded-2xl border border-gold/25 bg-black"
      onMouseMove={bumpControls}
      onMouseLeave={() => playing && setShowControls(false)}
      role="region"
      aria-label={`Video player — ${title}`}
    >
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        className="h-full w-full bg-black"
        onClick={togglePlay}
        onDoubleClick={() => void toggleFullscreen()}
      />

      {/* Top gradient + title */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent px-4 pb-8 pt-3 transition-opacity ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white hover:bg-gold hover:text-ink transition"
              aria-label="Back"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 19 8 12l7-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <p className="truncate text-sm font-semibold text-white/95">{title}</p>
          {badge && (
            <span className="rounded-md bg-gold/90 px-2 py-0.5 text-[10px] font-bold tracking-wide text-ink">
              {badge}
            </span>
          )}
        </div>
      </div>

      {/* Center play overlay */}
      {!playing && !loading && !error && (
        <button
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 grid place-items-center"
        >
          <span className="pulse-gold grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-gold to-gold-deep text-ink shadow-2xl">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
            </svg>
          </span>
        </button>
      )}

      {loading && (
        <div className="absolute inset-0 grid place-items-center bg-black/40" role="status">
          <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-gold/30 border-t-gold" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/85 p-6 text-center">
          <div>
            <p className="text-sm font-bold text-gold">Playback error</p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-mist">{error}</p>
            <button
              onClick={() => {
                setError(null);
                const v = videoRef.current;
                if (v) {
                  v.load();
                  void v.play().catch(() => {});
                }
              }}
              className="btn-gold mt-4 rounded-lg px-4 py-2 text-xs"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-3 pt-10 transition-opacity ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Seek bar */}
        <div className="relative mb-2 h-4">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white/25" style={{ width: `${bufferPct}%` }} />
          </div>
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-gold-deep to-gold"
            style={{ width: `${progressPct}%` }}
          />
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-gold shadow-[0_0_10px_rgba(255,189,36,0.7)]"
            style={{ left: `${progressPct}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={time}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>

        <div className="flex items-center gap-2">
          <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="grid h-9 w-9 place-items-center rounded-full text-white hover:text-gold transition">
            {playing ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7 5a1 1 0 0 1 2 0v14a1 1 0 0 1-2 0Zm8 0a1 1 0 0 1 2 0v14a1 1 0 0 1-2 0Z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
              </svg>
            )}
          </button>

          <button onClick={() => seek(time - 10)} aria-label="Rewind 10 seconds" className="grid h-9 w-9 place-items-center rounded-full text-white hover:text-gold transition">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M11 8H5V2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.5 8a9 9 0 1 1-.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <span className="min-w-[86px] text-center text-xs font-medium tabular-nums text-white/90">
            {formatTime(time)} / {formatTime(duration)}
          </span>

          <div className="ml-1 flex items-center gap-1.5">
            <button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="grid h-9 w-9 place-items-center rounded-full text-white hover:text-gold transition">
              {muted || volume === 0 ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M11 5 6 9H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="m22 9-6 6m0-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M11 5 6 9H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Volume"
              className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/25 accent-[#FFBD24]"
            />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Quality menu */}
            {levels.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setMenu(menu === "quality" ? "none" : "quality")}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white hover:text-gold transition"
                  aria-label="Quality settings"
                  aria-expanded={menu === "quality"}
                >
                  {currentLevel === -1
                    ? "AUTO"
                    : levels[currentLevel]?.height
                      ? `${levels[currentLevel].height}p`
                      : "HQ"}
                </button>
                {menu === "quality" && (
                  <div className="absolute bottom-10 right-0 w-36 overflow-hidden rounded-xl border border-gold/30 bg-ink/95 backdrop-blur shadow-2xl">
                    <button
                      onClick={() => setQuality(-1)}
                      className={`block w-full px-3 py-2 text-left text-xs ${currentLevel === -1 ? "text-gold" : "text-white hover:bg-white/10"}`}
                    >
                      Auto
                    </button>
                    {[...levels].reverse().map((l) => (
                      <button
                        key={l.index}
                        onClick={() => setQuality(l.index)}
                        className={`block w-full px-3 py-2 text-left text-xs ${currentLevel === l.index ? "text-gold" : "text-white hover:bg-white/10"}`}
                      >
                        {l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)} kbps`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Speed menu */}
            <div className="relative">
              <button
                onClick={() => setMenu(menu === "speed" ? "none" : "speed")}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white hover:text-gold transition"
                aria-label="Playback speed"
                aria-expanded={menu === "speed"}
              >
                {rate}×
              </button>
              {menu === "speed" && (
                <div className="absolute bottom-10 right-0 w-24 overflow-hidden rounded-xl border border-gold/30 bg-ink/95 backdrop-blur shadow-2xl">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                    <button
                      key={r}
                      onClick={() => changeRate(r)}
                      className={`block w-full px-3 py-2 text-left text-xs ${rate === r ? "text-gold" : "text-white hover:bg-white/10"}`}
                    >
                      {r}×
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => void toggleFullscreen()}
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="grid h-9 w-9 place-items-center rounded-full text-white hover:text-gold transition"
            >
              {fullscreen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 3H3v6M15 3h6v6M9 21H3v-6m12 6h6v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 9V3h6M15 3h6v6m0 6v6h-6M9 21H3v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
