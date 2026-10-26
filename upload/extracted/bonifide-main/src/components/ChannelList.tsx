import React, { useState } from 'react';
import { 
  Play, 
  Star, 
  Heart, 
  Edit3, 
  Trash2, 
  Copy, 
  Check, 
  ExternalLink,
  AlertTriangle 
} from 'lucide-react';
import { Channel, Category } from '../types/iptv';

interface ChannelListProps {
  channels: Channel[];
  categories: Category[];
  selectedChannelIds: Set<string>;
  duplicateIds: Set<string>;
  onSelectChannel: (channelId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onPreview: (channel: Channel) => void;
  onEdit: (channel: Channel) => void;
  onDuplicate: (channelId: string) => void;
  onDelete: (channelId: string) => void;
  onToggleFavorite: (channelId: string) => void;
  onToggleFeatured: (channelId: string) => void;
  onToggleStatus: (channelId: string) => void;
}

export const ChannelList: React.FC<ChannelListProps> = ({
  channels,
  categories,
  selectedChannelIds,
  duplicateIds,
  onSelectChannel,
  onSelectAll,
  onPreview,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleFavorite,
  onToggleFeatured,
  onToggleStatus,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categoryMap = React.useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const allSelected = channels.length > 0 && channels.every((c) => selectedChannelIds.has(c.id));
  const someSelected = channels.some((c) => selectedChannelIds.has(c.id)) && !allSelected;

  const handleCopy = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#0e111c]/80 backdrop-blur-xl">
      <table className="w-full text-left border-collapse text-xs">
        {/* Table Header */}
        <thead>
          <tr className="border-b border-white/5 bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
            <th className="py-3 px-4 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 accent-amber-500 cursor-pointer"
              />
            </th>
            <th className="py-3 px-2 w-12 text-center">#</th>
            <th className="py-3 px-3 w-14">Logo</th>
            <th className="py-3 px-4">Channel Name & Stream URL</th>
            <th className="py-3 px-3">Category</th>
            <th className="py-3 px-3">Country / Lang</th>
            <th className="py-3 px-3">Quality</th>
            <th className="py-3 px-3 text-center">Status</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-white/5">
          {channels.map((channel) => {
            const isSelected = selectedChannelIds.has(channel.id);
            const isDuplicate = duplicateIds.has(channel.id);
            const cat = categoryMap.get(channel.category);

            return (
              <tr
                key={channel.id}
                className={`transition-colors ${
                  isSelected
                    ? 'bg-amber-500/10 hover:bg-amber-500/15'
                    : 'hover:bg-white/[0.03]'
                }`}
              >
                {/* Checkbox */}
                <td className="py-3 px-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onSelectChannel(channel.id, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 accent-amber-500 cursor-pointer"
                  />
                </td>

                {/* Channel # */}
                <td className="py-3 px-2 text-center font-mono font-semibold text-slate-400">
                  {channel.channelNumber}
                </td>

                {/* Logo */}
                <td className="py-3 px-3">
                  <div 
                    onClick={() => onPreview(channel)}
                    className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-900 overflow-hidden cursor-pointer hover:border-amber-400/50"
                  >
                    {channel.logo ? (
                      <img
                        src={channel.logo}
                        alt={channel.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="font-extrabold text-[11px] text-amber-400">
                        {channel.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                </td>

                {/* Channel Name & Stream URL */}
                <td className="py-3 px-4 max-w-xs sm:max-w-md">
                  <div className="flex items-center gap-2">
                    <span 
                      onClick={() => onPreview(channel)}
                      className="font-bold text-white hover:text-amber-300 cursor-pointer truncate"
                    >
                      {channel.name}
                    </span>
                    {channel.isFeatured && (
                      <span className="rounded bg-amber-500/10 px-1 py-0.2 text-[9px] font-bold text-amber-300 border border-amber-500/20">
                        ⭐ VIP
                      </span>
                    )}
                    {isDuplicate && (
                      <span className="flex items-center gap-0.5 rounded bg-amber-500/20 px-1 py-0.2 text-[9px] font-bold text-amber-300 border border-amber-500/30">
                        <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />
                        DUP
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400 truncate mt-0.5">
                    <span className="truncate max-w-[280px]">{channel.streamUrl}</span>
                    <button
                      onClick={() => handleCopy(channel.id, channel.streamUrl)}
                      className="text-slate-400 hover:text-slate-200"
                      title="Copy URL"
                    >
                      {copiedId === channel.id ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </td>

                {/* Category */}
                <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    <span>{cat?.icon || '📺'}</span>
                    <span>{cat?.name || 'General'}</span>
                  </span>
                </td>

                {/* Country / Lang */}
                <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                  <div className="font-medium text-slate-200">{channel.country || 'Global'}</div>
                  <div className="text-[10px] text-slate-400">{channel.language || 'English'}</div>
                </td>

                {/* Quality */}
                <td className="py-3 px-3 whitespace-nowrap">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    channel.resolution?.includes('4K')
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-slate-800 text-slate-300'
                  }`}>
                    {channel.resolution || 'FHD 1080p'}
                  </span>
                </td>

                {/* Status */}
                <td className="py-3 px-3 text-center whitespace-nowrap">
                  <button
                    onClick={() => onToggleStatus(channel.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold cursor-pointer transition-colors ${
                      channel.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${channel.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    {channel.status === 'active' ? 'Active' : 'Offline'}
                  </button>
                </td>

                {/* Actions */}
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onToggleFavorite(channel.id)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        channel.isFavorite ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Favorite"
                    >
                      <Heart className={`h-3.5 w-3.5 ${channel.isFavorite ? 'fill-rose-400' : ''}`} />
                    </button>
                    <button
                      onClick={() => onToggleFeatured(channel.id)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        channel.isFeatured ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Featured"
                    >
                      <Star className={`h-3.5 w-3.5 ${channel.isFeatured ? 'fill-amber-400' : ''}`} />
                    </button>
                    <button
                      onClick={() => onPreview(channel)}
                      className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                      title="Preview Player"
                    >
                      <Play className="h-3.5 w-3.5 fill-amber-400" />
                    </button>
                    <button
                      onClick={() => onEdit(channel)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(channel.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
