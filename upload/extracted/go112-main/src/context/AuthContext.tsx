import React, { createContext, useContext, useEffect, useState } from 'react';

interface AppPreferences {
  favorites: string[];
  toggleFavorite: (channelId: string) => void;
  isFavorite: (channelId: string) => boolean;
  isSmartTVMode: boolean;
  toggleSmartTVMode: () => void;
}

const FAVORITES_KEY = 'iptv_favorites_v1';
const AppContext = createContext<AppPreferences | undefined>(undefined);

function readFavorites(): string[] {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.every((value) => typeof value === 'string') ? parsed : [];
  } catch (error) {
    console.error('Unable to read saved favorites:', error);
    return [];
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const [isSmartTVMode, setIsSmartTVMode] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (error) {
      console.error('Unable to save favorites:', error);
    }
  }, [favorites]);

  const toggleFavorite = (channelId: string) => {
    setFavorites((current) => current.includes(channelId)
      ? current.filter((id) => id !== channelId)
      : [...current, channelId]);
  };

  return (
    <AppContext.Provider value={{
      favorites,
      toggleFavorite,
      isFavorite: (channelId) => favorites.includes(channelId),
      isSmartTVMode,
      toggleSmartTVMode: () => setIsSmartTVMode((current) => !current),
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
