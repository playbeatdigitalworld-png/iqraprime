export type MediaCategory = 
  | 'All'
  | 'Entertainment'
  | 'Sports'
  | 'Movies'
  | 'News'
  | 'Kids'
  | 'Music'
  | 'Documentary'
  | 'Lifestyle'
  | 'International';

export interface Channel {
  id: string;
  name: string;
  number: number;
  logo: string;
  category: MediaCategory;
  country: string;
  language: string;
  streamUrl: string;
  hlsUrl?: string;
  tsUrl?: string;
  streamId?: string;
  groupTitle?: string;
  epgId: string;
  isPremium: boolean;
  isLive: boolean;
  resolution: '4K' | '1080p' | '720p' | 'Unknown';
  currentProgram: {
    title: string;
    startTime: string;
    endTime: string;
    progressPercentage: number;
    synopsis?: string;
  };
  nextProgram: {
    title: string;
    startTime: string;
    endTime: string;
  };
}

export interface EpgProgram {
  id: string;
  channelId: string;
  channelName: string;
  title: string;
  synopsis: string;
  startTime: string; // e.g. "20:00"
  endTime: string;   // e.g. "21:30"
  durationMinutes: number;
  category: string;
  rating: string;
  dayOffset: number; // 0 = Today, 1 = Tomorrow, etc.
  isLiveNow?: boolean;
}

export interface Movie {
  id: string;
  title: string;
  poster: string;
  backdrop: string;
  year: number;
  duration: string;
  rating: string;
  genres: string[];
  description: string;
  director: string;
  cast: string[];
  language: string;
  streamUrl: string;
  trailerUrl?: string;
  isFeatured?: boolean;
  isTrending?: boolean;
  isNewRelease?: boolean;
}

export interface Episode {
  id: string;
  episodeNumber: number;
  title: string;
  duration: string;
  thumbnail: string;
  synopsis: string;
  streamUrl: string;
}

export interface Season {
  seasonNumber: number;
  title: string;
  episodes: Episode[];
}

export interface Series {
  id: string;
  title: string;
  poster: string;
  backdrop: string;
  year: number;
  rating: string;
  genres: string[];
  description: string;
  cast: string[];
  seasonCount: number;
  status: 'Ongoing' | 'Completed';
  seasons: Season[];
  isFeatured?: boolean;
  isTrending?: boolean;
  isPopular?: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tagline: string;
  badge?: string;
  monthlyPrice: number;
  threeMonthPrice: number;
  sixMonthPrice: number;
  annualPrice: number;
  currency: string;
  connectionLimit: number;
  deviceLimit: number;
  vodAvailable: boolean;
  sportsAvailable: boolean;
  resolution: string;
  trialAvailable: boolean;
  isPopular?: boolean;
}

export interface RegisteredDevice {
  id: string;
  name: string;
  type: 'Smart TV' | 'Apple TV' | 'Android TV' | 'Mobile' | 'Web Browser' | 'MAG STB';
  ip: string;
  lastSeen: string;
  status: 'ACTIVE' | 'IDLE';
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  cover: string;
  genre: string;
  streamUrl: string;
  isTrending?: boolean;
}

export interface CustomerInvoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: 'PAID' | 'PENDING' | 'REFUNDED';
  planName: string;
  paymentMethod: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  category: 'Streaming' | 'Account' | 'Payment' | 'Device Setup' | 'Technical Issue';
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    sender: 'CUSTOMER' | 'SUPPORT';
    senderName: string;
    text: string;
    time: string;
  }>;
}

export interface PlaybackSession {
  token: string;
  streamUrl: string;
  title: string;
  channelLogo?: string;
  type: 'LIVE' | 'VOD';
  expiresAt: number;
}
