import type { Playlist } from '../types/iptv';

export const DEFAULT_PLAYLISTS: Playlist[] = [{
  id: 'provider-catalog',
  name: 'Provider catalog',
  sourceType: 'custom',
  status: 'active',
  lastUpdated: '',
  channels: [],
  categories: [],
}];
