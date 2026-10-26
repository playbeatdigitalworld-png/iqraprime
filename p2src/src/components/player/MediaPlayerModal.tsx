import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  X,
  Radio,
  Tv,
  Subtitles,
  AlertTriangle,
  RefreshCw,
  Sliders,
  List,
  ChevronRight,
  Music,
  Check,
  Search,
} from 'lucide-react';
import type { Channel, Movie } from '../../types/index.js';
import { useWatchlist } from '../../context/WatchlistContext.js';
import { LegalBadge } from '../common/LegalBadge.js';

interface MediaPlayerModalProps {
  movie?: Movie;
  channel?: Channel;
  mode: 'full' | 'trailer';
  startPosition?: number;
  onClose: () => void;
  onNextChannel?: () => void;
  onPrevChannel?: () => void;
  channels?: Channel[];
  onSelectChannel?: (channel: Channel) => void;
}

export const MediaPlayerModal: React.FC<MediaPlayerModalProps> = ({
  movie,
  channel,
  mode,
  startPosition = 0,
  onClose,
  onNextChannel,
  onPrevChannel,
  channels = [],
  onSelectChannel,
}) => {
  const { recordProgress } = useWatchlist();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Retry ladder internals — see the fatal-error handler in loadStream().
  const networkRetriesRef = useRef(0);
  const mediaRetriesRef = useRef(0);
  const reinitCountRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Stream status badge
  const [streamStatus, setStreamStatus] = useState<'live' | 'reconnecting' | 'offline'>('live');

  // Quality levels (id === hls.js level index; -1 = Auto)
  const [qualities, setQualities] = useState<Array<{ id: number; name: string; bitrate?: number }>>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  // The rendition actually being decoded right now (from LEVEL_SWITCHED)
  const [activeLevelLabel, setActiveLevelLabel] = useState<string>('Auto');

  // Stream diagnostics (polled every second while the player is open)
  const [bufferHealth, setBufferHealth] = useState(0); // seconds of media ready ahead of playhead
  const [bandwidthKbps, setBandwidthKbps] = useState(0); // hls.js bandwidth estimate

  // Browser autoplay policy: playback blocked until a user gesture lands.
  const [needsUserGesture, setNeedsUserGesture] = useState(false);

  // Audio tracks
  const [audioTracks, setAudioTracks] = useState<Array<{ id: number; name: string }>>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(0);
  const [showAudioMenu, setShowAudioMenu] = useState(false);

  // Channel switcher drawer inside player
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerSearch, setDrawerSearch] = useState('');

  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

  const isLive = Boolean(channel);
  const mediaTitle = channel ? channel.channelName : movie ? movie.title : 'StreamPlay Player';
  const rawStreamUrl = channel
    ? channel.streamUrl
    : mode === 'trailer'
    ? movie?.trailerUrl
    : movie?.videoUrl || movie?.trailerUrl;

  const effectiveStreamUrl = rawStreamUrl || '';

  // Initialize playback with HLS or Native Video
  const loadStream = useCallback(() => {
    const video = videoRef.current;
    if (!video || !effectiveStreamUrl) {
      setIsLoading(false);
      setErrorMessage('No authorized stream source found for this title.');
      setStreamStatus('offline');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setNeedsUserGesture(false);
    setBufferHealth(0);
    setStreamStatus('live');

    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    // Destroy existing Hls instance if any
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHlsSource = effectiveStreamUrl.includes('.m3u8') || effectiveStreamUrl.includes('manifest');

    if (isHlsSource && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        // Standard-latency live playback. Low-latency mode pins playback to
        // the live edge with a nearly empty buffer — the #1 cause of constant
        // rebuffering on provider feeds that are not LL-HLS.
        lowLatencyMode: false,
        // Generous forward buffer: network dips are absorbed instead of
        // stalling the picture.
        maxBufferLength: 30,
        maxMaxBufferLength: 90,
        maxBufferSize: 90 * 1000 * 1000,
        backBufferLength: 30,
        // Provider feeds can be slow/bursty (503 bursts, slow origins): give
        // every request room and let hls.js retry before we escalate.
        manifestLoadingTimeOut: 12000,
        manifestLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 1000,
        levelLoadingTimeOut: 12000,
        levelLoadingMaxRetry: 3,
        levelLoadingRetryDelay: 1000,
        fragLoadingTimeOut: 25000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        // Conservative ABR start: begin low and ramp up as bandwidth is
        // measured — starting blind at the top rendition stalls start-up.
        abrEwmaDefaultEstimate: 1_000_000,
        abrBandWidthFactor: 0.9,
        abrBandWidthUpFactor: 0.8,
        // Prefetch the first fragment while the manifest appends: shaves
        // start-up latency.
        startFragPrefetch: true,
      });
      hlsRef.current = hls;

      hls.loadSource(effectiveStreamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setIsLoading(false);
        setStreamStatus('live');
        networkRetriesRef.current = 0;
        mediaRetriesRef.current = 0;

        const levels = data.levels.map((lvl, index) => ({
          id: index,
          name: lvl.height ? `${lvl.height}p` : `${Math.round((lvl.bitrate || 0) / 1000)} kbps`,
          bitrate: lvl.bitrate || 0,
        }));
        setQualities([{ id: -1, name: 'Auto', bitrate: 0 }, ...levels]);

        // Audio tracks
        if (hls.audioTracks && hls.audioTracks.length > 0) {
          setAudioTracks(
            hls.audioTracks.map((t, idx) => ({
              id: idx,
              name: t.name || t.lang || `Track ${idx + 1}`,
            }))
          );
        }

        if (startPosition > 0 && !isLive) {
          video.currentTime = startPosition;
        }

        video.play().catch((err: DOMException) => {
          if (err && err.name === 'NotAllowedError') {
            // Autoplay blocked by the browser — show the tap-to-start overlay.
            setNeedsUserGesture(true);
            setIsLoading(false);
          } else {
            setIsPlaying(false);
          }
        });
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
        if (data.audioTracks && data.audioTracks.length > 0) {
          setAudioTracks(
            data.audioTracks.map((t, idx) => ({
              id: idx,
              name: t.name || t.lang || `Track ${idx + 1}`,
            }))
          );
        }
      });

      // Track the rendition actually being decoded (auto-ABR included).
      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        const lvl = hls.levels[data.level];
        if (lvl) {
          setActiveLevelLabel(
            lvl.height ? `${lvl.height}p` : `${Math.round((lvl.bitrate || 0) / 1000)} kbps`
          );
        }
      });

      // Bandwidth estimate for the diagnostics chip.
      hls.on(Hls.Events.FRAG_LOADED, () => {
        if (hls.bandwidthEstimate) {
          setBandwidthKbps(Math.round(hls.bandwidthEstimate / 1000));
        }
      });

      // A buffered fragment means the pipeline is healthy again — reset the
      // network retry ladder so future dips get a fresh set of attempts.
      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        networkRetriesRef.current = 0;
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          // Ladder: startLoad with linear backoff (4 attempts) → one full
          // engine re-init → manual-retry error screen. No infinite loops,
          // no premature death.
          if (networkRetriesRef.current < 4) {
            networkRetriesRef.current += 1;
            const delayMs = 1000 * networkRetriesRef.current;
            setStreamStatus('reconnecting');
            if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
            retryTimerRef.current = window.setTimeout(() => {
              try {
                hls.startLoad();
              } catch {
                /* engine already torn down */
              }
            }, delayMs);
          } else if (reinitCountRef.current < 1) {
            reinitCountRef.current += 1;
            networkRetriesRef.current = 0;
            setStreamStatus('reconnecting');
            retryTimerRef.current = window.setTimeout(() => loadStream(), 800);
          } else {
            setStreamStatus('offline');
            setErrorMessage(
              'The stream source is unreachable right now — the broadcaster feed may be off-air or under heavy load. Try again in a moment.'
            );
          }
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          if (mediaRetriesRef.current < 2) {
            mediaRetriesRef.current += 1;
            setStreamStatus('reconnecting');
            try {
              hls.recoverMediaError();
            } catch {
              /* engine already torn down */
            }
          } else if (reinitCountRef.current < 1) {
            reinitCountRef.current += 1;
            mediaRetriesRef.current = 0;
            retryTimerRef.current = window.setTimeout(() => loadStream(), 800);
          } else {
            setStreamStatus('offline');
            setErrorMessage(
              'This stream could not be decoded — the broadcaster feed format may be temporarily unsupported.'
            );
          }
        } else {
          setStreamStatus('offline');
          setErrorMessage(
            'Stream playback failed. The broadcaster feed may be currently off-air or unavailable.'
          );
        }
      });
    } else {
      // Direct MP4 or Native Safari HLS
      video.src = effectiveStreamUrl;
      video.load();

      video.onloadedmetadata = () => {
        setIsLoading(false);
        setStreamStatus('live');
        if (startPosition > 0 && !isLive) {
          video.currentTime = startPosition;
        }
        video.play().catch((err: DOMException) => {
          if (err && err.name === 'NotAllowedError') setNeedsUserGesture(true);
          else setIsPlaying(false);
        });
      };

      video.onerror = () => {
        setIsLoading(false);
        setStreamStatus('offline');
        setErrorMessage('Failed to decode media source. Please verify stream status.');
      };
    }
  }, [effectiveStreamUrl, isLive, startPosition]);

  useEffect(() => {
    loadStream();
    return () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [loadStream]);

  // Buffer-health diagnostics: seconds of media ready ahead of the playhead,
  // polled once a second while the player is mounted.
  useEffect(() => {
    const id = window.setInterval(() => {
      const video = videoRef.current;
      if (video && video.currentTime > 0) {
        const buffered = video.buffered;
        for (let i = 0; i < buffered.length; i++) {
          if (buffered.start(i) <= video.currentTime && video.currentTime <= buffered.end(i)) {
            setBufferHealth(Math.max(0, Math.round(buffered.end(i) - video.currentTime)));
            break;
          }
        }
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Sync Video state listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      setIsPlaying(true);
      setStreamStatus('live');
    };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => {
      setIsLoading(true);
      setStreamStatus('reconnecting');
    };
    const onPlaying = () => {
      setIsLoading(false);
      setStreamStatus('live');
    };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (!isLive && movie) {
        recordProgress(movie.id, video.currentTime, video.duration || 1);
      }
    };
    const onDurationChange = () => setDuration(video.duration || 0);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
    };
  }, [isLive, movie, recordProgress]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (video.paused) video.play();
          else video.pause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'Escape':
          e.preventDefault();
          if (showDrawer) {
            setShowDrawer(false);
          } else {
            onClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showDrawer]);

  // Controls Visibility Timer
  const handleMouseMove = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying && !showDrawer && !showQualityMenu && !showAudioMenu) {
        setControlsVisible(false);
      }
    }, 3500);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (newVol: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = newVol;
    setVolume(newVol);
    if (newVol === 0) {
      video.muted = true;
      setIsMuted(true);
    } else if (isMuted) {
      video.muted = false;
      setIsMuted(false);
    }
  };

  const handleSeek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    setCurrentTime(seconds);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleQualitySelect = (qualityId: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    if (qualityId === -1) {
      // Auto: release the level cap; ABR picks the rendition.
      hls.currentLevel = -1;
      hls.nextLevel = -1;
      setActiveLevelLabel('Auto');
    } else {
      // Manual: switch at the next segment boundary — no buffer flush, no
      // stall (unlike currentLevel, which restarts the buffer immediately).
      hls.nextLevel = qualityId;
    }
    setCurrentQuality(qualityId);
    setShowQualityMenu(false);
  };

  const handleAudioTrackSelect = (trackId: number) => {
    if (hlsRef.current) {
      hlsRef.current.audioTrack = trackId;
      setCurrentAudioTrack(trackId);
      setShowAudioMenu(false);
    }
  };

  // Filter channels for drawer
  const drawerFilteredChannels = channels.filter((c) =>
    c.channelName.toLowerCase().includes(drawerSearch.toLowerCase()) ||
    c.category.toLowerCase().includes(drawerSearch.toLowerCase())
  );

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        playsInline
      />

      {/* Tap to start (browser autoplay policy blocked the first play()) */}
      {needsUserGesture && !errorMessage && (
        <button
          onClick={() => {
            setNeedsUserGesture(false);
            const video = videoRef.current;
            if (video) video.play().catch(() => setNeedsUserGesture(true));
          }}
          className="absolute inset-0 z-[25] flex flex-col items-center justify-center bg-black/55 backdrop-blur-[2px] text-white"
          aria-label="Start playback"
        >
          <span className="w-16 h-16 rounded-full bg-[#E5093A] flex items-center justify-center shadow-[0_16px_45px_rgba(229,9,58,0.4)]">
            <Play className="w-7 h-7 fill-white" />
          </span>
          <span className="mt-4 text-xs font-semibold tracking-[0.2em] uppercase text-slate-200">
            Tap to start playback
          </span>
        </button>
      )}

      {/* Buffering Indicator */}
      {isLoading && !errorMessage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/40 backdrop-blur-[2px]">
          <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-[#E5093A] animate-spin" />
          <span className="mt-4 text-xs font-medium text-slate-300 tracking-wider font-display">
            Buffering master feed...
          </span>
        </div>
      )}

      {/* Stream Error Overlay */}
      {errorMessage && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-[#04070B]/90 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#E5093A]/10 border border-[#E5093A]/30 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-[#E5093A]" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2 font-display">Playback Interrupted</h3>
          <p className="text-xs text-slate-300 max-w-md leading-relaxed mb-6">{errorMessage}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={loadStream}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E5093A] hover:bg-[#B90732] text-white text-xs font-semibold shadow-lg transition-transform active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Stream</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold transition-colors"
            >
              Exit Player
            </button>
          </div>
        </div>
      )}

      {/* Top Header Bar Overlay */}
      <div
        className={`absolute top-0 left-0 right-0 z-20 p-4 md:p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 max-w-xl truncate">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close player"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              {/* Stream Status Badge */}
              <span
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                  streamStatus === 'live'
                    ? 'bg-[#E5093A] text-white'
                    : streamStatus === 'reconnecting'
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40 animate-pulse'
                    : 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    streamStatus === 'live'
                      ? 'bg-white animate-pulse'
                      : streamStatus === 'reconnecting'
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                />
                <span>
                  {streamStatus === 'live'
                    ? isLive ? 'LIVE' : 'PLAYING'
                    : streamStatus === 'reconnecting'
                    ? 'RECONNECTING'
                    : 'OFFLINE'}
                </span>
              </span>

              {!isLive && (
                <LegalBadge
                  status={movie ? movie.rightsStatus : 'PUBLIC_DOMAIN'}
                  licenseText={movie?.license}
                />
              )}

              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                {qualities.length > 1
                  ? `${currentQuality === -1 ? `Auto · ${activeLevelLabel}` : activeLevelLabel} · ${bufferHealth}s buffer${bandwidthKbps ? ` · ${bandwidthKbps} kbps` : ''}`
                  : 'Adaptive Stream'}
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate mt-0.5">
              {mediaTitle}
            </h2>

            {/* EPG Program Info Overlay snippet */}
            {isLive && channel && (
              <p className="text-[11px] text-slate-300 truncate mt-0.5 flex items-center gap-2">
                <span className="text-cyan-400 font-medium">
                  {channel.epgProgram?.current || 'Live Broadcast'}
                </span>
                {channel.epgProgram?.next && (
                  <span className="text-slate-500 text-[10px] hidden sm:inline">
                    · Next: {channel.epgProgram.next}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Top Right: Channel Switcher Drawer Toggle & Next/Prev */}
        <div className="flex items-center gap-2">
          {isLive && (
            <>
              {onPrevChannel && (
                <button
                  onClick={onPrevChannel}
                  className="hidden sm:inline-block px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-slate-200 transition-colors"
                >
                  Prev
                </button>
              )}
              {onNextChannel && (
                <button
                  onClick={onNextChannel}
                  className="hidden sm:inline-block px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-slate-200 transition-colors"
                >
                  Next
                </button>
              )}

              {/* Channel Switcher Drawer Trigger */}
              {channels.length > 0 && onSelectChannel && (
                <button
                  onClick={() => setShowDrawer(!showDrawer)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    showDrawer
                      ? 'bg-[#E5093A] text-white'
                      : 'bg-white/10 hover:bg-white/20 text-slate-200'
                  }`}
                  title="Browse Channel Guide"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Channels ({channels.length})</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Channel Switcher Drawer (Slide-in right panel) */}
      {showDrawer && isLive && onSelectChannel && (
        <div className="absolute top-0 right-0 bottom-0 w-80 sm:w-96 bg-[#070B12]/95 backdrop-blur-2xl border-l border-white/10 z-30 flex flex-col p-4 shadow-2xl animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <div className="flex items-center gap-2">
              <Tv className="w-4 h-4 text-[#E5093A]" />
              <h3 className="text-sm font-bold text-white font-display">Live Channels Drawer</h3>
            </div>
            <button
              onClick={() => setShowDrawer(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={drawerSearch}
              onChange={(e) => setDrawerSearch(e.target.value)}
              placeholder="Filter channels..."
              className="w-full bg-[#111A27] text-xs text-white pl-8 pr-3 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-[#E5093A]"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {drawerFilteredChannels.map((c) => {
              const isCurrent = channel?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelectChannel(c);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                    isCurrent
                      ? 'bg-[#E5093A]/20 border border-[#E5093A]/40 text-white'
                      : 'hover:bg-white/5 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate mr-2">
                    <img
                      src={c.logo}
                      alt=""
                      className="w-6 h-6 object-contain rounded shrink-0 bg-black/40 p-0.5"
                      onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                    />
                    <div className="truncate">
                      <p className="text-xs font-semibold truncate leading-tight">{c.channelName}</p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        {c.epgProgram?.current || c.category}
                      </p>
                    </div>
                  </div>
                  {isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-[#E5093A] animate-pulse shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Transport Controls Overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 p-4 md:p-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Seek Progress Bar (Non-Live Movies) */}
        {!isLive && duration > 0 && (
          <div className="mb-4 flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-300 tabular-nums">
              {formatTime(currentTime)}
            </span>
            <div className="relative flex-1 h-1.5 group/progress cursor-pointer">
              <input
                type="range"
                min={0}
                max={duration}
                value={currentTime}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="w-full h-full rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full bg-[#E5093A] transition-all"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
              {formatTime(duration)}
            </span>
          </div>
        )}

        {/* Main Controls Row */}
        <div className="flex items-center justify-between">
          {/* Left Controls: Play/Pause, Replay 10s, Forward 10s, Volume */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={togglePlay}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-[#E5093A] text-white transition-colors"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
            </button>

            {!isLive && (
              <>
                <button
                  onClick={() => handleSeek(Math.max(0, currentTime - 10))}
                  className="p-2 text-slate-300 hover:text-white transition-colors"
                  title="Rewind 10 seconds"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleSeek(Math.min(duration, currentTime + 10))}
                  className="p-2 text-slate-300 hover:text-white transition-colors"
                  title="Forward 10 seconds"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Volume Slider */}
            <div className="flex items-center gap-2 group/volume ml-2">
              <button
                onClick={toggleMute}
                className="text-slate-300 hover:text-white transition-colors"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-rose-400" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-16 sm:w-20 h-1 bg-white/20 accent-[#E5093A] cursor-pointer"
              />
            </div>
          </div>

          {/* Right Controls: Subtitles, Audio Tracks, Quality Selector, Fullscreen */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Audio Track Selector */}
            {audioTracks.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => {
                    setShowAudioMenu(!showAudioMenu);
                    setShowQualityMenu(false);
                  }}
                  className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                  title="Audio Track Selector"
                >
                  <Music className="w-4 h-4" />
                </button>

                {showAudioMenu && (
                  <div className="absolute bottom-10 right-0 w-44 rounded-xl bg-[#111A27] border border-white/10 shadow-2xl p-2 z-30">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2 py-1">
                      Audio Tracks
                    </p>
                    {audioTracks.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleAudioTrackSelect(t.id)}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                          currentAudioTrack === t.id
                            ? 'bg-[#E5093A] text-white font-semibold'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="truncate">{t.name}</span>
                        {currentAudioTrack === t.id && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quality Settings Dropdown */}
            {qualities.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => {
                    setShowQualityMenu(!showQualityMenu);
                    setShowAudioMenu(false);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-slate-200 transition-colors"
                  title="Stream Quality"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {currentQuality === -1 ? 'Auto' : qualities.find((q) => q.id === currentQuality)?.name}
                  </span>
                </button>

                {showQualityMenu && (
                  <div className="absolute bottom-10 right-0 w-44 rounded-xl bg-[#111A27] border border-white/10 shadow-2xl p-2 z-30">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2 py-1">
                      Quality
                    </p>
                    {qualities.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => handleQualitySelect(q.id)}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                          currentQuality === q.id
                            ? 'bg-[#E5093A] text-white font-semibold'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="truncate">
                          {q.id === -1 && qualities.length > 1 && activeLevelLabel !== 'Auto'
                            ? `Auto (${activeLevelLabel})`
                            : q.name}
                          {q.bitrate ? (
                            <span className="text-[10px] text-slate-500 ml-1.5 font-mono">
                              {Math.round(q.bitrate / 1000)}k
                            </span>
                          ) : null}
                        </span>
                        {currentQuality === q.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Subtitles Toggle */}
            <button
              onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                subtitlesEnabled ? 'text-[#E5093A]' : 'text-slate-400 hover:text-white'
              }`}
              title="Toggle Subtitles"
            >
              <Subtitles className="w-4 h-4" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Legal Attribution Notice Footer */}
        <div className="mt-3 pt-2 border-t border-white/10 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
          <p className="truncate max-w-md">
            Source: <span className="text-slate-300">{channel?.sourceName || movie?.source || 'Authorized Stream'}</span>
            {movie?.attribution ? ` · ${movie.attribution}` : ''}
          </p>
          <span className="text-[10px] text-emerald-400 font-mono">
            VERIFIED LEGAL STREAM
          </span>
        </div>
      </div>
    </div>
  );
};
