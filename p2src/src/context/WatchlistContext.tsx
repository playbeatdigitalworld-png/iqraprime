import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Channel, Movie, WatchProgress } from '../types/index.js';
import { api } from '../services/api.js';
import { useAuth } from './AuthContext.js';
import { useToast } from './ToastContext.js';

interface PlayerState {
  isOpen: boolean;
  movie?: Movie;
  channel?: Channel;
  mode: 'full' | 'trailer';
  startPosition?: number;
}

interface WatchlistContextType {
  watchlistIds: Set<string>;
  isInWatchlist: (id: string) => boolean;
  toggleWatchlist: (id: string, title?: string) => Promise<void>;
  continueWatching: WatchProgress[];
  recordProgress: (contentId: string, position: number, duration: number, isChannel?: boolean) => void;
  playerState: PlayerState;
  openPlayer: (media: { movie?: Movie; channel?: Channel; mode?: 'full' | 'trailer'; startPosition?: number }) => void;
  closePlayer: () => void;
  refreshWatchlist: () => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

export const WatchlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set(['mov-charade-1963', 'ch-dw-english', 'mov-tears-of-steel-2012']));
  const [continueWatching, setContinueWatching] = useState<WatchProgress[]>([]);
  const [playerState, setPlayerState] = useState<PlayerState>({
    isOpen: false,
    mode: 'full',
  });

  const loadData = useCallback(async () => {
    try {
      const [listRes, cwRes] = await Promise.all([
        api.getWatchlist(user?.id),
        api.getContinueWatching(user?.id),
      ]);
      const ids = new Set<string>();
      listRes.forEach((item) => {
        if (item.data) ids.add(item.data.id);
      });
      setWatchlistIds(ids);
      setContinueWatching(cwRes);
    } catch {
      // offline / demo fallback
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isInWatchlist = (id: string) => watchlistIds.has(id);

  const toggleWatchlist = async (id: string, title?: string) => {
    try {
      const res = await api.toggleWatchlist(id, user?.id);
      setWatchlistIds((prev) => {
        const next = new Set(prev);
        if (res.inList) {
          next.add(id);
          showToast(`Added ${title || 'title'} to My List`, 'success');
        } else {
          next.delete(id);
          showToast(`Removed from My List`, 'info');
        }
        return next;
      });
    } catch {
      // local fallback
      setWatchlistIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          showToast('Removed from My List', 'info');
        } else {
          next.add(id);
          showToast(`Added to My List`, 'success');
        }
        return next;
      });
    }
  };

  const recordProgress = (contentId: string, position: number, duration: number, isChannel = false) => {
    api.recordProgress({
      contentId,
      contentType: isChannel ? 'channel' : 'movie',
      positionSeconds: position,
      durationSeconds: duration,
      userId: user?.id,
    });

    setContinueWatching((prev) => {
      const existingIdx = prev.findIndex((p) => p.contentId === contentId);
      const updated: WatchProgress = {
        contentId,
        contentType: isChannel ? 'channel' : 'movie',
        positionSeconds: position,
        durationSeconds: duration,
        completed: position > 0 && duration > 0 && position / duration > 0.9,
        lastWatchedAt: new Date().toISOString(),
        title: playerState.channel?.channelName || playerState.movie?.title || 'Current Media',
        poster: playerState.channel?.logo || playerState.movie?.poster || '',
      };
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = updated;
        return next;
      }
      return [updated, ...prev];
    });
  };

  const openPlayer = (media: { movie?: Movie; channel?: Channel; mode?: 'full' | 'trailer'; startPosition?: number }) => {
    setPlayerState({
      isOpen: true,
      movie: media.movie,
      channel: media.channel,
      mode: media.mode || 'full',
      startPosition: media.startPosition,
    });
  };

  const closePlayer = () => {
    setPlayerState((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <WatchlistContext.Provider
      value={{
        watchlistIds,
        isInWatchlist,
        toggleWatchlist,
        continueWatching,
        recordProgress,
        playerState,
        openPlayer,
        closePlayer,
        refreshWatchlist: loadData,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
};

export const useWatchlist = () => {
  const context = useContext(WatchlistContext);
  if (!context) throw new Error('useWatchlist must be used within WatchlistProvider');
  return context;
};
