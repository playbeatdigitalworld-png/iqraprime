import { useState, useEffect, useCallback, useMemo } from 'react';
import { Playlist, Channel, Category, FilterOptions } from '../types/iptv';
import { DEFAULT_PLAYLISTS } from '../data/defaultPlaylists';
import { DEFAULT_PREMIUM_CATEGORIES } from '../data/categories';
import { parseM3U } from '../utils/m3uParser';
import { findDuplicates, deduplicateChannels } from '../utils/duplicateDetector';

const STORAGE_KEY = 'iptv_studio_playlists_v2';
const ACTIVE_ID_KEY = 'iptv_studio_active_id_v2';

export function useIPTV() {
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading playlists from localStorage:', e);
    }
    return DEFAULT_PLAYLISTS;
  });

  const [activePlaylistId, setActivePlaylistId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_ID_KEY);
      if (saved && playlists.some((p) => p.id === saved)) {
        return saved;
      }
    } catch (e) {}
    return playlists[0]?.id || DEFAULT_PLAYLISTS[0].id;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Save to localStorage whenever playlists change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
    } catch (e) {
      console.error('Failed to save playlists to localStorage:', e);
    }
  }, [playlists]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_ID_KEY, activePlaylistId);
    } catch (e) {}
  }, [activePlaylistId]);

  const activePlaylist = useMemo(() => {
    return playlists.find((p) => p.id === activePlaylistId) || playlists[0] || DEFAULT_PLAYLISTS[0];
  }, [playlists, activePlaylistId]);

  // Duplicate analysis for active playlist
  const duplicateInfo = useMemo(() => {
    if (!activePlaylist) return { groups: [], duplicateChannelIds: new Set<string>(), totalDuplicates: 0 };
    return findDuplicates(activePlaylist.channels);
  }, [activePlaylist]);

  // Playlist Management
  const createPlaylist = useCallback((data: { name: string; description?: string; sourceUrl?: string; sourceType: Playlist['sourceType'] }) => {
    const newPlaylist: Playlist = {
      id: `pl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: data.name,
      description: data.description,
      sourceType: data.sourceType,
      sourceUrl: data.sourceUrl,
      status: 'active',
      lastUpdated: new Date().toISOString(),
      channels: [],
      categories: [...DEFAULT_PREMIUM_CATEGORIES],
    };

    setPlaylists((prev) => [newPlaylist, ...prev]);
    setActivePlaylistId(newPlaylist.id);
    return newPlaylist;
  }, []);

  const updatePlaylist = useCallback((id: string, updates: Partial<Playlist>) => {
    setPlaylists((prev) =>
      prev.map((pl) => (pl.id === id ? { ...pl, ...updates, lastUpdated: new Date().toISOString() } : pl))
    );
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    setPlaylists((prev) => {
      const filtered = prev.filter((pl) => pl.id !== id);
      if (filtered.length === 0) {
        return DEFAULT_PLAYLISTS;
      }
      return filtered;
    });
    setActivePlaylistId((curr) => {
      if (curr === id) {
        const remaining = playlists.filter((pl) => pl.id !== id);
        return remaining[0]?.id || DEFAULT_PLAYLISTS[0].id;
      }
      return curr;
    });
  }, [playlists]);

  const duplicatePlaylist = useCallback((id: string) => {
    const target = playlists.find((p) => p.id === id);
    if (!target) return;

    const cloned: Playlist = {
      ...target,
      id: `pl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: `${target.name} (Copy)`,
      lastUpdated: new Date().toISOString(),
      channels: target.channels.map((ch) => ({
        ...ch,
        id: `ch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      })),
      categories: [...target.categories],
    };

    setPlaylists((prev) => [cloned, ...prev]);
    setActivePlaylistId(cloned.id);
  }, [playlists]);

  // Import M3U Text
  const importPlaylistContent = useCallback(
    (name: string, m3uContent: string, sourceUrl?: string, replaceCurrent: boolean = false) => {
      const parsed = parseM3U(m3uContent, name, sourceUrl);
      
      if (replaceCurrent && activePlaylist) {
        updatePlaylist(activePlaylist.id, {
          channels: parsed.channels,
          categories: parsed.categories,
          sourceUrl: sourceUrl || activePlaylist.sourceUrl,
          lastUpdated: new Date().toISOString(),
        });
        return activePlaylist.id;
      }

      const newId = `pl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newPlaylist: Playlist = {
        id: newId,
        name,
        description: `Imported with ${parsed.channels.length} channels across ${parsed.categories.length} categories`,
        sourceType: sourceUrl ? 'url' : 'file',
        sourceUrl,
        status: 'active',
        lastUpdated: new Date().toISOString(),
        channels: parsed.channels,
        categories: parsed.categories,
      };

      setPlaylists((prev) => [newPlaylist, ...prev]);
      setActivePlaylistId(newId);
      return newId;
    },
    [activePlaylist, updatePlaylist]
  );

  // Refresh playlist from its URL
  const refreshPlaylistFromUrl = useCallback(
    async (playlistId: string): Promise<{ success: boolean; message: string }> => {
      const playlist = playlists.find((p) => p.id === playlistId);
      if (!playlist || !playlist.sourceUrl) {
        return { success: false, message: 'Playlist has no remote URL configured' };
      }

      setIsLoading(true);
      setSyncStatus(`Syncing with ${playlist.sourceUrl}...`);

      try {
        // Attempt fetch via our backend proxy first to avoid CORS & mixed-content issues
        let response: Response;
        try {
          response = await fetch(`/api/fetch-playlist?url=${encodeURIComponent(playlist.sourceUrl)}`);
        } catch (proxyErr) {
          // Fallback to direct fetch
          response = await fetch(playlist.sourceUrl);
        }

        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }

        const text = await response.text();
        if (!text || (!text.includes('#EXTM3U') && !text.includes('#EXTINF'))) {
          throw new Error('Received content is not a valid M3U/M3U8 playlist');
        }

        const parsed = parseM3U(text, playlist.name, playlist.sourceUrl);
        updatePlaylist(playlistId, {
          channels: parsed.channels,
          categories: parsed.categories,
          status: 'active',
          lastUpdated: new Date().toISOString(),
        });

        setIsLoading(false);
        setSyncStatus(null);
        return {
          success: true,
          message: `Successfully synchronized ${parsed.channels.length} channels from remote gateway.`,
        };
      } catch (err: any) {
        setIsLoading(false);
        setSyncStatus(null);
        return {
          success: false,
          message: `Remote sync failed (${err?.message || 'Gateway unreachable'}). Kept current channels.`,
        };
      }
    },
    [playlists, updatePlaylist]
  );

  // Channel Operations on Active Playlist
  const addChannel = useCallback((channelData: Omit<Channel, 'id' | 'addedAt'>) => {
    const newChannel: Channel = {
      ...channelData,
      id: `ch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      addedAt: new Date().toISOString(),
    };

    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== activePlaylistId) return pl;
        return {
          ...pl,
          channels: [newChannel, ...pl.channels],
          lastUpdated: new Date().toISOString(),
        };
      })
    );
  }, [activePlaylistId]);

  const updateChannel = useCallback((channelId: string, updates: Partial<Channel>) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== activePlaylistId) return pl;
        return {
          ...pl,
          channels: pl.channels.map((c) => (c.id === channelId ? { ...c, ...updates } : c)),
          lastUpdated: new Date().toISOString(),
        };
      })
    );
  }, [activePlaylistId]);

  const deleteChannel = useCallback((channelId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== activePlaylistId) return pl;
        return {
          ...pl,
          channels: pl.channels.filter((c) => c.id !== channelId),
          lastUpdated: new Date().toISOString(),
        };
      })
    );
  }, [activePlaylistId]);

  const duplicateChannel = useCallback((channelId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== activePlaylistId) return pl;
        const target = pl.channels.find((c) => c.id === channelId);
        if (!target) return pl;

        const clone: Channel = {
          ...target,
          id: `ch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: `${target.name} (Copy)`,
          channelNumber: typeof target.channelNumber === 'number' ? target.channelNumber + 1 : `${target.channelNumber}-copy`,
          addedAt: new Date().toISOString(),
        };

        const idx = pl.channels.findIndex((c) => c.id === channelId);
        const newChannels = [...pl.channels];
        newChannels.splice(idx + 1, 0, clone);

        return {
          ...pl,
          channels: newChannels,
          lastUpdated: new Date().toISOString(),
        };
      })
    );
  }, [activePlaylistId]);

  // Batch Channel Actions
  const batchUpdateChannels = useCallback((channelIds: string[], updates: Partial<Channel>) => {
    const idSet = new Set(channelIds);
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== activePlaylistId) return pl;
        return {
          ...pl,
          channels: pl.channels.map((c) => (idSet.has(c.id) ? { ...c, ...updates } : c)),
          lastUpdated: new Date().toISOString(),
        };
      })
    );
  }, [activePlaylistId]);

  const batchDeleteChannels = useCallback((channelIds: string[]) => {
    const idSet = new Set(channelIds);
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== activePlaylistId) return pl;
        return {
          ...pl,
          channels: pl.channels.filter((c) => !idSet.has(c.id)),
          lastUpdated: new Date().toISOString(),
        };
      })
    );
  }, [activePlaylistId]);

  // Category Operations on Active Playlist
  const addCategory = useCallback((categoryData: Omit<Category, 'id' | 'order'>) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== activePlaylistId) return pl;
        const id = categoryData.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 24);
        const newCat: Category = {
          ...categoryData,
          id: `${id}-${Date.now().toString(36)}`,
          order: pl.categories.length + 1,
        };
        return {
          ...pl,
          categories: [...pl.categories, newCat],
          lastUpdated: new Date().toISOString(),
        };
      })
    );
  }, [activePlaylistId]);

  const updateCategory = useCallback((categoryId: string, updates: Partial<Category>) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== activePlaylistId) return pl;
        return {
          ...pl,
          categories: pl.categories.map((c) => (c.id === categoryId ? { ...c, ...updates } : c)),
          lastUpdated: new Date().toISOString(),
        };
      })
    );
  }, [activePlaylistId]);

  const deleteCategory = useCallback((categoryId: string, reassignToId: string = 'live-tv') => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== activePlaylistId) return pl;
        return {
          ...pl,
          categories: pl.categories.filter((c) => c.id !== categoryId),
          // Reassign channels in this category
          channels: pl.channels.map((ch) => (ch.category === categoryId ? { ...ch, category: reassignToId } : ch)),
          lastUpdated: new Date().toISOString(),
        };
      })
    );
  }, [activePlaylistId]);

  const reorderCategories = useCallback((newCategories: Category[]) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== activePlaylistId) return pl;
        const updated = newCategories.map((c, i) => ({ ...c, order: i + 1 }));
        return {
          ...pl,
          categories: updated,
          lastUpdated: new Date().toISOString(),
        };
      })
    );
  }, [activePlaylistId]);

  // Remove Duplicates in active playlist
  const resolveDuplicates = useCallback(() => {
    if (!activePlaylist) return 0;
    const { cleanedChannels, removedCount } = deduplicateChannels(activePlaylist.channels);
    setPlaylists((prev) =>
      prev.map((pl) => (pl.id === activePlaylistId ? { ...pl, channels: cleanedChannels, lastUpdated: new Date().toISOString() } : pl))
    );
    return removedCount;
  }, [activePlaylist, activePlaylistId]);

  const resetToDefaults = useCallback(() => {
    setPlaylists(DEFAULT_PLAYLISTS);
    setActivePlaylistId(DEFAULT_PLAYLISTS[0].id);
  }, []);

  return {
    playlists,
    activePlaylist,
    activePlaylistId,
    setActivePlaylistId,
    isLoading,
    syncStatus,
    duplicateInfo,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    duplicatePlaylist,
    importPlaylistContent,
    refreshPlaylistFromUrl,
    addChannel,
    updateChannel,
    deleteChannel,
    duplicateChannel,
    batchUpdateChannels,
    batchDeleteChannels,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    resolveDuplicates,
    resetToDefaults,
  };
}
