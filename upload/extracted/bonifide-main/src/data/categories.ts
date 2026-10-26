import { Category } from '../types/iptv';

export const DEFAULT_PREMIUM_CATEGORIES: Category[] = [
  { id: 'premium-featured', name: 'Premium / Featured', icon: '⭐', color: '#f59e0b', order: 1 },
  { id: 'live-tv', name: 'Live TV', icon: '🔴', color: '#ef4444', order: 2 },
  { id: 'news', name: 'News', icon: '📰', color: '#3b82f6', order: 3 },
  { id: 'sports', name: 'Sports', icon: '⚽', color: '#10b981', order: 4 },
  { id: 'movies', name: 'Movies', icon: '🎬', color: '#8b5cf6', order: 5 },
  { id: 'entertainment', name: 'Entertainment', icon: '📺', color: '#ec4899', order: 6 },
  { id: 'family', name: 'Family', icon: '👨‍👩‍👧', color: '#06b6d4', order: 7 },
  { id: 'kids', name: 'Kids', icon: '🧒', color: '#f97316', order: 8 },
  { id: 'music', name: 'Music', icon: '🎵', color: '#a855f7', order: 9 },
  { id: 'international', name: 'International', icon: '🌍', color: '#14b8a6', order: 10 },
  { id: 'usa', name: 'USA', icon: '🇺🇸', color: '#3b82f6', order: 11 },
  { id: 'uk', name: 'UK', icon: '🇬🇧', color: '#6366f1', order: 12 },
  { id: 'canada', name: 'Canada', icon: '🇨🇦', color: '#ef4444', order: 13 },
  { id: 'australia', name: 'Australia', icon: '🇦🇺', color: '#0ea5e9', order: 14 },
  { id: 'uae', name: 'UAE', icon: '🇦🇪', color: '#10b981', order: 15 },
  { id: 'pakistan', name: 'Pakistan', icon: '🇵🇰', color: '#059669', order: 16 },
  { id: 'india', name: 'India', icon: '🇮🇳', color: '#f97316', order: 17 },
  { id: 'europe', name: 'Europe', icon: '🌍', color: '#3b82f6', order: 18 },
  { id: 'americas', name: 'Americas', icon: '🌎', color: '#0284c7', order: 19 },
  { id: 'religious', name: 'Religious', icon: '🕌', color: '#14b8a6', order: 20 },
  { id: 'business', name: 'Business', icon: '💼', color: '#64748b', order: 21 },
  { id: 'trending', name: 'Trending', icon: '🔥', color: '#f97316', order: 22 },
  { id: 'newly-added', name: 'Newly Added', icon: '🆕', color: '#10b981', order: 23 },
  { id: 'favorites', name: 'Favorites', icon: '❤️', color: '#f43f5e', order: 24 },
];

export const AVAILABLE_CATEGORY_ICONS = [
  '⭐', '🔴', '📰', '⚽', '🎬', '📺', '👨‍👩‍👧', '🧒', '🎵', '🌍',
  '🇺🇸', '🇬🇧', '🇨🇦', '🇦🇺', '🇦🇪', '🇵🇰', '🇮🇳', '🌎', '🕌', '💼',
  '🔥', '🆕', '❤️', '📡', '⚡', '🎮', '🏎️', '🏀', '🎾', '🥊',
  '🍿', '🎙️', '🌌', '🛸', '🎯', '🌟', '🏆', '🎧', '📻', '🔮'
];
