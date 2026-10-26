import React, { useState, useMemo } from 'react';
import { Channel, MediaCategory } from '../../types/playbeat';
import { 
  Tv, 
  Search, 
  Play, 
  Heart, 
  Radio, 
  Sparkles, 
  Globe, 
  Flame, 
  Film, 
  Music, 
  Smile, 
  Compass, 
  Coffee,
  Check,
  ChevronDown,
  Layers,
  Zap,
  Activity,
  ShieldCheck,
  Wifi
} from 'lucide-react';
import { ChannelLogo } from '../common/ChannelLogo';

interface LiveTvViewProps {
  channels: Channel[];
  onWatchChannel: (channel: Channel) => void;
  favorites: string[];
  onToggleFavorite: (channelId: string) => void;
}

export const LiveTvView: React.FC<LiveTvViewProps> = ({
  channels,
  onWatchChannel,
  favorites,
  onToggleFavorite
}) => {
  const [selectedCategory, setSelectedCategory] = useState<MediaCategory | 'All'>('All');
  const [quickTag, setQuickTag] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(48);

  const categories: { id: MediaCategory | 'All'; label: string; icon: any }[] = [
    { id: 'All', label: 'All Channels', icon: Tv },
    { id: 'Sports', label: 'Live Sports & Cricket', icon: Flame },
    { id: 'Movies', label: 'Cinema & Bollywood', icon: Film },
    { id: 'Entertainment', label: 'Dramas & Shows', icon: Sparkles },
    { id: 'News', label: 'World News 24/7', icon: Globe },
    { id: 'Kids', label: 'Kids & Cartoons', icon: Smile },
    { id: 'Music', label: 'Music & Concerts', icon: Music },
    { id: 'Documentary', label: 'Documentaries', icon: Compass },
    { id: 'International', label: 'Regional & Islamic', icon: Coffee }
  ];

  const quickFilterPills = useMemo(() => {
    const groups = Array.from(new Set(
      channels.flatMap((channel) => [channel.groupTitle, channel.category])
        .filter((group): group is string => typeof group === 'string' && group.trim().length > 0)
    ));
    return [
      { id: 'ALL', label: `All Feeds (${channels.length})` },
      ...groups.map((group) => ({ id: group, label: group }))
    ];
  }, [channels]);

  const filteredChannels = useMemo(() => {
    return channels.filter((ch) => {
      if (onlyFavorites && !favorites.includes(ch.id)) return false;
      if (selectedCategory !== 'All' && ch.category !== selectedCategory) return false;

      if (
        quickTag !== 'ALL' &&
        ch.groupTitle !== quickTag &&
        ch.category !== quickTag
      ) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = ch.name.toLowerCase().includes(q);
        const matchesProg = ch.currentProgram?.title?.toLowerCase().includes(q) || false;
        const matchesNum = String(ch.number).includes(q);
        const matchesCat = ch.category.toLowerCase().includes(q);
        return matchesName || matchesProg || matchesNum || matchesCat;
      }
      return true;
    });
  }, [channels, selectedCategory, quickTag, searchQuery, onlyFavorites, favorites]);

  const displayedChannels = filteredChannels.slice(0, visibleLimit);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${channels.length > 0 ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            <h1 className="text-2xl font-black text-white font-display tracking-tight flex items-center gap-2">
              <span>PLAYBEAT ENTERTAIN — Live TV</span>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                {channels.length} Configured Feeds
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Live feeds require an authorized provider and are checked when playback starts.
          </p>
        </div>

        {/* Search & Favorites Toggle */}
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search configured channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0c1326] border border-white/[0.1] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <button
            onClick={() => setOnlyFavorites(!onlyFavorites)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
              onlyFavorites
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : 'bg-[#0c1326] border-white/[0.1] text-slate-400 hover:text-white'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-rose-400' : ''}`} />
            <span className="hidden sm:inline">Favorites</span>
          </button>
        </div>
      </div>

      {/* Quick Filter Tag Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {quickFilterPills.map((pill) => (
          <button
            key={pill.id}
            onClick={() => {
              setQuickTag(pill.id);
              setVisibleLimit(48);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              quickTag === pill.id
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'bg-[#0c1326] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* 2-Column Layout: Categories Sidebar + Channels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (3 cols): Categories Panel */}
        <div className="lg:col-span-3 bg-[#0c1326]/70 border border-white/[0.08] rounded-2xl p-3 space-y-1 backdrop-blur-md sticky top-20">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2 flex items-center justify-between">
            <span>Categories</span>
            <span className="text-cyan-400 font-mono text-[10px]">{channels.length} Total</span>
          </div>

          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            const count =
              cat.id === 'All'
                ? channels.length
                : channels.filter((c) => c.category === cat.id).length;

            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setQuickTag('ALL');
                  setVisibleLimit(48);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{cat.label}</span>
                </div>
                <span className="font-mono text-[11px] text-slate-400 opacity-80">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Column (9 cols): Channel Cards Grid */}
        <div className="lg:col-span-9 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
            <span>
              Showing <strong className="text-white font-mono">{displayedChannels.length}</strong> of{' '}
              <strong className="text-cyan-400 font-mono">{filteredChannels.length}</strong> live television feeds
            </span>
            <span className="hidden sm:inline">HLS playback · stream quality varies by provider</span>
          </div>

          {filteredChannels.length === 0 ? (
            <div className="p-12 text-center bg-[#0c1326]/40 border border-white/[0.06] rounded-2xl space-y-3">
              <Radio className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-sm font-semibold text-white">
                {channels.length === 0 ? 'No provider feeds are configured' : 'No channels match these filters'}
              </div>
              <p className="text-xs text-slate-400">
                {channels.length === 0
                  ? 'Configure an authorized HTTPS provider to load the live catalog.'
                  : 'Try selecting "All Channels" or clearing your search term.'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {displayedChannels.map((channel) => {
                  const isFav = favorites.includes(channel.id);
                  return (
                    <div
                      key={channel.id}
                      className="group bg-[#0c1326]/80 hover:bg-[#111b33] border border-white/[0.08] hover:border-cyan-500/50 rounded-2xl p-4 transition-all hover:scale-[1.01] shadow-lg shadow-black/40 flex flex-col justify-between"
                    >
                      <div>
                        {/* Top Header of Card */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <ChannelLogo
                              src={channel.logo}
                              name={channel.name}
                              category={channel.category}
                              size="lg"
                            />
                            <div className="min-w-0 truncate">
                              <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                                {channel.name}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                                CH {channel.number} · {channel.resolution} · {channel.category}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => onToggleFavorite(channel.id)}
                            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 transition-colors shrink-0"
                            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Heart
                              className={`w-4 h-4 ${
                                isFav ? 'text-rose-500 fill-rose-500' : 'hover:text-white'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Current Program Details */}
                        <div className="p-3 bg-black/30 border border-white/[0.04] rounded-xl space-y-2 mb-3">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-200 truncate pr-2">
                              {channel.currentProgram.title}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 shrink-0">
                              LIVE
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                            <div
                              className="bg-cyan-400 h-full rounded-full"
                              style={{ width: `${channel.currentProgram.progressPercentage}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>{channel.currentProgram.startTime}</span>
                            <span>{channel.currentProgram.endTime}</span>
                          </div>
                        </div>

                        {/* Next Program Preview */}
                        <div className="text-[11px] text-slate-400 flex items-center justify-between px-1 mb-3">
                          <span className="truncate">Up next: {channel.nextProgram.title}</span>
                          <span className="font-mono text-[10px] text-slate-400 shrink-0">
                            {channel.nextProgram.startTime}
                          </span>
                        </div>
                      </div>

                      {/* Watch Live Button */}
                      <button
                        onClick={() => onWatchChannel(channel)}
                        className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/10 transition-all active:scale-[0.98]"
                      >
                        <Play className="w-3.5 h-3.5 fill-slate-950" />
                        <span>Watch Live Stream</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Load More Button for large channel count */}
              {visibleLimit < filteredChannels.length && (
                <div className="pt-6 text-center">
                  <button
                    onClick={() => setVisibleLimit((prev) => Math.min(prev + 48, filteredChannels.length))}
                    className="px-6 py-3 bg-[#0c1326] hover:bg-[#111b33] border border-cyan-500/40 hover:border-cyan-500 text-cyan-300 font-bold text-xs rounded-xl transition-all shadow-lg flex items-center gap-2 mx-auto"
                  >
                    <ChevronDown className="w-4 h-4 text-cyan-400" />
                    <span>
                      Load More Channels (Showing {displayedChannels.length} of {filteredChannels.length})
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
