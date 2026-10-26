import React, { useState, useEffect } from 'react';
import { 
  X, 
  Edit3, 
  Check, 
  Folder, 
  Radio, 
  Globe 
} from 'lucide-react';
import { Playlist } from '../../types/iptv';

interface PlaylistEditModalProps {
  playlist: Playlist | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Playlist>) => void;
}

export const PlaylistEditModal: React.FC<PlaylistEditModalProps> = ({
  playlist,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [serverHost, setServerHost] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  useEffect(() => {
    if (playlist) {
      setName(playlist.name);
      setDescription(playlist.description || '');
      setServerHost(playlist.serverHost || 'advance.playbeat.live:8880');
      setSourceUrl(playlist.sourceUrl || '');
    }
  }, [playlist, isOpen]);

  if (!isOpen || !playlist) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      description: description.trim(),
      serverHost: serverHost.trim(),
      sourceUrl: sourceUrl.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#0e1220] shadow-2xl backdrop-blur-2xl ring-1 ring-white/10 z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Folder className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Edit Playlist Settings</h3>
              <p className="text-xs text-slate-400">
                Update playlist title, gateway host, and sync endpoint
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
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Playlist Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 text-xs text-white focus:border-amber-500/50 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Server Host / Gateway</label>
            <input
              type="text"
              value={serverHost}
              onChange={(e) => setServerHost(e.target.value)}
              placeholder="e.g. advance.playbeat.live:8880"
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 text-xs font-mono text-white focus:border-amber-500/50 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Remote Sync M3U URL</label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="http://advance.playbeat.live:8880/get.php?username=..."
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 text-xs font-mono text-white focus:border-amber-500/50 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short note or description for this playlist..."
              className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-xs text-white focus:border-amber-500/50 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2 text-xs font-bold text-slate-950 hover:from-amber-400 hover:to-amber-500 shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Check className="h-4 w-4 stroke-[3]" />
              <span>Update Settings</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
