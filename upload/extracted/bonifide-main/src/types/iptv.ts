export type ChannelStatus = 'active' | 'offline' | 'checking';

export interface Channel {
  id: string;
  name: string;
  logo: string;
  streamUrl: string;
  category: string; // Category ID
  country: string;
  language: string;
  epgId: string;
  channelNumber: number | string;
  status: ChannelStatus;
  isFeatured: boolean;
  isFavorite: boolean;
  resolution?: '4K HDR' | '4K UHD' | 'FHD 1080p' | 'HD 720p' | 'SD';
  fps?: number | string;
  bitrate?: string;
  audioTrack?: string;
  addedAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color?: string;
  order: number;
  isSystem?: boolean;
  description?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  sourceType: 'url' | 'file' | 'custom';
  sourceUrl?: string;
  status: 'active' | 'offline' | 'syncing' | 'error';
  lastUpdated: string;
  serverHost?: string;
  channels: Channel[];
  categories: Category[];
}

export type ViewMode = 'grid' | 'list';

export interface FilterOptions {
  search: string;
  categoryId: string; // 'all' or specific ID
  country: string; // 'all' or specific
  language: string; // 'all' or specific
  status: 'all' | 'active' | 'offline';
  onlyFavorites: boolean;
  onlyFeatured: boolean;
  resolution: string; // 'all' or specific
}

export interface DuplicateGroup {
  key: string;
  type: 'streamUrl' | 'name' | 'epgId';
  channels: Channel[];
}
