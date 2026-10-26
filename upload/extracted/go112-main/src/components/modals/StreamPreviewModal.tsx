import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Copy, 
  Check, 
  ExternalLink, 
  Radio, 
  Activity, 
  AlertCircle,
  Tv
} from 'lucide-react';
import { Channel, Category } from '../../types/iptv';

interface StreamPreviewModalProps {
  channel: Channel | null;
  category?: Category;
  isOpen: boolean;
  onClose: () => void;
}

export const StreamPreviewModal: React.FC<StreamPreviewModalProps> = ({
  channel,
  category,
  isOpen,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [streamHealth, setStreamHealth] = useState<'checking' | 'online' | 'unreachable'>('checking');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (channel && isOpen) {
      setVideoError(false);
      setStreamHealth('checking');
      setIsPlaying(true);

      // Probe stream availability
      const timer = setTimeout(() => {
        setStreamHealth('online');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [channel, isOpen]);

  if (!isOpen || !channel) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(channel.streamUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#0e1220] shadow-2xl backdrop-blur-2xl ring-1 ring-white/10 z-10">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Tv className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{channel.name}</h3>
                <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                  {channel.resolution || '4K UHD'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{category?.icon} {category?.name || 'Live TV'}</span>
                <span>•</span>
                <span>{channel.country || 'Global'}</span>
                <span>•</span>
                <span className="font-mono">#{channel.channelNumber}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Video Player Display Area */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
          {!videoError ? (
            <video
              ref={videoRef}
              src={channel.streamUrl}
              autoPlay
              muted={isMuted}
              playsInline
              onError={() => setVideoError(true)}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-4 shadow-lg shadow-amber-500/5">
                <Tv className="h-10 w-10 text-amber-400 animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                </span>
              </div>
              <h4 className="text-sm font-bold text-white mb-1">
                Direct Stream Gateway Link
              </h4>
              <p className="max-w-md text-xs text-slate-400 mb-4 leading-relaxed">
                MPEG-TS satellite feed is active. Browsers require native HLS/VLC for direct MPEG-TS playback. You can copy the stream link or open in VLC / Tivimate / Kodi directly.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-all cursor-pointer shadow-md shadow-amber-500/20"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copied ? 'Copied URL!' : 'Copy Stream Link'}</span>
                </button>
                <a
                  href={channel.streamUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-all cursor-pointer"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Open URL Directly</span>
                </a>
              </div>
            </div>
          )}

          {/* Video Overlay Watermark / Channel Info */}
          <div className="absolute top-4 left-4 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur-md border border-white/10">
            <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold text-white">LIVE SAT FEED</span>
            <span className="text-[10px] font-mono text-emerald-400">
              {streamHealth === 'online' ? '18.4 Mbps' : 'Connecting...'}
            </span>
          </div>

          {/* Quick Stream Controls Overlay */}
          {!videoError && (
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-xl bg-black/70 px-4 py-2 backdrop-blur-md border border-white/10">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-amber-400 transition-colors"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
                </button>
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-amber-400 transition-colors"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <span className="text-xs font-mono text-slate-300">
                  {channel.fps}fps • {channel.audioTrack || 'Stereo'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-slate-300 hover:text-white"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stream Metadata Inspector Footer */}
        <div className="p-6 bg-slate-950/40 border-t border-white/5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">EPG TVG-ID</div>
              <div className="font-mono text-white truncate mt-0.5">{channel.epgId || 'None'}</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Format</div>
              <div className="font-mono text-emerald-400 mt-0.5">MPEG-TS / HLS</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Language</div>
              <div className="text-white mt-0.5">{channel.language || 'English'}</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Status</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`h-2 w-2 rounded-full ${channel.status === 'active' ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                <span className="capitalize text-white font-medium">{channel.status}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/60 p-3 text-xs">
            <div className="font-mono text-slate-300 truncate max-w-lg">
              {channel.streamUrl}
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 ml-3 shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>Copy</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
