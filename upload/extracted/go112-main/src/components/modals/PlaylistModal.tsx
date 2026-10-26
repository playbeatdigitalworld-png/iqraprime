import React, { useState } from 'react';
import { 
  X, 
  FolderPlus, 
  Globe, 
  Upload, 
  FileText, 
  Check, 
  Sparkles, 
  AlertCircle,
  Tv,
  ArrowRight
} from 'lucide-react';
import { Playlist } from '../../types/iptv';

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportContent: (name: string, content: string, sourceUrl?: string) => void;
  onCreateEmpty: (data: { name: string; description?: string; sourceUrl?: string; sourceType: Playlist['sourceType'] }) => void;
}

export const PlaylistModal: React.FC<PlaylistModalProps> = ({
  isOpen,
  onClose,
  onImportContent,
  onCreateEmpty,
}) => {
  const [tab, setTab] = useState<'url' | 'file' | 'paste' | 'blank'>('url');
  const [playlistName, setPlaylistName] = useState('');
  const [url, setUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFetchUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      // First attempt using our Vite backend proxy
      let res: Response;
      try {
        res = await fetch(`/api/fetch-playlist?url=${encodeURIComponent(url.trim())}`);
      } catch (proxyError) {
        // Fallback to direct fetch
        res = await fetch(url.trim());
      }

      if (!res.ok) {
        throw new Error(`Remote server responded with ${res.status}`);
      }

      const content = await res.text();
      if (!content || (!content.includes('#EXTM3U') && !content.includes('#EXTINF'))) {
        throw new Error('Downloaded content does not contain valid M3U headers (#EXTM3U / #EXTINF)');
      }

      onImportContent(playlistName || 'Imported Live Stream', content, url.trim());
      setIsLoading(false);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown network error';
      console.error('Playlist URL import failed:', err);
      setErrorMsg(`Unable to import this playlist (${message}). You can upload a local .m3u file or paste raw M3U text instead.`);
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsLoading(true);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        onImportContent(playlistName || file.name.replace(/\.[^/.]+$/, ''), text);
        setIsLoading(false);
        onClose();
      }
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read the selected file.');
      setIsLoading(false);
    };
    reader.readAsText(file);
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedText.trim()) return;

    onImportContent(playlistName || 'Custom M3U Feed', pastedText.trim());
    onClose();
  };

  const handleBlankSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistName.trim()) return;

    onCreateEmpty({
      name: playlistName.trim(),
      sourceType: 'custom',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#0e1220] shadow-2xl backdrop-blur-2xl ring-1 ring-white/10 z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <FolderPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Import or Create Playlist</h3>
              <p className="text-xs text-slate-400">
                Support M3U, M3U8, Xtream Codes URL, and file uploads
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

        {/* Tab Selector */}
        <div className="flex border-b border-white/5 bg-slate-900/60 p-2 gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setTab('url')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all cursor-pointer ${
              tab === 'url' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Playlist URL</span>
          </button>
          <button
            onClick={() => setTab('file')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all cursor-pointer ${
              tab === 'file' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload File</span>
          </button>
          <button
            onClick={() => setTab('paste')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all cursor-pointer ${
              tab === 'paste' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Paste M3U</span>
          </button>
          <button
            onClick={() => setTab('blank')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all cursor-pointer ${
              tab === 'blank' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span>Empty</span>
          </button>
        </div>

        {/* Content Tabs */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* TAB 1: Playlist URL */}
          {tab === 'url' && (
            <form onSubmit={handleFetchUrl} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Playlist Name</label>
                <input
                  type="text"
                  required
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  placeholder="e.g. My playlist"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 text-xs text-white focus:border-amber-500/50 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">M3U / M3U8 Stream URL</label>
                </div>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter a playlist URL"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 text-xs font-mono text-white focus:border-amber-500/50 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-slate-300">
                <div className="font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Auto-Parsing Engine
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Automatically extracts channel logos, stream URLs, audio formats, resolutions, categories, and country badges.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2.5 text-xs font-bold text-slate-950 hover:from-amber-400 hover:to-amber-500 shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <span>Fetching & Parsing M3U...</span>
                ) : (
                  <>
                    <span>Load & Parse Playlist</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: Upload File */}
          {tab === 'file' && (
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Playlist Name</label>
                <input
                  type="text"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  placeholder="e.g. My Cable Channels"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 text-xs text-white focus:border-amber-500/50 focus:outline-none"
                />
              </div>

              <div className="rounded-2xl border-2 border-dashed border-white/15 bg-slate-900/40 p-6 text-center hover:border-amber-500/50 transition-colors">
                <Upload className="mx-auto h-8 w-8 text-amber-400 mb-2" />
                <label className="cursor-pointer">
                  <span className="text-xs font-bold text-amber-400 hover:underline">
                    Click to select .m3u or .m3u8 file
                  </span>
                  <input
                    type="file"
                    accept=".m3u,.m3u8,text/plain"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                <p className="text-[11px] text-slate-500 mt-1">Supports UTF-8 M3U / M3U8 files up to 25MB</p>
                {file && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-mono text-amber-300">
                    <Check className="h-3 w-3" />
                    <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!file || isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2.5 text-xs font-bold text-slate-950 hover:from-amber-400 hover:to-amber-500 shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
              >
                <span>Import File Contents</span>
              </button>
            </form>
          )}

          {/* TAB 3: Paste Text */}
          {tab === 'paste' && (
            <form onSubmit={handlePasteSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Playlist Name</label>
                <input
                  type="text"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  placeholder="e.g. Pasted Satellite Feed"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 text-xs text-white focus:border-amber-500/50 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">M3U Text Content</label>
                <textarea
                  rows={6}
                  required
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="#EXTM3U&#10;#EXTINF:-1 tvg-id=&quot;cnn&quot; group-title=&quot;News&quot;,CNN Live&#10;http://example.com/stream.ts"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-xs font-mono text-white focus:border-amber-500/50 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={!pastedText.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2.5 text-xs font-bold text-slate-950 hover:from-amber-400 hover:to-amber-500 shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
              >
                <span>Parse & Add Playlist</span>
              </button>
            </form>
          )}

          {/* TAB 4: Empty Playlist */}
          {tab === 'blank' && (
            <form onSubmit={handleBlankSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Playlist Name</label>
                <input
                  type="text"
                  required
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  placeholder="e.g. My Custom Channels Collection"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 text-xs text-white focus:border-amber-500/50 focus:outline-none"
                />
              </div>

              <p className="text-xs text-slate-400">
                Creates an empty playlist preloaded with the standard premium category hierarchy. You can then add channels manually or import batches.
              </p>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2.5 text-xs font-bold text-slate-950 hover:from-amber-400 hover:to-amber-500 shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <span>Create Blank Playlist</span>
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
