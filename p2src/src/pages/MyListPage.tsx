import React, { useState } from 'react';
import type { Channel, Movie } from '../types/index.js';
import { useWatchlist } from '../context/WatchlistContext.js';
import { MediaCard } from '../components/common/MediaCard.js';
import { ChannelCard } from '../components/common/ChannelCard.js';
import { Bookmark, Film, Radio } from 'lucide-react';

interface MyListPageProps {
  movies: Movie[];
  channels: Channel[];
  onPlayMovie: (movie: Movie) => void;
  onPlayChannel: (channel: Channel) => void;
  onOpenDetails: (movie: Movie) => void;
  onNavigate: (tab: string) => void;
}

export const MyListPage: React.FC<MyListPageProps> = ({
  movies,
  channels,
  onPlayMovie,
  onPlayChannel,
  onOpenDetails,
  onNavigate,
}) => {
  const { watchlistIds } = useWatchlist();
  const [activeTab, setActiveTab] = useState<'all' | 'movies' | 'channels'>('all');

  const savedMovies = movies.filter((m) => watchlistIds.has(m.id));
  const savedChannels = channels.filter((c) => watchlistIds.has(c.id));

  const totalSaved = savedMovies.length + savedChannels.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 min-h-screen">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[#E5093A] uppercase tracking-wider">
            <Bookmark className="w-3.5 h-3.5" />
            <span>Universal Library</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
            My List & Favorites
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-xl">
            Your customized curation of verified films, classic features, and bookmarked live broadcasts.
          </p>
        </div>

        {/* Tab switcher */}
        {totalSaved > 0 && (
          <div className="flex items-center gap-1 bg-[#111A27] p-1.5 rounded-xl border border-white/5 text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'all' ? 'bg-[#E5093A] text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({totalSaved})
            </button>
            <button
              onClick={() => setActiveTab('movies')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'movies' ? 'bg-[#E5093A] text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              Films ({savedMovies.length})
            </button>
            <button
              onClick={() => setActiveTab('channels')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'channels' ? 'bg-[#E5093A] text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              Channels ({savedChannels.length})
            </button>
          </div>
        )}
      </div>

      {totalSaved === 0 ? (
        <div className="py-24 text-center bg-[#111A27]/30 rounded-2xl border border-white/5 p-8 max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[#E5093A]/10 border border-[#E5093A]/20 flex items-center justify-center mx-auto mb-4">
            <Bookmark className="w-6 h-6 text-[#E5093A]" />
          </div>
          <h3 className="text-lg font-bold text-white font-display">Your List is Currently Empty</h3>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Discover verified public domain cinema or favorite live channels by clicking the "+" button on any media card.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => onNavigate('movies')}
              className="px-5 py-2.5 rounded-xl bg-[#E5093A] hover:bg-[#B90732] text-white text-xs font-semibold shadow-lg transition-colors"
            >
              Explore Films
            </button>
            <button
              onClick={() => onNavigate('live-tv')}
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/10 transition-colors"
            >
              Browse Live TV
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Saved Channels Section */}
          {(activeTab === 'all' || activeTab === 'channels') && savedChannels.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Radio className="w-4 h-4 text-[#E5093A]" />
                <h2 className="text-lg font-bold text-white font-display">
                  Bookmarked Live Channels ({savedChannels.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {savedChannels.map((channel) => (
                  <ChannelCard
                    key={channel.id}
                    channel={channel}
                    onPlay={onPlayChannel}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Saved Movies Section */}
          {(activeTab === 'all' || activeTab === 'movies') && savedMovies.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Film className="w-4 h-4 text-[#E5093A]" />
                <h2 className="text-lg font-bold text-white font-display">
                  Saved Cinema & Masterpieces ({savedMovies.length})
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                {savedMovies.map((movie) => (
                  <MediaCard
                    key={movie.id}
                    movie={movie}
                    onPlay={onPlayMovie}
                    onOpenDetails={onOpenDetails}
                    aspectRatio="poster"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
