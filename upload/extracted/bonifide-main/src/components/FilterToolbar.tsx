import React from 'react';
import { 
  Search, 
  Filter, 
  X, 
  Star, 
  Heart, 
  Sparkles,
  SlidersHorizontal
} from 'lucide-react';
import { FilterOptions } from '../types/iptv';

interface FilterToolbarProps {
  filters: FilterOptions;
  countries: string[];
  languages: string[];
  totalChannels: number;
  filteredCount: number;
  onFilterChange: (updates: Partial<FilterOptions>) => void;
  onResetFilters: () => void;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  filters,
  countries,
  languages,
  totalChannels,
  filteredCount,
  onFilterChange,
  onResetFilters,
}) => {
  const isFiltered =
    filters.search !== '' ||
    filters.country !== 'all' ||
    filters.language !== 'all' ||
    filters.status !== 'all' ||
    filters.resolution !== 'all' ||
    filters.onlyFavorites ||
    filters.onlyFeatured;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-[#0e111c]/60 p-3.5 backdrop-blur-xl mb-4">
      {/* Top Row: Search Input & Quick Chips */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            placeholder="Search channels by name, stream URL, EPG ID, group..."
            className="w-full rounded-xl border border-white/10 bg-slate-900/90 py-2 pl-10 pr-10 text-xs text-white placeholder-slate-400 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Quick Filter Buttons */}
        <div className="flex items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center rounded-xl border border-white/10 bg-slate-900/80 p-0.5">
            <button
              onClick={() => onFilterChange({ status: 'all' })}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                filters.status === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => onFilterChange({ status: 'active' })}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                filters.status === 'active' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => onFilterChange({ status: 'offline' })}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                filters.status === 'offline' ? 'bg-rose-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Offline
            </button>
          </div>

          {/* Featured Filter */}
          <button
            onClick={() => onFilterChange({ onlyFeatured: !filters.onlyFeatured })}
            className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
              filters.onlyFeatured
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                : 'border-white/10 bg-slate-900/60 text-slate-400 hover:text-white'
            }`}
          >
            <Star className={`h-3.5 w-3.5 ${filters.onlyFeatured ? 'fill-amber-300 text-amber-300' : ''}`} />
            <span className="hidden sm:inline">VIP</span>
          </button>

          {/* Favorites Filter */}
          <button
            onClick={() => onFilterChange({ onlyFavorites: !filters.onlyFavorites })}
            className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
              filters.onlyFavorites
                ? 'border-rose-500/50 bg-rose-500/20 text-rose-300'
                : 'border-white/10 bg-slate-900/60 text-slate-400 hover:text-white'
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${filters.onlyFavorites ? 'fill-rose-300 text-rose-300' : ''}`} />
            <span className="hidden sm:inline">Favs</span>
          </button>
        </div>

      </div>

      {/* Bottom Row: Dropdown Selectors & Reset */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs">
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Country Selector */}
          <select
            value={filters.country}
            onChange={(e) => onFilterChange({ country: e.target.value })}
            className="rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 focus:border-amber-500/50 focus:outline-none cursor-pointer"
          >
            <option value="all">All Countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Language Selector */}
          <select
            value={filters.language}
            onChange={(e) => onFilterChange({ language: e.target.value })}
            className="rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 focus:border-amber-500/50 focus:outline-none cursor-pointer"
          >
            <option value="all">All Languages</option>
            {languages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          {/* Resolution Selector */}
          <select
            value={filters.resolution}
            onChange={(e) => onFilterChange({ resolution: e.target.value })}
            className="rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 focus:border-amber-500/50 focus:outline-none cursor-pointer"
          >
            <option value="all">All Qualities</option>
            <option value="4K HDR">4K HDR</option>
            <option value="4K UHD">4K UHD</option>
            <option value="FHD 1080p">FHD 1080p</option>
            <option value="HD 720p">HD 720p</option>
          </select>

          {/* Reset Filters */}
          {isFiltered && (
            <button
              onClick={onResetFilters}
              className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2 ml-1 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Counter */}
        <div className="text-[11px] text-slate-400 font-mono">
          Showing <span className="font-bold text-amber-400">{filteredCount}</span> of {totalChannels} channels
        </div>

      </div>
    </div>
  );
};
