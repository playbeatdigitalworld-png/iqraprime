export type UserRole = 'CUSTOMER';

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface ChannelRecord {
  id: string;
  name: string;
  officialName?: string;
  category?: string;
  logo?: string;
  streamUrl: string;
  epgChannelId?: string;
  country?: string;
  resolution?: string;
  currentProgram?: string;
  nextProgram?: string;
  bitrate?: string;
  providerName?: string;
  audioLanguage?: string;
  contentRightsStatus?: string;
  licenseExpirationDate?: string;
  streamProtocol?: string;
  liveStatus?: boolean;
  isActive?: boolean;
  streamHealth?: string;
  channelNumber?: number | null;
  viewersCount?: number;
  responseTimeMs?: number;
}

export interface MovieRecord {
  id: string;
  officialTitle: string;
  originalTitle: string;
  poster: string;
  backdrop: string;
  description: string;
  genre: string[];
  rating: string;
  category: string;
  streamUrl: string;
}

export interface WebSeriesRecord {
  id: string;
  title: string;
  poster: string;
  backdrop: string;
  synopsis: string;
  category: string;
  rating: string;
  genre: string[];
}
