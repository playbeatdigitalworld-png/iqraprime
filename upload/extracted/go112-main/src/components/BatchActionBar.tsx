import React, { useState } from 'react';
import { 
  CheckSquare, 
  FolderInput, 
  Trash2, 
  Star, 
  Heart, 
  Radio, 
  X,
  ChevronDown
} from 'lucide-react';
import { Category } from '../types/iptv';

interface BatchActionBarProps {
  selectedCount: number;
  categories: Category[];
  onMoveToCategory: (categoryId: string) => void;
  onSetStatus: (status: 'active' | 'offline') => void;
  onToggleFeatured: (featured: boolean) => void;
  onToggleFavorite: (favorite: boolean) => void;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedCount,
  categories,
  onMoveToCategory,
  onSetStatus,
  onToggleFeatured,
  onToggleFavorite,
  onDeleteSelected,
  onClearSelection,
}) => {
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-[#0e1220]/95 px-4 py-2.5 shadow-2xl backdrop-blur-2xl ring-1 ring-amber-500/20 max-w-2xl w-[92%] sm:w-auto overflow-x-auto">
      
      {/* Selected Counter & Deselect */}
      <div className="flex items-center gap-2 pr-3 border-r border-white/10 shrink-0">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500 text-slate-950 font-extrabold text-xs">
          {selectedCount}
        </span>
        <span className="text-xs font-semibold text-white whitespace-nowrap">Selected</span>
        <button
          onClick={onClearSelection}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/5"
          title="Clear Selection"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Batch Move Category */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowCategoryMenu(!showCategoryMenu)}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all cursor-pointer"
        >
          <FolderInput className="h-3.5 w-3.5 text-amber-400" />
          <span>Move Category</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>

        {showCategoryMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowCategoryMenu(false)} />
            <div className="absolute left-0 bottom-10 z-50 w-56 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-[#0f1322] p-1.5 shadow-2xl backdrop-blur-xl">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Select Destination Category
              </div>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    onMoveToCategory(cat.id);
                    setShowCategoryMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <span>{cat.icon}</span>
                  <span className="truncate">{cat.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Batch Active / Offline */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onSetStatus('active')}
          className="flex items-center gap-1 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-all cursor-pointer"
        >
          <Radio className="h-3 w-3 text-emerald-400" />
          <span>Active</span>
        </button>
        <button
          onClick={() => onSetStatus('offline')}
          className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-all cursor-pointer"
        >
          <span>Offline</span>
        </button>
      </div>

      {/* Batch Featured & Favorite */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onToggleFeatured(true)}
          className="p-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer"
          title="Mark as Featured"
        >
          <Star className="h-3.5 w-3.5 fill-amber-300" />
        </button>
        <button
          onClick={() => onToggleFavorite(true)}
          className="p-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer"
          title="Mark as Favorite"
        >
          <Heart className="h-3.5 w-3.5 fill-rose-300" />
        </button>
      </div>

      {/* Batch Delete */}
      <div className="shrink-0 pl-1 border-l border-white/10">
        <button
          onClick={onDeleteSelected}
          className="flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/25 transition-all cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Delete</span>
        </button>
      </div>

    </div>
  );
};
