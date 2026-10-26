import React, { useState } from 'react';
import { 
  Plus, 
  ChevronRight, 
  MoreVertical, 
  ArrowUp, 
  ArrowDown, 
  Edit2, 
  Trash2,
  Tv,
  Star,
  Heart,
  Layers,
  Sparkles
} from 'lucide-react';
import { Category, Channel } from '../types/iptv';

interface CategorySidebarProps {
  categories: Category[];
  channels: Channel[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  onAddCategory: () => void;
  onEditCategory: (cat: Category) => void;
  onDeleteCategory: (catId: string) => void;
  onMoveCategory: (index: number, direction: 'up' | 'down') => void;
  onDropChannelToCategory?: (channelId: string, targetCategoryId: string) => void;
}

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
  categories,
  channels,
  selectedCategoryId,
  onSelectCategory,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onMoveCategory,
  onDropChannelToCategory,
}) => {
  const [activeMenuCatId, setActiveMenuCatId] = useState<string | null>(null);

  // Pre-calculate counts
  const categoryCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    channels.forEach((c) => {
      counts.set(c.category, (counts.get(c.category) || 0) + 1);
    });
    return counts;
  }, [channels]);

  const totalChannels = channels.length;
  const favoritesCount = channels.filter((c) => c.isFavorite).length;
  const featuredCount = channels.filter((c) => c.isFeatured).length;

  return (
    <aside className="w-full md:w-72 lg:w-80 shrink-0 border-r border-white/5 bg-[#090b10]/60 backdrop-blur-xl flex flex-col h-[calc(100vh-8rem)]">
      
      {/* Sidebar Header */}
      <div className="p-3.5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-amber-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Channel Categories
          </h2>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
            {categories.length}
          </span>
        </div>
        <button
          onClick={onAddCategory}
          className="flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer"
          title="Add Custom Category"
        >
          <Plus className="h-3 w-3 stroke-[3]" />
          <span>New Group</span>
        </button>
      </div>

      {/* Categories Scrollable List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 custom-scrollbar">
        
        {/* Quick Filter: All Channels */}
        <button
          onClick={() => onSelectCategory('all')}
          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all cursor-pointer ${
            selectedCategoryId === 'all'
              ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 text-amber-300 border border-amber-500/30 shadow-sm'
              : 'text-slate-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2.5 truncate">
            <span className="text-sm">🌐</span>
            <span className="truncate">All Channels</span>
          </div>
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-mono text-slate-400 font-normal">
            {totalChannels}
          </span>
        </button>

        {/* Quick Filter: Featured / Premium */}
        <button
          onClick={() => onSelectCategory('special-featured')}
          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all cursor-pointer ${
            selectedCategoryId === 'special-featured'
              ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 text-amber-300 border border-amber-500/30 shadow-sm'
              : 'text-slate-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2.5 truncate">
            <span className="text-sm">⭐</span>
            <span className="truncate">VIP Featured</span>
          </div>
          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400 font-semibold border border-amber-500/20">
            {featuredCount}
          </span>
        </button>

        {/* Quick Filter: Favorites */}
        <button
          onClick={() => onSelectCategory('special-favorites')}
          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all cursor-pointer ${
            selectedCategoryId === 'special-favorites'
              ? 'bg-gradient-to-r from-rose-500/20 to-rose-500/5 text-rose-300 border border-rose-500/30 shadow-sm'
              : 'text-slate-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2.5 truncate">
            <span className="text-sm">❤️</span>
            <span className="truncate">Bookmarked Favorites</span>
          </div>
          <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] font-mono text-rose-400 font-semibold border border-rose-500/20">
            {favoritesCount}
          </span>
        </button>

        <div className="pt-2 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Groups & Hierarchy
        </div>

        {/* User / Hierarchy Categories */}
        {categories.map((category, index) => {
          const count = categoryCounts.get(category.id) || 0;
          const isSelected = selectedCategoryId === category.id;

          return (
            <div
              key={category.id}
              className={`group relative flex items-center rounded-xl transition-all ${
                isSelected
                  ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 text-amber-300 border border-amber-500/30 shadow-sm'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('bg-amber-500/20');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('bg-amber-500/20');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('bg-amber-500/20');
                const channelId = e.dataTransfer.getData('text/plain');
                if (channelId && onDropChannelToCategory) {
                  onDropChannelToCategory(channelId, category.id);
                }
              }}
            >
              <button
                onClick={() => onSelectCategory(category.id)}
                className="flex flex-1 items-center justify-between px-3 py-2 text-left text-xs font-medium cursor-pointer truncate"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-sm leading-none shrink-0">{category.icon}</span>
                  <span className="truncate">{category.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono ${
                      count > 0 ? 'bg-white/5 text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </div>
              </button>

              {/* Category Quick Actions (Reorder & Edit) */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center pr-1.5 gap-0.5">
                {index > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveCategory(index, 'up');
                    }}
                    className="p-1 text-slate-400 hover:text-amber-400 rounded hover:bg-white/10"
                    title="Move Category Up"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                )}
                {index < categories.length - 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveCategory(index, 'down');
                    }}
                    className="p-1 text-slate-400 hover:text-amber-400 rounded hover:bg-white/10"
                    title="Move Category Down"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditCategory(category);
                  }}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10"
                  title="Edit Category"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
                {categories.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCategory(category.id);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-white/10"
                    title="Delete Category"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-white/5 bg-slate-950/40 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Drag channel to category</span>
        <span className="font-mono text-[10px] text-amber-500/80">Pro Manager</span>
      </div>
    </aside>
  );
};
