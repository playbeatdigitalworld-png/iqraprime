/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Tv, 
  Plus, 
  Upload, 
  AlertTriangle, 
  Grid, 
  List, 
  Search, 
  Filter, 
  Layers, 
  Download, 
  RefreshCw,
  FolderPlus,
  Play,
  RotateCcw,
  ShieldCheck,
  Film,
  Monitor,
} from 'lucide-react';
import { useIPTV } from './hooks/useIPTV';
import { Header } from './components/Header';
import { PlaylistSelector } from './components/PlaylistSelector';
import { CategorySidebar } from './components/CategorySidebar';
import { ChannelCard } from './components/ChannelCard';
import { ChannelList } from './components/ChannelList';
import { FilterToolbar } from './components/FilterToolbar';
import { BatchActionBar } from './components/BatchActionBar';
import { Pagination } from './components/Pagination';

// Domain Modals & Player
import { StreamPreviewModal } from './components/modals/StreamPreviewModal';
import { ChannelEditModal } from './components/modals/ChannelEditModal';
import { PlaylistModal } from './components/modals/PlaylistModal';
import { CategoryModal } from './components/modals/CategoryModal';
import { DuplicateManagerModal } from './components/modals/DuplicateManagerModal';
import { ExportModal } from './components/modals/ExportModal';
import { PlaylistEditModal } from './components/modals/PlaylistEditModal';
import { LivePlayerModal } from './components/player/LivePlayerModal';

// Consumer Portal
import { StreamingPortal } from './components/consumer/StreamingPortal';
import { ProviderAdmin } from './components/ProviderAdmin';
import { AuthProvider } from './context/AuthContext';

import { Channel, Category, FilterOptions, ViewMode } from './types/iptv';
import { ChannelRecord } from './types/database';

function AppContent() {
  const [appMode, setAppMode] = useState<'portal' | 'studio'>('portal');
  const isProviderAdmin = window.location.pathname === '/admin';

  // Active channel playing in player modal
  const [activePlayerChannel, setActivePlayerChannel] = useState<ChannelRecord | null>(null);
  const [databaseChannels, setDatabaseChannels] = useState<ChannelRecord[]>([]);

  const {
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
  } = useIPTV();

  if (isProviderAdmin) return <ProviderAdmin />;

  // Studio View state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(48);

  // Filter state
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    categoryId: 'all',
    country: 'all',
    language: 'all',
    status: 'all',
    onlyFavorites: false,
    onlyFeatured: false,
    resolution: 'all',
  });

  // Studio Modals state
  const [previewChannel, setPreviewChannel] = useState<Channel | null>(null);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [channelToEdit, setChannelToEdit] = useState<Channel | null>(null);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPlaylistEditModalOpen, setIsPlaylistEditModalOpen] = useState(false);
  const [syncNotice, setSyncNotice] = useState<{ message: string; isError?: boolean } | null>(null);

  // Sync category filter with sidebar selection
  const handleSelectCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    setCurrentPage(1);
    if (catId === 'special-featured') {
      setFilters((prev) => ({ ...prev, onlyFeatured: true, onlyFavorites: false, categoryId: 'all' }));
    } else if (catId === 'special-favorites') {
      setFilters((prev) => ({ ...prev, onlyFavorites: true, onlyFeatured: false, categoryId: 'all' }));
    } else {
      setFilters((prev) => ({ ...prev, categoryId: catId, onlyFavorites: false, onlyFeatured: false }));
    }
  };

  // Distinct countries and languages for filters
  const { countries, languages } = useMemo(() => {
    const cSet = new Set<string>();
    const lSet = new Set<string>();
    activePlaylist.channels.forEach((ch) => {
      if (ch.country) cSet.add(ch.country);
      if (ch.language) lSet.add(ch.language);
    });
    return {
      countries: Array.from(cSet).sort(),
      languages: Array.from(lSet).sort(),
    };
  }, [activePlaylist.channels]);

  // Filtered channel list
  const filteredChannels = useMemo(() => {
    return activePlaylist.channels.filter((ch) => {
      if (filters.categoryId !== 'all' && ch.category !== filters.categoryId) return false;
      if (filters.onlyFavorites && !ch.isFavorite) return false;
      if (filters.onlyFeatured && !ch.isFeatured) return false;
      if (filters.status !== 'all' && ch.status !== filters.status) return false;
      if (filters.country !== 'all' && ch.country !== filters.country) return false;
      if (filters.language !== 'all' && ch.language !== filters.language) return false;
      if (filters.resolution !== 'all' && ch.resolution !== filters.resolution) return false;

      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matchName = ch.name.toLowerCase().includes(query);
        const matchUrl = ch.streamUrl.toLowerCase().includes(query);
        const matchEpg = ch.epgId.toLowerCase().includes(query);
        const matchChno = String(ch.channelNumber).includes(query);
        if (!matchName && !matchUrl && !matchEpg && !matchChno) return false;
      }

      return true;
    });
  }, [activePlaylist.channels, filters]);

  // Paginated channels slice for 60fps high performance even with 13,000+ channels
  const paginatedChannels = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredChannels.slice(start, start + pageSize);
  }, [filteredChannels, currentPage, pageSize]);

  // Category map
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    activePlaylist.categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [activePlaylist.categories]);

  // Multi-selection handlers
  const handleSelectChannel = (channelId: string, selected: boolean) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(channelId);
      else next.delete(channelId);
      return next;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedChannelIds(new Set(filteredChannels.map((c) => c.id)));
    } else {
      setSelectedChannelIds(new Set());
    }
  };

  // Reorder category
  const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
    const newCategories = [...activePlaylist.categories];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newCategories.length) return;

    const [moved] = newCategories.splice(index, 1);
    newCategories.splice(targetIdx, 0, moved);
    reorderCategories(newCategories);
  };

  const handleDropChannelToCategory = (channelId: string, targetCategoryId: string) => {
    updateChannel(channelId, { category: targetCategoryId });
  };

  const handleRefresh = async () => {
    const res = await refreshPlaylistFromUrl(activePlaylist.id);
    setSyncNotice({ message: res.message, isError: !res.success });
    setTimeout(() => setSyncNotice(null), 5000);
  };

  const handlePlayStudioChannel = (ch: Channel) => {
    setActivePlayerChannel({
      id: ch.id,
      name: ch.name,
      officialName: ch.name,
      category: ch.category,
      logo: ch.logo,
      streamUrl: ch.streamUrl,
      epgChannelId: ch.epgId,
    });
  };

  return (
    <div className="min-h-screen bg-[#07090f] text-slate-100 flex flex-col font-sans">
      
      {/* Top System Mode Switcher */}
      <div className="border-b border-white/5 bg-[#090b14] px-4 py-2 text-xs flex items-center justify-between">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setAppMode('portal')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-bold transition-colors cursor-pointer ${
              appMode === 'portal'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Play className="h-3 w-3 fill-current" />
            <span>Streaming Service Portal</span>
          </button>

          <button
            onClick={() => setAppMode('studio')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-bold transition-colors cursor-pointer ${
              appMode === 'studio'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="h-3 w-3" />
            <span>Playlist & Category Studio</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <a href="/admin" className="text-[11px] font-mono text-amber-300 hover:text-amber-200">
            Provider settings
          </a>
          <a
            className="text-[11px] font-mono text-slate-400 hover:text-white"
            href="https://dash.cloudflare.com/1f230ccf421d89de0f68562cd4dfc251/workers/services/view/new-ne222/production"
            target="_blank"
            rel="noreferrer"
          >
            Worker & DNS
          </a>
        </div>
      </div>

      {/* MODE 1: CUSTOMER STREAMING PORTAL */}
      {appMode === 'portal' && (
        <StreamingPortal
          onWatchChannel={(ch) => setActivePlayerChannel(ch)}
          onChannelsLoaded={setDatabaseChannels}
        />
      )}

      {/* MODE 2: PLAYLIST & CATEGORY STUDIO */}
      {appMode === 'studio' && (
        <>
          <Header
            serverHost={activePlaylist.serverHost || 'playbeattv.buzz'}
            totalChannels={activePlaylist.channels.length}
            duplicateCount={duplicateInfo.totalDuplicates}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onOpenNewPlaylist={() => setIsPlaylistModalOpen(true)}
            onOpenImport={() => setIsPlaylistModalOpen(true)}
            onOpenAddChannel={() => {
              setChannelToEdit(null);
              setIsChannelModalOpen(true);
            }}
            onOpenDuplicates={() => setIsDuplicateModalOpen(true)}
            onOpenCloudflare={() => window.open('https://dash.cloudflare.com/1f230ccf421d89de0f68562da95f005d/workers/services/view/new-ne222/production', '_blank', 'noopener,noreferrer')}
            isLoading={isLoading}
          />

          <PlaylistSelector
            playlists={playlists}
            activePlaylist={activePlaylist}
            onSelectPlaylist={setActivePlaylistId}
            onNewPlaylist={() => setIsPlaylistModalOpen(true)}
            onEditPlaylist={() => setIsPlaylistEditModalOpen(true)}
            onRefreshPlaylist={handleRefresh}
            onExportPlaylist={() => setIsExportModalOpen(true)}
            onDuplicatePlaylist={() => duplicatePlaylist(activePlaylist.id)}
            onDeletePlaylist={() => deletePlaylist(activePlaylist.id)}
            isSyncing={isLoading}
          />

          {/* Sync Status Banner */}
          {(syncStatus || syncNotice) && (
            <div className={`px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2 ${
              syncNotice?.isError ? 'bg-rose-500/20 text-rose-300 border-b border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border-b border-amber-500/30'
            }`}>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>{syncStatus || syncNotice?.message}</span>
            </div>
          )}

          <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-7xl w-full mx-auto">
            <CategorySidebar
              categories={activePlaylist.categories}
              channels={activePlaylist.channels}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={handleSelectCategory}
              onAddCategory={() => {
                setCategoryToEdit(null);
                setIsCategoryModalOpen(true);
              }}
              onEditCategory={(cat) => {
                setCategoryToEdit(cat);
                setIsCategoryModalOpen(true);
              }}
              onDeleteCategory={(catId) => deleteCategory(catId)}
              onMoveCategory={handleMoveCategory}
              onDropChannelToCategory={handleDropChannelToCategory}
            />

            <main className="flex-1 flex flex-col min-w-0 p-4 sm:p-6 overflow-y-auto custom-scrollbar">
              <FilterToolbar
                filters={filters}
                countries={countries}
                languages={languages}
                totalChannels={activePlaylist.channels.length}
                filteredCount={filteredChannels.length}
                onFilterChange={(updates) => {
                  setFilters((prev) => ({ ...prev, ...updates }));
                  setCurrentPage(1);
                }}
                onResetFilters={() => {
                  setFilters({
                    search: '',
                    categoryId: 'all',
                    country: 'all',
                    language: 'all',
                    status: 'all',
                    onlyFavorites: false,
                    onlyFeatured: false,
                    resolution: 'all',
                  });
                  setCurrentPage(1);
                }}
              />

              {/* Duplicate Banner Alert */}
              {duplicateInfo.totalDuplicates > 0 && (
                <div className="mb-4 flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 backdrop-blur-xl">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <span className="text-xs text-amber-200">
                      <strong className="text-amber-300">{duplicateInfo.totalDuplicates} duplicate streams</strong> detected in this playlist.
                    </span>
                  </div>
                  <button
                    onClick={() => setIsDuplicateModalOpen(true)}
                    className="rounded-xl bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
                  >
                    Inspect & Deduplicate
                  </button>
                </div>
              )}

              {/* Channel Cards / List */}
              {viewMode === 'grid' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {paginatedChannels.map((channel) => (
                      <ChannelCard
                        key={channel.id}
                        channel={channel}
                        category={categoryMap.get(channel.category)}
                        isSelected={selectedChannelIds.has(channel.id)}
                        isDuplicate={duplicateInfo.duplicateChannelIds.has(channel.id)}
                        onSelect={handleSelectChannel}
                        onPreview={() => handlePlayStudioChannel(channel)}
                        onEdit={(ch) => {
                          setChannelToEdit(ch);
                          setIsChannelModalOpen(true);
                        }}
                        onDuplicate={(id) => duplicateChannel(id)}
                        onDelete={(id) => deleteChannel(id)}
                        onToggleFavorite={(id) => {
                          const ch = activePlaylist.channels.find((c) => c.id === id);
                          if (ch) updateChannel(id, { isFavorite: !ch.isFavorite });
                        }}
                        onToggleFeatured={(id) => {
                          const ch = activePlaylist.channels.find((c) => c.id === id);
                          if (ch) updateChannel(id, { isFeatured: !ch.isFeatured });
                        }}
                        onToggleStatus={(id) => {
                          const ch = activePlaylist.channels.find((c) => c.id === id);
                          if (ch) updateChannel(id, { status: ch.status === 'active' ? 'offline' : 'active' });
                        }}
                      />
                    ))}
                  </div>

                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredChannels.length}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                  />
                </>
              ) : (
                <>
                  <ChannelList
                    channels={paginatedChannels}
                    categories={activePlaylist.categories}
                    selectedChannelIds={selectedChannelIds}
                    duplicateIds={duplicateInfo.duplicateChannelIds}
                    onSelectChannel={handleSelectChannel}
                    onSelectAll={handleSelectAll}
                    onPreview={() => handlePlayStudioChannel(channelToEdit || paginatedChannels[0])}
                    onEdit={(ch) => {
                      setChannelToEdit(ch);
                      setIsChannelModalOpen(true);
                    }}
                    onDuplicate={(id) => duplicateChannel(id)}
                    onDelete={(id) => deleteChannel(id)}
                    onToggleFavorite={(id) => {
                      const ch = activePlaylist.channels.find((c) => c.id === id);
                      if (ch) updateChannel(id, { isFavorite: !ch.isFavorite });
                    }}
                    onToggleFeatured={(id) => {
                      const ch = activePlaylist.channels.find((c) => c.id === id);
                      if (ch) updateChannel(id, { isFeatured: !ch.isFeatured });
                    }}
                    onToggleStatus={(id) => {
                      const ch = activePlaylist.channels.find((c) => c.id === id);
                      if (ch) updateChannel(id, { status: ch.status === 'active' ? 'offline' : 'active' });
                    }}
                  />

                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredChannels.length}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                  />
                </>
              )}
            </main>
          </div>

          <BatchActionBar
            selectedCount={selectedChannelIds.size}
            categories={activePlaylist.categories}
            onMoveToCategory={(targetCatId) => {
              batchUpdateChannels(Array.from(selectedChannelIds), { category: targetCatId });
              setSelectedChannelIds(new Set());
            }}
            onSetStatus={(status) => {
              batchUpdateChannels(Array.from(selectedChannelIds), { status });
              setSelectedChannelIds(new Set());
            }}
            onToggleFeatured={(isFeatured) => {
              batchUpdateChannels(Array.from(selectedChannelIds), { isFeatured });
              setSelectedChannelIds(new Set());
            }}
            onToggleFavorite={(isFavorite) => {
              batchUpdateChannels(Array.from(selectedChannelIds), { isFavorite });
              setSelectedChannelIds(new Set());
            }}
            onDeleteSelected={() => {
              batchDeleteChannels(Array.from(selectedChannelIds));
              setSelectedChannelIds(new Set());
            }}
            onClearSelection={() => setSelectedChannelIds(new Set())}
          />
        </>
      )}

      {/* Production HTML5 Video Player Modal (Triggered across all modes) */}
      <LivePlayerModal
        channel={activePlayerChannel}
        channelsList={databaseChannels}
        isOpen={Boolean(activePlayerChannel)}
        onClose={() => setActivePlayerChannel(null)}
        onSelectChannel={(ch) => setActivePlayerChannel(ch)}
      />

      {/* Modals for Studio View */}
      <ChannelEditModal
        channel={channelToEdit}
        categories={activePlaylist.categories}
        isOpen={isChannelModalOpen}
        onClose={() => {
          setIsChannelModalOpen(false);
          setChannelToEdit(null);
        }}
        onSave={(data) => {
          if (channelToEdit) {
            updateChannel(channelToEdit.id, data);
          } else {
            addChannel(data);
          }
        }}
      />

      <PlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        onImportContent={(name, content, sourceUrl) => {
          importPlaylistContent(name, content, sourceUrl);
        }}
        onCreateEmpty={(data) => {
          createPlaylist(data);
        }}
      />

      <PlaylistEditModal
        playlist={activePlaylist}
        isOpen={isPlaylistEditModalOpen}
        onClose={() => setIsPlaylistEditModalOpen(false)}
        onSave={(updates) => updatePlaylist(activePlaylist.id, updates)}
      />

      <CategoryModal
        category={categoryToEdit}
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setCategoryToEdit(null);
        }}
        onSave={(data) => {
          if (categoryToEdit) {
            updateCategory(categoryToEdit.id, data);
          } else {
            addCategory(data);
          }
        }}
      />

      <DuplicateManagerModal
        groups={duplicateInfo.groups}
        totalDuplicates={duplicateInfo.totalDuplicates}
        categories={activePlaylist.categories}
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        onDeleteChannel={(id) => deleteChannel(id)}
        onResolveAll={() => resolveDuplicates()}
      />

      <ExportModal
        playlist={activePlaylist}
        categories={activePlaylist.categories}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
