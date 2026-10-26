import React, { useState, useEffect } from 'react';
import { 
  X, 
  Tv, 
  Check, 
  Image, 
  Sparkles, 
  Radio, 
  Star, 
  Heart,
  Globe,
  Sliders
} from 'lucide-react';
import { Channel, Category } from '../../types/iptv';

interface ChannelEditModalProps {
  channel: Channel | null; // null means adding a new channel
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Channel, 'id' | 'addedAt'>) => void;
}

export const ChannelEditModal: React.FC<ChannelEditModalProps> = ({
  channel,
  categories,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [logo, setLogo] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [category, setCategory] = useState('live-tv');
  const [country, setCountry] = useState('USA');
  const [language, setLanguage] = useState('English');
  const [epgId, setEpgId] = useState('');
  const [channelNumber, setChannelNumber] = useState<number | string>(101);
  const [status, setStatus] = useState<Channel['status']>('active');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [resolution, setResolution] = useState<Channel['resolution']>('FHD 1080p');
  const [audioTrack, setAudioTrack] = useState('Dolby 5.1');

  useEffect(() => {
    if (channel) {
      setName(channel.name);
      setLogo(channel.logo || '');
      setStreamUrl(channel.streamUrl);
      setCategory(channel.category || categories[0]?.id || 'live-tv');
      setCountry(channel.country || 'USA');
      setLanguage(channel.language || 'English');
      setEpgId(channel.epgId || '');
      setChannelNumber(channel.channelNumber || 101);
      setStatus(channel.status);
      setIsFeatured(channel.isFeatured);
      setIsFavorite(channel.isFavorite);
      setResolution(channel.resolution || 'FHD 1080p');
      setAudioTrack(channel.audioTrack || 'Dolby 5.1');
    } else {
      // Defaults for new channel
      setName('');
      setLogo('');
      setStreamUrl('');
      setCategory(categories[0]?.id || 'live-tv');
      setCountry('USA');
      setLanguage('English');
      setEpgId('');
      setChannelNumber(100 + Math.floor(Math.random() * 800));
      setStatus('active');
      setIsFeatured(false);
      setIsFavorite(false);
      setResolution('4K HDR');
      setAudioTrack('Dolby Atmos 5.1');
    }
  }, [channel, categories, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !streamUrl.trim()) return;

    onSave({
      name: name.trim(),
      logo: logo.trim(),
      streamUrl: streamUrl.trim(),
      category,
      country,
      language,
      epgId: epgId.trim() || name.toLowerCase().replace(/[^a-z0-9]/g, '.'),
      channelNumber,
      status,
      isFeatured,
      isFavorite,
      resolution,
      audioTrack,
      fps: resolution?.includes('4K') ? 60 : 50,
      bitrate: resolution?.includes('4K') ? '18.4 Mbps' : '8.2 Mbps',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0e1220] shadow-2xl backdrop-blur-2xl ring-1 ring-white/10 z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Tv className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {channel ? 'Edit Channel Details' : 'Add New IPTV Channel'}
              </h3>
              <p className="text-xs text-slate-400">
                Configure stream endpoint, metadata, category, and quality tags
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* Channel Name & Channel Number */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-300">
                Channel Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sky Sports Main Event 4K"
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 text-xs text-white focus:border-amber-500/50 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Channel #</label>
              <input
                type="text"
                value={channelNumber}
                onChange={(e) => setChannelNumber(e.target.value)}
                placeholder="e.g. 101"
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 text-xs font-mono text-white focus:border-amber-500/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Stream URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">
              Stream URL (.ts / .m3u8 / http) <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="http://advance.playbeat.live:8880/live/user/pass/12345.ts"
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 text-xs font-mono text-white focus:border-amber-500/50 focus:outline-none"
            />
          </div>

          {/* Channel Logo URL + Preview */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Logo URL</label>
            <div className="flex items-center gap-3">
              <input
                type="url"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                placeholder="https://.../logo.png"
                className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2 text-xs text-white focus:border-amber-500/50 focus:outline-none"
              />
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
                {logo ? (
                  <img src={logo} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <Image className="h-4 w-4 text-slate-500" />
                )}
              </div>
            </div>
          </div>

          {/* Category & Resolution */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Category Group</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-amber-500/50 focus:outline-none cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Quality / Resolution</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as any)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-amber-500/50 focus:outline-none cursor-pointer"
              >
                <option value="4K HDR">4K HDR (Dolby Vision)</option>
                <option value="4K UHD">4K UHD (2160p)</option>
                <option value="FHD 1080p">FHD 1080p (60fps)</option>
                <option value="HD 720p">HD 720p</option>
                <option value="SD">SD Standard</option>
              </select>
            </div>
          </div>

          {/* Country, Language, and EPG ID */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. USA, UK, Pakistan"
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-amber-500/50 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Language</label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="e.g. English, Urdu"
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-amber-500/50 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">EPG TVG-ID</label>
              <input
                type="text"
                value={epgId}
                onChange={(e) => setEpgId(e.target.value)}
                placeholder="e.g. sky.sports.me"
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs font-mono text-white focus:border-amber-500/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Toggles: Status, Featured, Favorite */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/5 bg-slate-950/60 p-3.5">
            {/* Status Radio */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Status:</span>
              <button
                type="button"
                onClick={() => setStatus(status === 'active' ? 'offline' : 'active')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer border ${
                  status === 'active'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span>{status === 'active' ? 'Active' : 'Offline'}</span>
              </button>
            </div>

            {/* Featured */}
            <button
              type="button"
              onClick={() => setIsFeatured(!isFeatured)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer border ${
                isFeatured
                  ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                  : 'border-white/10 text-slate-400'
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${isFeatured ? 'fill-amber-300 text-amber-300' : ''}`} />
              <span>⭐ Featured VIP</span>
            </button>

            {/* Favorite */}
            <button
              type="button"
              onClick={() => setIsFavorite(!isFavorite)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer border ${
                isFavorite
                  ? 'border-rose-500/30 bg-rose-500/15 text-rose-300'
                  : 'border-white/10 text-slate-400'
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${isFavorite ? 'fill-rose-300 text-rose-300' : ''}`} />
              <span>❤️ Favorite</span>
            </button>
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-slate-800/80 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2 text-xs font-bold text-slate-950 hover:from-amber-400 hover:to-amber-500 shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Check className="h-4 w-4 stroke-[3]" />
              <span>{channel ? 'Update Channel' : 'Save Channel'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
