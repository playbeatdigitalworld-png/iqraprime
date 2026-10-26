import React from 'react';
import { 
  X, 
  AlertTriangle, 
  Trash2, 
  Check, 
  Sparkles, 
  Tv, 
  Layers 
} from 'lucide-react';
import { DuplicateGroup, Category } from '../../types/iptv';

interface DuplicateManagerModalProps {
  groups: DuplicateGroup[];
  totalDuplicates: number;
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onDeleteChannel: (channelId: string) => void;
  onResolveAll: () => void;
}

export const DuplicateManagerModal: React.FC<DuplicateManagerModalProps> = ({
  groups,
  totalDuplicates,
  categories,
  isOpen,
  onClose,
  onDeleteChannel,
  onResolveAll,
}) => {
  if (!isOpen) return null;

  const categoryMap = new Map<string, Category>();
  categories.forEach((c) => categoryMap.set(c.id, c));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0e1220] shadow-2xl backdrop-blur-2xl ring-1 ring-white/10 z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Duplicate Detection Engine</h3>
                <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                  {totalDuplicates} Duplicates
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Identify and clean duplicate stream URLs and matching channels
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

        {/* Action Banner */}
        {totalDuplicates > 0 && (
          <div className="flex items-center justify-between bg-amber-500/10 border-b border-amber-500/20 px-6 py-3">
            <div className="text-xs text-amber-200">
              Found <strong className="text-amber-400">{groups.length} groups</strong> with redundant stream channels.
            </div>
            <button
              onClick={() => {
                onResolveAll();
                onClose();
              }}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-1.5 text-xs font-bold text-slate-950 hover:from-amber-400 hover:to-amber-500 shadow-sm cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Auto-Merge & Clean All</span>
            </button>
          </div>
        )}

        {/* Groups List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 mb-3 border border-emerald-500/20">
                <Check className="h-8 w-8" />
              </div>
              <h4 className="text-sm font-bold text-white">Zero Duplicates Detected!</h4>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Your playlist has pristine organization with no overlapping stream URLs or duplicate channel names.
              </p>
            </div>
          ) : (
            groups.map((group, gIdx) => (
              <div
                key={gIdx}
                className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-300">
                      {group.type === 'streamUrl' ? 'DUPLICATE STREAM URL' : 'DUPLICATE NAME'}
                    </span>
                    <span className="font-semibold text-slate-200 truncate max-w-md">
                      {group.key}
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-400 font-bold">
                    {group.channels.length} copies
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  {group.channels.map((ch, chIdx) => {
                    const cat = categoryMap.get(ch.category);
                    const isFirst = chIdx === 0;

                    return (
                      <div
                        key={ch.id}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors ${
                          isFirst
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-slate-200'
                            : 'bg-slate-950/40 text-slate-400 border border-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isFirst ? (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                              KEEP PRIMARY
                            </span>
                          ) : (
                            <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                              REDUNDANT
                            </span>
                          )}
                          <span className="font-bold text-white truncate max-w-xs">{ch.name}</span>
                          <span className="text-[10px] text-slate-400">
                            {cat?.icon} {cat?.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            #{ch.channelNumber}
                          </span>
                        </div>

                        {!isFirst && (
                          <button
                            onClick={() => onDeleteChannel(ch.id)}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete this duplicate copy"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 p-4 bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
