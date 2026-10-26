import React, { useState, useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { Channel } from '../../types/playbeat';
import { 
  X, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Tv, 
  SkipBack, 
  SkipForward, 
  List, 
  Settings, 
  Heart, 
  Info, 
  Copy, 
  Check, 
  Zap, 
  Globe, 
  Activity, 
  Search, 
  RotateCcw,
  Gauge
} from 'lucide-react';
import { ChannelLogo } from '../common/ChannelLogo';

interface VideoPlayerModalProps {
  channel: Channel | null;
  allChannels: Channel[];
  isOpen: boolean;
  onClose: () => void;
  onSelectChannel: (channel: Channel) => void;
  isFavorite: boolean;
  onToggleFavorite: (channelId: string) => void;
}

type StreamMode = 'cloudflare-hls' | 'direct-video';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  channel,
  allChannels,
  isOpen,
  onClose,
  onSelectChannel,
  isFavorite,
  onToggleFavorite
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryCountRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('Auto 1080p');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [streamMode, setStreamMode] = useState<StreamMode>('cloudflare-hls');
  
  // VOD / Seeking state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  // UI overlays
  const [showChannelDrawer, setShowChannelDrawer] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showEpgInfo, setShowEpgInfo] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [copiedLinkType, setCopiedLinkType] = useState<'hls' | 'ts' | null>(null);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  
  // Cloudflare Metrics
  const [bufferSeconds, setBufferSeconds] = useState(0);
  const [bandwidthKbps, setBandwidthKbps] = useState(0);
  const [currentStreamSource, setCurrentStreamSource] = useState('');
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const isVodMedia = channel ? (
    (channel.isLive === false || 
     channel.category === 'Movies' || 
     channel.id.startsWith('movie_') || 
     channel.id.startsWith('ep_')) &&
    !channel.streamUrl?.includes('.m3u8')
  ) : false;

  const destroyHls = () => {
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch (e) {
        console.warn('[HLS] cleanup error:', e);
      }
      hlsRef.current = null;
    }
  };

  // Main playback engine initializer
  useEffect(() => {
    if (!isOpen || !channel) {
      destroyHls();
      return;
    }

    const videoEl = videoRef.current;
    if (!videoEl) return;

    destroyHls();
    setIsBuffering(true);
    setNeedsUserGesture(false);
    setPlaybackError(null);
    setBandwidthKbps(0);
    retryCountRef.current = 0;

    const streamId = channel.streamId || (channel.id.replace('geo_', '').replace('geo_live_', ''));
    const isVod = isVodMedia;

    // Pick appropriate starting stream mode based on media type
    if (isVod) {
      // VOD MOVIE OR SERIES EPISODE: Direct high-speed HTML5 video playback
      setStreamMode('direct-video');
      const directUrl = channel.streamUrl;
      if (!directUrl) {
        setPlaybackError('No authorized stream is available for this title.');
        setIsBuffering(false);
        return;
      }
      setCurrentStreamSource(directUrl);
      videoEl.src = directUrl;
      videoEl.load();

      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsBuffering(false);
          })
          .catch((err) => {
            console.warn('[VOD Autoplay]', err.message);
            // If autoplay is blocked by browser policy, prompt user or mute
            if (err.name === 'NotAllowedError') {
              setNeedsUserGesture(true);
            }
            setIsPlaying(false);
            setIsBuffering(false);
          });
      }
    } else {
      // LIVE BROADCAST CHANNEL: HLS adaptive or direct TS
      setStreamMode('cloudflare-hls');
      const hlsUrl = channel.hlsUrl || (channel.streamUrl?.includes('.m3u8') ? channel.streamUrl : `/broadcast/api/iptv/hls/stream.m3u8?channelId=${streamId}`);
      setCurrentStreamSource(hlsUrl);

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 45,
          maxBufferLength: 20,
          maxMaxBufferLength: 40,
          manifestLoadingTimeOut: 6000,
          manifestLoadingMaxRetry: 2,
          levelLoadingTimeOut: 5000,
          fragLoadingTimeOut: 10000,
          fragLoadingMaxRetry: 3,
        });
        hlsRef.current = hls;

        hls.loadSource(hlsUrl);
        hls.attachMedia(videoEl);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsBuffering(false);
          videoEl.play()
            .then(() => setIsPlaying(true))
            .catch((e) => {
              if (e.name === 'NotAllowedError') setNeedsUserGesture(true);
              setIsPlaying(false);
            });
        });

        hls.on(Hls.Events.FRAG_LOADED, () => {
          if (hls.bandwidthEstimate) {
            setBandwidthKbps(Math.round(hls.bandwidthEstimate / 1000));
          }
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          console.warn('[Hls Error]:', data.details, data.type);
          if (data.fatal) {
            retryCountRef.current += 1;
            if (retryCountRef.current < 2) {
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                hls.startLoad();
              } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                hls.recoverMediaError();
              }
            } else {
              destroyHls();
              setPlaybackError('This provider stream is unavailable. Try again later.');
              setIsBuffering(false);
            }
          }
        });
      } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        // Native Safari HLS
        videoEl.src = hlsUrl;
        videoEl.load();
        videoEl.play().then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        }).catch((e) => {
          if (e.name === 'NotAllowedError') setNeedsUserGesture(true);
          setIsPlaying(false);
        });
      } else {
        // Direct TS stream fallback
        setStreamMode('direct-video');
        const tsUrl = channel.tsUrl || channel.streamUrl;
        videoEl.src = tsUrl;
        videoEl.play().catch(() => {});
      }
    }

    return () => {
      destroyHls();
    };
  }, [channel, isOpen]);

  // Video element event listeners (Time, Duration, Buffer, Error recovery)
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const handleTimeUpdate = () => {
      if (!isSeeking) {
        setCurrentTime(videoEl.currentTime);
      }
      if (videoEl.buffered.length > 0) {
        const end = videoEl.buffered.end(videoEl.buffered.length - 1);
        const rem = Math.max(0, end - videoEl.currentTime);
        setBufferSeconds(Math.round(rem * 10) / 10);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(videoEl.duration || 0);
      setIsBuffering(false);
    };

    const handleError = () => {
      console.warn('[Video Element Error] Source failed.');
      setIsBuffering(false);
      setPlaybackError('This provider stream is unavailable. Try again later.');
    };

    videoEl.addEventListener('timeupdate', handleTimeUpdate);
    videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoEl.addEventListener('error', handleError);

    return () => {
      videoEl.removeEventListener('timeupdate', handleTimeUpdate);
      videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoEl.removeEventListener('error', handleError);
    };
  }, [isSeeking]);

  // Auto-hide controls timer
  useEffect(() => {
    let timeout: any;
    const resetTimer = () => {
      setControlsVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (isPlaying && !showSettingsMenu && !showSpeedMenu && !showChannelDrawer) {
          setControlsVisible(false);
        }
      }, 4000);
    };

    window.addEventListener('mousemove', resetTimer);
    return () => {
      window.removeEventListener('mousemove', resetTimer);
      clearTimeout(timeout);
    };
  }, [isPlaying, showSettingsMenu, showSpeedMenu, showChannelDrawer]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSkip(10);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSkip(-10);
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      } else if (e.code === 'Escape') {
        if (isFullscreen) {
          toggleFullscreen();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying, isFullscreen]);

  if (!isOpen || !channel) return null;

  const currentIndex = allChannels.findIndex((c) => c.id === channel.id);
  const prevChannel = allChannels[(currentIndex - 1 + allChannels.length) % allChannels.length];
  const nextChannel = allChannels[(currentIndex + 1) % allChannels.length];

  const streamId = channel.streamId || (channel.id.replace('geo_', '').replace('geo_live_', ''));
  const fullHlsUrl = `${window.location.origin}/broadcast/api/iptv/hls/stream.m3u8?channelId=${streamId}`;
  const fullTsUrl = channel.streamUrl;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      setNeedsUserGesture(false);
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const handleSkip = (deltaSeconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.currentTime + deltaSeconds, duration || 999999));
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
  };

  const handleSeekCommit = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const target = e.currentTarget as HTMLInputElement;
    const val = parseFloat(target.value);
    videoRef.current.currentTime = val;
    setIsSeeking(false);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMute = !isMuted;
    videoRef.current.muted = nextMute;
    setIsMuted(nextMute);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
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

  const togglePip = async () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      } catch (err) {
        console.warn('PiP error:', err);
      }
    }
  };

  const handleCopy = (type: 'hls' | 'ts') => {
    let url = fullHlsUrl;
    if (type === 'ts') url = fullTsUrl;
    navigator.clipboard.writeText(url);
    setCopiedLinkType(type);
    setTimeout(() => setCopiedLinkType(null), 2500);
  };

  const filteredDrawerChannels = allChannels.filter(c => {
    if (!drawerSearch.trim()) return true;
    const q = drawerSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q) || String(c.number).includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md">
      <div
        ref={containerRef}
        className="relative w-full h-full max-w-7xl max-h-[94vh] flex flex-col bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-white/10 group select-none"
      >
        {/* Main Viewport */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            autoPlay
            className="w-full h-full object-contain cursor-pointer"
            onClick={togglePlay}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => setIsBuffering(false)}
          />

          {/* Autoplay blocked overlay banner */}
          {needsUserGesture && (
            <div 
              onClick={togglePlay}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-xs z-30 cursor-pointer"
            >
              <div className="w-16 h-16 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center shadow-2xl shadow-cyan-500/50 hover:scale-110 transition-transform">
                <Play className="w-8 h-8 fill-slate-950 translate-x-1" />
              </div>
              <span className="text-white font-bold text-sm mt-3 tracking-wide">
                Click to Start Playback
              </span>
              <span className="text-slate-400 text-xs mt-1">
                Autoplay with audio was paused by your browser
              </span>
            </div>
          )}

          {/* Buffering Indicator */}
          {isBuffering && !needsUserGesture && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none z-10 space-y-3">
              <div className="w-12 h-12 border-3 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/80 border border-white/15 text-xs font-mono text-cyan-300">
                <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Buffering Stream...</span>
              </div>
            </div>
          )}

          {playbackError && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-6 text-center">
              <p className="max-w-md text-sm text-slate-200">{playbackError}</p>
            </div>
          )}

          {/* Top Bar Header Overlay */}
          <div
            className={`absolute top-0 left-0 right-0 p-4 sm:p-5 bg-gradient-to-b from-black/95 via-black/60 to-transparent flex items-center justify-between z-20 transition-opacity duration-300 ${
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Title / Logo / Badges */}
            <div className="flex items-center gap-3">
              <ChannelLogo
                src={channel.logo}
                name={channel.name}
                category={channel.category}
                size="md"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-white font-display">
                    {channel.name}
                  </h3>
                  {channel.isLive ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                      LIVE
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      ON DEMAND
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-cyan-400 font-bold bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                    {channel.resolution || 'Unknown'}
                  </span>
                  
                  {/* Stream Engine Tag */}
                  <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {streamMode === 'cloudflare-hls' ? 'HLS' : 'Direct Video'}
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-0.5 truncate max-w-xs sm:max-w-md">
                  {channel.currentProgram.title}
                </div>
              </div>
            </div>

            {/* Top Right Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
              <button
                onClick={() => handleCopy('hls')}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-xs font-mono text-cyan-300 transition-colors"
                title="Copy M3U8 link for VLC or TiviMate"
              >
                {copiedLinkType === 'hls' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLinkType === 'hls' ? 'Copied' : 'M3U8'}</span>
              </button>

              <button
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className={`p-2 rounded-lg transition-colors ${
                  showDiagnostics ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title="Stream Health & Diagnostics"
              >
                <Activity className="w-4 h-4" />
              </button>

              <button
                onClick={() => onToggleFavorite(channel.id)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'text-rose-500 fill-rose-500' : ''}`} />
              </button>

              <button
                onClick={() => setShowEpgInfo(!showEpgInfo)}
                className={`p-2 rounded-lg transition-colors ${
                  showEpgInfo ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title="Toggle Synopsis Info"
              >
                <Info className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowChannelDrawer(!showChannelDrawer)}
                className={`p-2 rounded-lg transition-colors ${
                  showChannelDrawer ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title="Browse Lineup"
              >
                <List className="w-4 h-4" />
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-rose-500/40 text-white transition-colors"
                title="Close Player"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Diagnostics Panel */}
          {showDiagnostics && controlsVisible && (
            <div className="absolute top-20 right-5 w-80 p-4 rounded-xl bg-slate-950/95 backdrop-blur-xl border border-cyan-500/30 text-xs text-white space-y-3 z-30 shadow-2xl animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="font-bold text-cyan-400 flex items-center gap-1.5 font-display text-sm">
                  <Globe className="w-4 h-4" />
                  Stream Performance
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                  isPlaying
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {isPlaying ? 'PLAYING' : isBuffering ? 'BUFFERING' : 'WAITING'}
                </span>
              </div>

              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>Source Format:</span>
                  <span className="text-white font-bold">{isVodMedia ? 'Direct MP4 / WebM' : 'M3U8 HLS Live'}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Buffer Seconds:</span>
                  <span className="text-cyan-400 font-bold">{bufferSeconds}s</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Estimated Bitrate:</span>
                  <span className="text-white">{bandwidthKbps > 0 ? `${bandwidthKbps} Kbps` : '—'}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Playback Speed:</span>
                  <span className="text-cyan-300">{playbackSpeed}x</span>
                </div>
              </div>
            </div>
          )}

          {/* EPG / Plot Synopsis Card */}
          {showEpgInfo && controlsVisible && (
            <div className="absolute top-20 left-5 max-w-md p-4 rounded-xl bg-slate-950/90 backdrop-blur-md border border-white/15 text-xs text-white space-y-2 z-20 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-cyan-400 font-mono text-[11px]">
                <span>
                  {channel.currentProgram.startTime} — {channel.currentProgram.endTime}
                </span>
                <span>{channel.category}</span>
              </div>
              <h4 className="font-bold text-sm text-white">
                {channel.currentProgram.title}
              </h4>
              <p className="text-slate-300 text-xs leading-relaxed line-clamp-3">
                {channel.currentProgram.synopsis || 'High-definition digital broadcast powered by PlayBeat cloud stream delivery.'}
              </p>
            </div>
          )}

          {/* Channel Drawer */}
          {showChannelDrawer && (
            <div className="absolute top-0 right-0 bottom-0 w-80 bg-slate-950/95 backdrop-blur-xl border-l border-white/15 p-4 z-30 flex flex-col space-y-3 animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Tv className="w-4 h-4 text-cyan-400" />
                  <span>Channel Navigator ({allChannels.length})</span>
                </span>
                <button
                  onClick={() => setShowChannelDrawer(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search lineup..."
                  value={drawerSearch}
                  onChange={(e) => setDrawerSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white/10 border border-white/15 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 font-sans"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {filteredDrawerChannels.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      onSelectChannel(c);
                      setShowChannelDrawer(false);
                    }}
                    className={`p-2 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-colors ${
                      c.id === channel.id
                        ? 'bg-cyan-500/20 border-cyan-500 text-white'
                        : 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                    }`}
                  >
                    <ChannelLogo
                      src={c.logo}
                      name={c.name}
                      category={c.category}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">{c.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        CH {c.number} · {c.category}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Player Controls Bar */}
          <div
            className={`absolute bottom-0 left-0 right-0 p-4 sm:p-5 bg-gradient-to-t from-black/95 via-black/80 to-transparent flex flex-col gap-2 z-20 transition-opacity duration-300 ${
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* VOD Timeline Scrubber Bar */}
            {isVodMedia && duration > 0 && (
              <div className="w-full flex items-center gap-3 pointer-events-auto">
                <span className="text-[11px] font-mono text-slate-300 w-12 text-right">
                  {formatTime(currentTime)}
                </span>
                <div className="relative flex-1 flex items-center group/scrubber cursor-pointer">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.5}
                    value={currentTime}
                    onMouseDown={() => setIsSeeking(true)}
                    onTouchStart={() => setIsSeeking(true)}
                    onChange={handleSeekChange}
                    onMouseUp={handleSeekCommit}
                    onTouchEnd={handleSeekCommit}
                    className="w-full accent-cyan-400 h-1.5 group-hover/scrubber:h-2 bg-white/20 rounded-lg cursor-pointer transition-all"
                  />
                </div>
                <span className="text-[11px] font-mono text-slate-400 w-12">
                  {formatTime(duration)}
                </span>
              </div>
            )}

            {/* Controls Row */}
            <div className="flex items-center justify-between">
              {/* Left Controls: Skip Back, Play/Pause, Skip Forward, Volume */}
              <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
                <button
                  onClick={() => handleSkip(-10)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Rewind 10 seconds"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-cyan-500/30"
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-slate-950" /> : <Play className="w-4 h-4 fill-slate-950 translate-x-0.5" />}
                </button>

                <button
                  onClick={() => handleSkip(10)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Fast Forward 10 seconds"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 pl-2">
                  <button
                    onClick={toggleMute}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 sm:w-20 accent-cyan-400 h-1 cursor-pointer bg-white/20 rounded-lg"
                  />
                </div>
              </div>

              {/* Center Status Pill */}
              <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Buffer: {bufferSeconds}s</span>
                <span className="text-slate-500">|</span>
                <span className="text-cyan-400">{bandwidthKbps} Kbps</span>
              </div>

              {/* Right Controls: Speed, Quality, PIP, Fullscreen */}
              <div className="flex items-center gap-2 sm:gap-2.5 pointer-events-auto">
                {/* Playback speed selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] font-mono text-slate-200 flex items-center gap-1"
                    title="Playback Speed"
                  >
                    <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{playbackSpeed}x</span>
                  </button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-9 right-0 bg-slate-950 border border-white/15 rounded-lg p-1.5 shadow-xl space-y-1 text-xs min-w-28 z-40">
                      {[0.75, 1, 1.25, 1.5, 2].map((s) => (
                        <button
                          key={s}
                          onClick={() => handleSpeedChange(s)}
                          className={`w-full text-left px-2 py-1 rounded text-[11px] ${
                            playbackSpeed === s ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quality selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                    className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] font-mono text-cyan-300 flex items-center gap-1"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{selectedQuality}</span>
                  </button>

                  {showSettingsMenu && (
                    <div className="absolute bottom-9 right-0 bg-slate-950 border border-white/15 rounded-lg p-2 shadow-xl space-y-1 text-xs min-w-36 z-40">
                      <div className="px-2 py-1 text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                        Playback Quality
                      </div>
                      {['Auto 1080p', '1080p 60fps', '720p HD', '480p Fast'].map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            setSelectedQuality(q);
                            setShowSettingsMenu(false);
                          }}
                          className={`w-full text-left px-2 py-1 rounded text-[11px] ${
                            selectedQuality === q ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Picture-in-picture */}
                <button
                  onClick={togglePip}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors text-xs font-mono hidden sm:block"
                  title="Picture-in-Picture"
                >
                  PIP
                </button>

                {/* Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Fullscreen"
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
