import React, { useState, useMemo } from 'react';
import { Channel, Movie, Series } from '../../types/playbeat';
import { 
  Play, 
  Plus, 
  Check, 
  ChevronRight, 
  Radio, 
  Flame, 
  Trophy, 
  Film, 
  Tv, 
  Sparkles, 
  Heart, 
  TrendingUp, 
  Users, 
  Clock, 
  Zap, 
} from 'lucide-react';
import { ChannelLogo } from '../common/ChannelLogo';

interface HomeSectionsProps {
  channels: Channel[];
  movies: Movie[];
  series: Series[];
  onWatchChannel: (channel: Channel) => void;
  onWatchMovie: (movie: Movie) => void;
  onSelectSeries: (series: Series) => void;
  onToggleMyList: (title: string) => void;
  isItemInMyList: (title: string) => boolean;
  onNavigateSection: (section: string) => void;
  favorites?: string[];
  onToggleFavorite?: (channelId: string) => void;
}

export const HomeSections: React.FC<HomeSectionsProps> = ({
  channels,
  movies,
  series,
  onWatchChannel,
  onWatchMovie,
  onSelectSeries,
  onToggleMyList,
  isItemInMyList,
  onNavigateSection,
  favorites = [],
  onToggleFavorite
}) => {
  const [popularCategory, setPopularCategory] = useState<string>('ALL');

  // 1. PLAYING NOW / LIVE ON AIR CHANNELS
  // Filter active live broadcast channels with real programs
  const playingNowChannels = useMemo(() => {
    return channels.slice(0, 10);
  }, [channels]);

  // 2. TRENDING & POPULAR CHANNELS
  const popularChannels = useMemo(() => {
    if (popularCategory === 'ALL') {
      return channels.slice(0, 12);
    }
    return channels
      .filter((c) => c.category?.toLowerCase() === popularCategory.toLowerCase())
      .slice(0, 12);
  }, [channels, popularCategory]);

  const categoryFilters = [
    { id: 'ALL', label: 'All Popular', icon: Flame },
    { id: 'Sports', label: 'Sports', icon: Trophy },
    { id: 'Movies', label: 'Movies & Cinema', icon: Film },
    { id: 'News', label: 'Live News', icon: Radio },
    { id: 'Entertainment', label: 'Entertainment', icon: Tv },
    { id: 'Documentary', label: 'Documentary', icon: Sparkles },
    { id: 'Kids', label: 'Kids & Family', icon: Zap }
  ];

  return (
    <div className="space-y-12 py-6 max-w-7xl mx-auto px-4 lg:px-8">
      {/* ========================================================
          SECTION 1: PLAYING NOW / LIVE ON AIR
          Displays channels currently broadcasting with live progress
          ======================================================== */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight font-display flex items-center gap-2">
                <span>Live TV Lineup</span>
                <span className="text-slate-500 font-normal">·</span>
                <span className="text-xs font-mono font-bold text-rose-400 bg-rose-950/70 border border-rose-500/30 px-2 py-0.5 rounded">
                  {channels.length > 0 ? 'CACHED LISTINGS' : 'SETUP REQUIRED'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Cached channel listings; playback still requires an active authorized provider.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateSection('live')}
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 self-start sm:self-auto transition-colors"
          >
            <span>View All {channels.length} Live Channels</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {playingNowChannels.length === 0 && (
          <div className="relative overflow-hidden rounded-2xl border border-amber-200/15 bg-gradient-to-r from-amber-200/[0.07] via-[#0b1220] to-[#0b1220] px-5 py-7 sm:px-8">
            <div className="absolute -right-8 -top-16 h-48 w-48 rounded-full border border-amber-200/10" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-amber-200/20 bg-amber-200/[0.07] p-2.5 text-amber-200">
                  <Radio className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Your live lineup starts here</div>
                  <p className="mt-1 max-w-xl text-xs leading-5 text-slate-400">
                    Connect an authorized HTTPS provider to load real channels and schedule details.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigateSection('live')}
                className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-amber-200/20 bg-amber-200/[0.06] px-3.5 py-2 text-xs font-bold text-amber-100 transition hover:bg-amber-200/10 sm:self-auto"
              >
                Browse Live TV <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Live Channel Carousel */}
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 no-scrollbar scroll-smooth">
          {playingNowChannels.map((channel) => {
            const isFav = favorites.includes(channel.id);

            return (
              <div
                key={channel.id}
                onClick={() => onWatchChannel(channel)}
                className="group relative shrink-0 w-[280px] sm:w-[320px] bg-[#0c1326]/90 hover:bg-[#111c38] border border-white/[0.08] hover:border-cyan-500/60 rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02] shadow-xl shadow-black/50 flex flex-col justify-between"
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <ChannelLogo
                        src={channel.logo}
                        name={channel.name}
                        category={channel.category}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                          {channel.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span className="text-cyan-400 font-semibold">{channel.category}</span>
                          <span>·</span>
                          <span>CH {channel.number}</span>
                          <span>·</span>
                          <span className="text-slate-300 font-bold">{channel.resolution}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        LIVE
                      </span>
                      {onToggleFavorite && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(channel.id);
                          }}
                          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Playing Now Program Card */}
                  <div className="p-3 bg-black/40 border border-white/[0.05] rounded-xl space-y-2 mb-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 truncate pr-2">
                        {channel.currentProgram?.title ?? 'Schedule unavailable'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(0, channel.currentProgram?.progressPercentage ?? 0)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{channel.currentProgram.startTime}</span>
                      <span className="text-slate-500">Playing Now</span>
                      <span>Ends {channel.currentProgram.endTime}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                  <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                    Up next: {channel.nextProgram?.title ?? 'Schedule unavailable'}
                  </span>
                  <span className="text-xs font-bold text-cyan-400 group-hover:text-cyan-300 flex items-center gap-1 group-hover:translate-x-0.5 transition-all">
                    <Play className="w-3 h-3 fill-cyan-400" />
                    <span>Watch</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {channels.length > 0 && (
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight font-display flex items-center gap-2">
                <span>More Live Channels</span>
              </h2>
              <p className="text-xs text-slate-400">
                Additional channels grouped by provider-supplied category.
              </p>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            {categoryFilters.map((cat) => {
              const Icon = cat.icon;
              const isSelected = popularCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setPopularCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/[0.06] hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Popular Channels Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {popularChannels.map((channel) => {
            const isFav = favorites.includes(channel.id);

            return (
              <div
                key={channel.id}
                onClick={() => onWatchChannel(channel)}
                className="group relative overflow-hidden bg-gradient-to-br from-[#151c34] via-[#0c1326] to-[#080c18] border border-amber-300/20 hover:border-amber-300/60 rounded-2xl p-4 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2.5 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ChannelLogo
                        src={channel.logo}
                        name={channel.name}
                        category={channel.category}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                          {channel.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                          {channel.category} · CH {channel.number}
                        </div>
                      </div>
                    </div>

                    <span className="px-2 py-1 rounded-full text-[9px] font-black tracking-wider bg-amber-300/10 text-amber-200 border border-amber-200/25 shrink-0">
                      {channel.resolution}
                    </span>
                  </div>

                  <div className="p-3 bg-black/30 border border-white/[0.06] rounded-xl text-xs space-y-1 mb-3">
                    <div className="font-semibold text-slate-200 truncate text-[11px]">
                      {channel.currentProgram.title}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {channel.currentProgram.synopsis}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-[10px] font-mono">
                  <span className="text-amber-200/80 flex items-center gap-1 font-semibold">
                    <Sparkles className="w-3 h-3" />
                    <span>{channel.resolution}</span>
                  </span>
                  <span className="font-sans font-bold text-white group-hover:text-amber-300 flex items-center gap-1">
                    <Play className="w-3 h-3 fill-current" />
                    <span>Watch</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      )}

      {/* ========================================================
          SECTION 3: TRENDING MOVIES
          ======================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight font-display">
              Movies from your provider
            </h2>
          </div>
          <button
            onClick={() => onNavigateSection('movies')}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 transition-colors"
          >
            <span>Explore Movies</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
          {(movies || []).map((movie) => {
            if (!movie) return null;
            const inList = isItemInMyList(movie?.title || '');
            return (
              <div
                key={movie.id}
                onClick={() => onWatchMovie(movie)}
                className="group relative bg-[#0c1326]/60 border border-white/[0.08] hover:border-cyan-500/40 rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] shadow-lg shadow-black/40"
              >
                <div className="aspect-[2/3] w-full overflow-hidden bg-slate-950 relative">
                  <img
                    src={movie.poster}
                    alt={movie?.title || ''}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050811] via-transparent to-transparent opacity-80" />

                  {/* Rating Tag */}
                  <div className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/10">
                    {movie.rating}
                  </div>

                  <div className="absolute top-2.5 right-2.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMyList(movie?.title || '');
                      }}
                      className="p-1.5 rounded-md bg-black/60 hover:bg-cyan-500 text-white backdrop-blur-md transition-colors"
                      title="Add to My List"
                    >
                      {inList ? <Check className="w-3 h-3 text-cyan-300" /> : <Plus className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="p-3">
                  <div className="text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                    {movie?.title || ''}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                    <span>{movie.year}</span>
                    <span>·</span>
                    <span>{movie.duration}</span>
                    <span>·</span>
                    <span className="text-cyan-400">{movie.genres[0]}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {movies.length === 0 && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 py-5">
            <div className="flex items-center gap-3">
              <Film className="h-5 w-5 shrink-0 text-amber-300" />
              <div>
                <div className="text-sm font-semibold text-slate-200">Movie catalog awaiting provider connection</div>
                <p className="mt-1 text-xs text-slate-500">Only provider-supplied titles and artwork will appear here.</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ========================================================
          SECTION 4: POPULAR SERIES & SHOWS
          ======================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight font-display">
              Series from your provider
            </h2>
          </div>
          <button
            onClick={() => onNavigateSection('series')}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 transition-colors"
          >
            <span>View Series Catalog</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {series.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectSeries(item)}
              className="group relative bg-[#0c1326]/70 hover:bg-[#111b33] border border-white/[0.08] hover:border-cyan-500/40 rounded-xl overflow-hidden cursor-pointer transition-all flex flex-col sm:flex-row shadow-lg shadow-black/40"
            >
              <div className="sm:w-48 aspect-[16/9] sm:aspect-auto shrink-0 overflow-hidden relative">
                <img
                  src={item.backdrop}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0c1326] hidden sm:block" />
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[11px] text-cyan-400 font-semibold mb-1">
                    <span>{item.rating}</span>
                    <span>·</span>
                    <span>{item.seasonCount} Season(s)</span>
                    <span>·</span>
                    <span>{item.genres.join(', ')}</span>
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {item.seasons[0]?.episodes.length || 0} Episodes available
                  </span>
                  <span className="text-xs font-bold text-white group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    <span>Episodes</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {series.length === 0 && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 py-5">
            <div className="flex items-center gap-3">
              <Tv className="h-5 w-5 shrink-0 text-amber-300" />
              <div>
                <div className="text-sm font-semibold text-slate-200">Series catalog awaiting provider connection</div>
                <p className="mt-1 text-xs text-slate-500">Episodes and artwork will appear when a secure VOD catalog is configured.</p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
