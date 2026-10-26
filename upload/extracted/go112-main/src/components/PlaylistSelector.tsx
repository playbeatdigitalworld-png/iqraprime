import React, { useState } from 'react';
import { 
  Folder, 
  ChevronDown, 
  Plus, 
  RefreshCw, 
  Download, 
  Copy, 
  Trash2, 
  Edit3, 
  ExternalLink,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Playlist } from '../types/iptv';

interface PlaylistSelectorProps {
  playlists: Playlist[];
  activePlaylist: Playlist;
  onSelectPlaylist: (id: string) => void;
  onNewPlaylist: () => void;
  onEditPlaylist: () => void;
  onRefreshPlaylist: () => void;
  onExportPlaylist: () => void;
  onDuplicatePlaylist: () => void;
  onDeletePlaylist: () => void;
  isSyncing?: boolean;
}

export const PlaylistSelector: React.FC<PlaylistSelectorProps> = ({
  playlists,
  activePlaylist,
  onSelectPlaylist,
  onNewPlaylist,
  onEditPlaylist,
  onRefreshPlaylist,
  onExportPlaylist,
  onDuplicatePlaylist,
  onDeletePlaylist,
  isSyncing,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const activeChannelsCount = activePlaylist.channels.filter((c) => c.status === 'active').length;
  const offlineChannelsCount = activePlaylist.channels.length - activeChannelsCount;

  return (
    <div className="relative border-b border-white/5 bg-[#0c0f18]/90 px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        
        {/* Left: Playlist Selector Dropdown */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-slate-900/90 px-3.5 py-2 text-left text-sm font-semibold text-white shadow-inner hover:border-amber-500/40 hover:bg-slate-800/90 transition-all cursor-pointer min-w-[240px] sm:min-w-[280px]"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                <Folder className="h-4 w-4" />
              </div>
              <div className="flex-1 truncate">
                <div className="truncate text-xs font-bold text-white">{activePlaylist.name}</div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                  <span>{activePlaylist.channels.length} channels</span>
                  <span>•</span>
                  <span>{activePlaylist.categories.length} groups</span>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                <div className="absolute left-0 mt-2 z-50 w-72 rounded-xl border border-white/10 bg-[#0f1322] p-1.5 shadow-2xl backdrop-blur-2xl ring-1 ring-black/50">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Your Playlists ({playlists.length})
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1 py-1">
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        onClick={() => {
                          onSelectPlaylist(pl.id);
                          setIsOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                          pl.id === activePlaylist.id
                            ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="truncate font-medium">{pl.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {pl.channels.length} ch • {pl.categories.length} cat
                          </div>
                        </div>
                        {pl.id === activePlaylist.id && (
                          <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-white/5 pt-1.5 mt-1">
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onNewPlaylist();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      Create New Playlist
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="hidden lg:flex items-center gap-3 text-xs border-l border-white/10 pl-3">
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>{activeChannelsCount} Active</span>
            </div>
            {offlineChannelsCount > 0 && (
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span>{offlineChannelsCount} Offline</span>
              </div>
            )}
            <div className="text-slate-500">|</div>
            <div className="text-[11px] text-slate-400">
              Updated: {new Date(activePlaylist.lastUpdated).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Right: Playlist Operations Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          
          {/* Refresh / Sync URL */}
          {activePlaylist.sourceUrl && (
            <button
              onClick={onRefreshPlaylist}
              disabled={isSyncing}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800/70 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-all cursor-pointer disabled:opacity-50"
              title="Refresh / Sync with remote M3U URL"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Sync Remote</span>
            </button>
          )}

          {/* Edit Playlist Details */}
          <button
            onClick={onEditPlaylist}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800/70 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-all cursor-pointer"
            title="Edit Playlist Name & Source"
          >
            <Edit3 className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">Edit</span>
          </button>

          {/* Export Playlist */}
          <button
            onClick={onExportPlaylist}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800/70 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-all cursor-pointer"
            title="Export M3U / M3U8 / JSON"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            <span>Export</span>
          </button>

          {/* Duplicate Playlist */}
          <button
            onClick={onDuplicatePlaylist}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800/70 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-all cursor-pointer"
            title="Duplicate Playlist"
          >
            <Copy className="h-3.5 w-3.5 text-purple-400" />
            <span className="hidden md:inline">Duplicate</span>
          </button>

          {/* Delete Playlist (only if more than 1) */}
          {playlists.length > 1 && (
            <button
              onClick={onDeletePlaylist}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer"
              title="Delete Playlist"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
            </button>
          )}

        </div>

      </div>
    </div>
  );
};
