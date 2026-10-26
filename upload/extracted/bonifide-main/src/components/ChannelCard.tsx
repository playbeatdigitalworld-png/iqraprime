import React, { useState } from 'react';
import { 
  Play, 
  Star, 
  Heart, 
  MoreVertical, 
  Edit3, 
  Copy, 
  Trash2, 
  Check, 
  ExternalLink,
  Radio,
  Tv,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { Channel, Category } from '../types/iptv';

interface ChannelCardProps {
  channel: Channel;
  category?: Category;
  isSelected: boolean;
  isDuplicate?: boolean;
  onSelect: (channelId: string, selected: boolean) => void;
  onPreview: (channel: Channel) => void;
  onEdit: (channel: Channel) => void;
  onDuplicate: (channelId: string) => void;
  onDelete: (channelId: string) => void;
  onToggleFavorite: (channelId: string) => void;
  onToggleFeatured: (channelId: string) => void;
  onToggleStatus: (channelId: string) => void;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  category,
  isSelected,
  isDuplicate,
  onSelect,
  onPreview,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleFavorite,
  onToggleFeatured,
  onToggleStatus,
}) => {
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleCopyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(channel.streamUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getQualityBadgeColor = () => {
    if (channel.resolution?.includes('4K HDR')) return 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/30';
    if (channel.resolution?.includes('4K')) return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
    if (channel.resolution?.includes('1080p') || channel.resolution?.includes('FHD')) return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
    return 'bg-slate-700/30 text-slate-400 border-slate-600/20';
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', channel.id);
      }}
      className={`group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 cursor-default select-none ${
        isSelected
          ? 'border-amber-500/70 bg-[#161a2b] shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30'
          : 'border-white/5 bg-[#0f121d]/80 hover:border-white/15 hover:bg-[#131726] hover:shadow-xl hover:shadow-black/40'
      }`}
    >
      {/* Top Bar: Checkbox, Quality Badge, Channel #, Duplicate Alert */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {/* Multi-Select Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(channel.id, e.target.checked)}
            className="h-4 w-4 rounded border-slate-700 bg-slate-900/80 text-amber-500 focus:ring-amber-500/50 cursor-pointer accent-amber-500"
          />

          {/* Channel Number */}
          <span className="font-mono text-xs font-semibold text-slate-400">
            #{channel.channelNumber}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Duplicate Badge */}
          {isDuplicate && (
            <span
              className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30"
              title="Duplicate stream or name detected"
            >
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              DUP
            </span>
          )}

          {/* Resolution Badge */}
          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase border ${getQualityBadgeColor()}`}>
            {channel.resolution || 'FHD 1080p'}
          </span>
        </div>
      </div>

      {/* Main Content: Logo & Details */}
      <div className="flex items-center gap-3.5 mb-3">
        {/* Channel Logo / Fallback Monogram */}
        <div 
          onClick={() => onPreview(channel)}
          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-1 group-hover:border-amber-500/30 transition-all cursor-pointer shadow-inner"
        >
          {channel.logo && !imageError ? (
            <img
              src={channel.logo}
              alt={channel.name}
              onError={() => setImageError(true)}
              className="h-full w-full object-cover rounded-lg"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-lg bg-slate-800/80 text-base font-extrabold text-amber-400/90 tracking-wider">
              {channel.name.slice(0, 2).toUpperCase()}
            </div>
          )}

          {/* Hover Play Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="h-5 w-5 text-amber-400 fill-amber-400" />
          </div>

          {/* Status Dot */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus(channel.id);
            }}
            title={`Status: ${channel.status} (click to toggle)`}
            className={`absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full ring-2 ring-[#0f121d] cursor-pointer ${
              channel.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
            }`}
          />
        </div>

        {/* Channel Titles and Badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <h3 
              onClick={() => onPreview(channel)}
              className="truncate text-sm font-bold text-white hover:text-amber-300 transition-colors cursor-pointer" 
              title={channel.name}
            >
              {channel.name}
            </h3>
          </div>

          {/* Category & Country */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
            <span className="truncate">{category?.icon} {category?.name || 'General'}</span>
            <span>•</span>
            <span className="font-medium text-slate-300">{channel.country || 'Global'}</span>
          </div>

          {/* Stream details */}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
            {channel.fps && <span>{channel.fps}fps</span>}
            {channel.bitrate && (
              <>
                <span>•</span>
                <span>{channel.bitrate}</span>
              </>
            )}
            {channel.audioTrack && (
              <>
                <span>•</span>
                <span className="text-amber-400/90">{channel.audioTrack}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stream URL Bar Snippet */}
      <div 
        onClick={handleCopyUrl}
        className="mb-3 flex items-center justify-between rounded-lg border border-white/5 bg-black/40 px-2.5 py-1 text-[11px] font-mono text-slate-400 hover:border-white/10 hover:text-slate-300 transition-colors cursor-pointer"
        title="Click to copy stream URL"
      >
        <span className="truncate max-w-[200px]">{channel.streamUrl}</span>
        {copied ? (
          <Check className="h-3 w-3 text-emerald-400 shrink-0" />
        ) : (
          <Copy className="h-3 w-3 text-slate-400 group-hover:text-slate-300 shrink-0" />
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="flex items-center justify-between border-t border-white/5 pt-2.5">
        <div className="flex items-center gap-1">
          {/* Favorite Toggle */}
          <button
            onClick={() => onToggleFavorite(channel.id)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              channel.isFavorite
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                : 'text-slate-400 hover:bg-white/5 hover:text-rose-400'
            }`}
            title="Toggle Favorite"
          >
            <Heart className={`h-4 w-4 ${channel.isFavorite ? 'fill-rose-400' : ''}`} />
          </button>

          {/* Featured Toggle */}
          <button
            onClick={() => onToggleFeatured(channel.id)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              channel.isFeatured
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                : 'text-slate-400 hover:bg-white/5 hover:text-amber-400'
            }`}
            title="Toggle Featured ⭐"
          >
            <Star className={`h-4 w-4 ${channel.isFeatured ? 'fill-amber-400' : ''}`} />
          </button>
        </div>

        {/* Action Buttons: Preview / Edit / Actions Menu */}
        <div className="flex items-center gap-1">
          {/* Preview Video Button */}
          <button
            onClick={() => onPreview(channel)}
            className="flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer"
            title="Preview stream"
          >
            <Play className="h-3 w-3 fill-amber-300" />
            <span>Play</span>
          </button>

          {/* Edit Button */}
          <button
            onClick={() => onEdit(channel)}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
            title="Edit Channel Details"
          >
            <Edit3 className="h-4 w-4" />
          </button>

          {/* More Menu Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 bottom-8 z-50 w-44 rounded-xl border border-white/10 bg-[#0f1322] p-1 shadow-2xl backdrop-blur-xl">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDuplicate(channel.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5 text-purple-400" />
                    Duplicate Channel
                  </button>
                  <button
                    onClick={(e) => {
                      setShowMenu(false);
                      handleCopyUrl(e);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5 text-cyan-400" />
                    Copy Stream URL
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onToggleStatus(channel.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer"
                  >
                    <Radio className="h-3.5 w-3.5 text-emerald-400" />
                    Mark {channel.status === 'active' ? 'Offline' : 'Active'}
                  </button>
                  <div className="border-t border-white/5 my-1" />
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(channel.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Channel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
