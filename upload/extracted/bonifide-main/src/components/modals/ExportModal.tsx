import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  FileCode, 
  FileText, 
  Filter 
} from 'lucide-react';
import { Playlist, Category } from '../../types/iptv';
import { exportToM3U } from '../../utils/m3uParser';

interface ExportModalProps {
  playlist: Playlist;
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  playlist,
  categories,
  isOpen,
  onClose,
}) => {
  const [format, setFormat] = useState<'m3u_plus' | 'm3u_standard' | 'json'>('m3u_plus');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const generateExportText = (): string => {
    if (format === 'json') {
      const dataToExport = {
        ...playlist,
        channels: selectedCategory === 'all'
          ? playlist.channels
          : playlist.channels.filter((c) => c.category === selectedCategory),
      };
      return JSON.stringify(dataToExport, null, 2);
    }

    return exportToM3U(playlist, categories, {
      includePlusTags: format === 'm3u_plus',
      filterCategory: selectedCategory,
    });
  };

  const handleDownload = () => {
    const text = generateExportText();
    let filename = `${playlist.name.replace(/[^a-z0-9_-]/gi, '_')}`;
    let mimeType = 'text/plain';

    if (format === 'json') {
      filename += '.json';
      mimeType = 'application/json';
    } else if (format === 'm3u_plus') {
      filename += '.m3u8';
      mimeType = 'application/x-mpegURL';
    } else {
      filename += '.m3u';
      mimeType = 'audio/x-mpegurl';
    }

    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    const text = generateExportText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportTextPreview = generateExportText();
  const channelsCount = selectedCategory === 'all'
    ? playlist.channels.length
    : playlist.channels.filter((c) => c.category === selectedCategory).length;

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
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Export IPTV Playlist</h3>
              <p className="text-xs text-slate-400">
                Download as M3U / M3U8 Plus with metadata or JSON backup
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

        {/* Options */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          
          {/* Format Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Export Format</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setFormat('m3u_plus')}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  format === 'm3u_plus'
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                    : 'border-white/10 bg-slate-900/60 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs text-white">M3U Plus (.m3u8)</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Full tvg-id, logos, channels, & groups
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('m3u_standard')}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  format === 'm3u_standard'
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                    : 'border-white/10 bg-slate-900/60 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs text-white">Standard M3U</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Compatible with legacy VLC & IPTV boxes
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('json')}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  format === 'json'
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                    : 'border-white/10 bg-slate-900/60 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs text-white">JSON Archive</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Raw data backup including all settings
                </div>
              </button>
            </div>
          </div>

          {/* Category Scope Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Channels to Export</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-amber-500/50 focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories ({playlist.channels.length} channels)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300">
                File Preview ({channelsCount} channels)
              </label>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Copied to Clipboard' : 'Copy Text'}</span>
              </button>
            </div>
            <textarea
              readOnly
              rows={7}
              value={exportTextPreview}
              className="w-full rounded-xl border border-white/10 bg-black/60 p-3 font-mono text-[11px] text-slate-300 focus:outline-none"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/5 bg-slate-950/40">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2 text-xs font-bold text-slate-950 hover:from-amber-400 hover:to-amber-500 shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Download className="h-4 w-4 stroke-[2.5]" />
            <span>Download Playlist File</span>
          </button>
        </div>

      </div>
    </div>
  );
};
