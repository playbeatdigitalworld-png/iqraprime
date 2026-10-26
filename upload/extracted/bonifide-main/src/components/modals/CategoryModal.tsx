import React, { useState, useEffect } from 'react';
import { 
  X, 
  Layers, 
  Check, 
  Palette, 
  Sparkles 
} from 'lucide-react';
import { Category } from '../../types/iptv';
import { AVAILABLE_CATEGORY_ICONS } from '../../data/categories';

interface CategoryModalProps {
  category: Category | null; // null means create new category
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; icon: string; color?: string; description?: string }) => void;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  category,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📺');
  const [color, setColor] = useState('#f59e0b');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (category) {
      setName(category.name);
      setIcon(category.icon);
      setColor(category.color || '#f59e0b');
      setDescription(category.description || '');
    } else {
      setName('');
      setIcon('⭐');
      setColor('#f59e0b');
      setDescription('');
    }
  }, [category, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      icon,
      color,
      description: description.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0e1220] shadow-2xl backdrop-blur-2xl ring-1 ring-white/10 z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {category ? 'Edit Channel Group' : 'New Custom Category'}
              </h3>
              <p className="text-xs text-slate-400">
                Organize channels into clean hierarchies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Category Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Category Name</label>
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-slate-900 text-lg">
                {icon}
              </span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 4K Ultra Movies or Cricket Live"
                className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 text-xs text-white focus:border-amber-500/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Icon Selector Palette */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Choose Group Icon</label>
            <div className="grid grid-cols-8 gap-1.5 max-h-32 overflow-y-auto rounded-xl border border-white/10 bg-slate-900/80 p-2">
              {AVAILABLE_CATEGORY_ICONS.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all cursor-pointer ${
                    icon === emoji
                      ? 'bg-amber-500/30 ring-2 ring-amber-400 scale-110'
                      : 'hover:bg-white/10'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. International news feeds broadcasted in English"
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 text-xs text-white focus:border-amber-500/50 focus:outline-none"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-slate-800/80 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2 text-xs font-bold text-slate-950 hover:from-amber-400 hover:to-amber-500 shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Check className="h-4 w-4 stroke-[3]" />
              <span>{category ? 'Save Changes' : 'Create Category'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
