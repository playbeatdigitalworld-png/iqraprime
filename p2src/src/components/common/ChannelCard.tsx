import React, { useState } from 'react';
import { Play, Radio, Plus, Check } from 'lucide-react';
import type { Channel } from '../../types/index.js';
import { useWatchlist } from '../../context/WatchlistContext.js';
import { LegalBadge } from './LegalBadge.js';

interface ChannelCardProps {
  channel: Channel;
  onPlay: (channel: Channel) => void;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({ channel, onPlay }) => {
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const inList = isInWatchlist(channel.id);
  const [logoError, setLogoError] = useState(false);

  return (
    <div
      onClick={() => onPlay(channel)}
      role="button"
      tabIndex={0}
      aria-label={`Tune in to ${channel.channelName}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPlay(channel);
        }
      }}
      className="group relative flex flex-col w-[260px] sm:w-[290px] cursor-pointer rounded-2xl overflow-hidden bg-[#111A27] border border-white/[0.06] hover:border-white/[0.16] transition-all duration-300 hover:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)] hover:-translate-y-1 shrink-0 focus-within:-translate-y-1"
    >
      {/* Top Banner / Channel Screen Frame */}
      <div className="relative aspect-video w-full bg-[#0B1018] flex items-center justify-center p-6 overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#18202C_1px,transparent_1px)] [background-size:12px_12px] opacity-40" />

        {/* Channel Logo */}
        {!logoError ? (
          <img
            src={channel.logo}
            alt={channel.channelName}
            referrerPolicy="no-referrer"
            onError={() => setLogoError(true)}
            className="max-h-14 max-w-[150px] object-contain drop-shadow-md z-10 transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="z-10 flex flex-col items-center">
            <Radio className="w-8 h-8 text-[#E5093A] mb-1" />
            <span className="text-xs font-bold text-white text-center font-display">{channel.channelName}</span>
          </div>
        )}

        {/* Elegant LIVE Indicator */}
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 border border-white/10 backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E5093A] animate-pulse" />
          <span className="text-[10px] font-bold tracking-wider text-white uppercase">LIVE</span>
        </div>

        {/* Country Label */}
        <div className="absolute top-2.5 right-2.5 z-20 text-[10px] text-slate-300 bg-black/50 px-1.5 py-0.5 rounded border border-white/5">
          {channel.country.split('/')[0].trim()}
        </div>

        {/* Hover Quick Play Overlay */}
        <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(channel);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E5093A] hover:bg-[#B90732] text-white text-xs font-semibold shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Tune In</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleWatchlist(channel.id, channel.channelName);
            }}
            className={`p-2 rounded-lg border transition-transform hover:scale-105 ${
              inList
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : 'bg-black/60 border-white/20 text-white'
            }`}
            title={inList ? 'Saved in favorites' : 'Add to favorites'}
          >
            {inList ? <Check className="w-4 h-4 text-emerald-400" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Channel Meta & EPG Guide Snippet */}
      <div className="p-3.5 flex flex-col flex-1 justify-between bg-[#111A27]">
        <div>
          <div className="flex items-center justify-between gap-1 mb-1">
            <LegalBadge status={channel.rightsStatus} />
            <span className="text-[10px] text-slate-400">{channel.category}</span>
          </div>
          <h3 className="text-sm font-semibold text-white tracking-tight line-clamp-1 group-hover:text-[#E5093A] transition-colors">
            {channel.channelName}
          </h3>
        </div>

        {/* EPG Program Guide Snippet */}
        {channel.epgProgram && (
          <div className="mt-2.5 pt-2 border-t border-white/5 text-[11px]">
            <p className="text-slate-300 truncate font-medium flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-[#E5093A] animate-pulse" />
              <span>{channel.epgProgram.current}</span>
            </p>
            <p className="text-slate-500 text-[10px] truncate mt-0.5">
              Next: {channel.epgProgram.next} ({channel.epgProgram.startTime})
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
