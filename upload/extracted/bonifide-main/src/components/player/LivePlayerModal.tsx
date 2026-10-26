import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  SkipBack, 
  SkipForward, 
  Heart, 
  Copy, 
  Tv, 
  Eye
} from 'lucide-react';
import { ChannelRecord } from '../../types/database';
import { useAuth } from '../../context/AuthContext';

interface LivePlayerModalProps {
  channel: ChannelRecord | null;
  channelsList: ChannelRecord[];
  isOpen: boolean;
  onClose: () => void;
  onSelectChannel: (channel: ChannelRecord) => void;
}

export const LivePlayerModal: React.FC<LivePlayerModalProps> = ({
  channel,
  channelsList,
  isOpen,
  onClose,
  onSelectChannel,
}) => {
  const { isFavorite, toggleFavorite } = useAuth();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (channel && isOpen) {
      setVideoError(false);
      setIsPlaying(true);
    }
  }, [channel, isOpen]);

  if (!isOpen || !channel) return null;

  const currentIdx = channelsList.findIndex((c) => c.id === channel.id);
  const handlePrev = () => {
    if (channelsList.length === 0) return;
    const prevIdx = (currentIdx - 1 + channelsList.length) % channelsList.length;
    onSelectChannel(channelsList[prevIdx]);
  };

  const handleNext = () => {
    if (channelsList.length === 0) return;
    const nextIdx = (currentIdx + 1) % channelsList.length;
    onSelectChannel(channelsList[nextIdx]);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play().catch(() => {});
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
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

  const handlePIP = () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      } else {
        videoRef.current.requestPictureInPicture().catch(() => {});
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-xl">
      <div 
        ref={containerRef}
        className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#0a0d18] shadow-2xl flex flex-col max-h-[95vh]"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-white/5 bg-[#0e1222] px-5 py-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden border border-white/10 bg-slate-900">
              <img src={channel.logo} alt={channel.officialName} className="h-full w-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-sm">{channel.officialName}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  channel.streamHealth === 'ONLINE' ? 'bg-emerald-500/20 text-emerald-300' :
                  channel.streamHealth === 'OFFLINE' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-500/20 text-slate-300'
                }`}>
                  {channel.streamHealth === 'ONLINE' ? 'ONLINE' : channel.streamHealth === 'OFFLINE' ? 'OFFLINE' : 'NOT CHECKED'}
                </span>
              </div>
              {(channel.country || channel.category || channel.epgChannelId) && (
                <div className="text-[11px] text-slate-400">
                  {[channel.country, channel.category, channel.epgChannelId && `EPG: ${channel.epgChannelId}`].filter(Boolean).join(' • ')}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFavorite(channel.id)}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isFavorite(channel.id) ? 'bg-rose-500/20 text-rose-400' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Add to Favorites"
            >
              <Heart className={`h-4 w-4 ${isFavorite(channel.id) ? 'fill-rose-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Video Canvas Area */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden group">
          {!videoError ? (
            <video
              ref={videoRef}
              src={channel.streamUrl}
              autoPlay
              playsInline
              muted={isMuted}
              onError={() => setVideoError(true)}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3 animate-pulse">
                <Tv className="h-8 w-8" />
              </div>
              <h4 className="text-base font-bold text-white mb-1">Unable to play this stream in the browser</h4>
              <p className="max-w-md text-xs text-slate-400 mb-4">
                The provider stream may use a format that this browser cannot play. You can copy the stream URL and try a compatible player.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(channel.streamUrl);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Stream URL</span>
                </button>
                <a
                  href={channel.streamUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                >
                  Open Stream
                </a>
              </div>
            </div>
          )}

          {/* Quick Stream Controls Overlay */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/85 px-4 py-2.5 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              {/* Prev Channel */}
              <button
                onClick={handlePrev}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Previous Channel (CH-)"
              >
                <SkipBack className="h-4 w-4" />
              </button>

              {/* Play / Pause */}
              <button
                onClick={togglePlay}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors cursor-pointer"
              >
                {isPlaying ? <Pause className="h-4 w-4 fill-slate-950" /> : <Play className="h-4 w-4 fill-slate-950 ml-0.5" />}
              </button>

              {/* Next Channel */}
              <button
                onClick={handleNext}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Next Channel (CH+)"
              >
                <SkipForward className="h-4 w-4" />
              </button>

              {/* Volume */}
              <button
                onClick={toggleMute}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer ml-2"
              >
                {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>

            {/* Right Action Icons */}
            <div className="flex items-center gap-3 text-xs">
              {/* PIP */}
              <button
                onClick={handlePIP}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Picture-in-Picture"
              >
                <Eye className="h-4 w-4" />
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="text-slate-400 hover:text-white cursor-pointer"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Provider catalog details */}
        <div className="border-t border-white/5 bg-[#0e111d] p-4 text-xs">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-slate-400">
            {channel.category && <span>Category: <strong className="text-white">{channel.category}</strong></span>}
            {channel.country && <span>Country: <strong className="text-white">{channel.country}</strong></span>}
            {channel.epgChannelId && <span>EPG ID: <strong className="text-white">{channel.epgChannelId}</strong></span>}
            {channel.channelNumber != null && <span>Channel number: <strong className="text-white">{channel.channelNumber}</strong></span>}
          </div>
        </div>

      </div>
    </div>
  );
};
