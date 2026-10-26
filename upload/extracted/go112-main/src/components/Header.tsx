import React from 'react';
import { 
  Tv, 
  Radio, 
  Plus, 
  Upload, 
  Copy, 
  AlertTriangle, 
  Grid, 
  List, 
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  Cloud
} from 'lucide-react';
import { ViewMode } from '../types/iptv';

interface HeaderProps {
  serverHost?: string;
  totalChannels: number;
  duplicateCount: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenNewPlaylist: () => void;
  onOpenImport: () => void;
  onOpenAddChannel: () => void;
  onOpenDuplicates: () => void;
  onOpenCloudflare: () => void;
  isLoading?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  serverHost = 'playbeattv.buzz',
  totalChannels,
  duplicateCount,
  viewMode,
  onViewModeChange,
  onOpenNewPlaylist,
  onOpenImport,
  onOpenAddChannel,
  onOpenDuplicates,
  onOpenCloudflare,
  isLoading,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[#090b10]/90 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Brand & Server Gateway */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/30">
              <Tv className="h-5 w-5 text-slate-950 font-black" />
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-[#090b10]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-white">
                  IPTV <span className="bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">STUDIO PRO</span>
                </span>
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20 tracking-wider">
                  M3U8
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
                <span className="font-mono text-[11px] text-slate-300 truncate max-w-[190px] sm:max-w-xs">
                  {serverHost}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Cloudflare Worker Dashboard */}
          <button
            onClick={onOpenCloudflare}
            className="flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-2.5 py-1.5 text-xs font-semibold text-orange-300 hover:bg-orange-500/20 hover:border-orange-400/50 transition-all cursor-pointer shadow-sm"
            title="Open the Cloudflare Worker dashboard"
          >
            <Cloud className="h-3.5 w-3.5 text-orange-400" />
            <span className="hidden md:inline">Cloudflare Worker</span>
            <span className="md:hidden">Cloudflare</span>
          </button>

          {/* Duplicate Detection Alert Badge */}
          {duplicateCount > 0 && (
            <button
              onClick={onOpenDuplicates}
              className="group flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/50 transition-all cursor-pointer shadow-sm"
              title="Click to inspect and deduplicate channels"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>{duplicateCount} Dups</span>
            </button>
          )}

          {/* View Mode Toggle (Grid / List) */}
          <div className="hidden sm:flex items-center rounded-lg border border-white/10 bg-slate-900/60 p-0.5">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`rounded-md p-1.5 transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`rounded-md p-1.5 transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Dense List View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {/* Import M3U Button */}
          <button
            onClick={onOpenImport}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white hover:border-white/20 transition-all cursor-pointer shadow-sm"
          >
            <Upload className="h-3.5 w-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Import M3U</span>
            <span className="sm:hidden">Import</span>
          </button>

          {/* Add Channel Button */}
          <button
            onClick={onOpenAddChannel}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 hover:shadow-amber-500/30 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Add Channel</span>
          </button>

        </div>

      </div>
    </header>
  );
};
