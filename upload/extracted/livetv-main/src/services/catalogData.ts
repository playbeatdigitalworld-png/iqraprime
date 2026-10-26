import { Channel, EpgProgram, Movie, Series, SubscriptionPlan, RegisteredDevice, SupportTicket } from '../types/playbeat';

export type { Channel, EpgProgram, Movie, Series, SubscriptionPlan, RegisteredDevice, SupportTicket };

export const CHANNELS: Channel[] = [];

// Media catalogs are populated only from an authorized provider.
export const MOVIES: Movie[] = [];
export const SERIES_LIST: Series[] = [];
export const SERIES: Series[] = SERIES_LIST;

export const PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_starter',
    name: 'STARTER',
    tagline: 'Ideal for single-screen streaming on mobile or Smart TV',
    monthlyPrice: 9.99,
    threeMonthPrice: 24.99,
    sixMonthPrice: 44.99,
    annualPrice: 79.99,
    currency: 'USD',
    connectionLimit: 1,
    deviceLimit: 2,
    vodAvailable: true,
    sportsAvailable: false,
    resolution: '1080p Full HD',
    trialAvailable: true,
    isPopular: false
  },
  {
    id: 'plan_standard',
    name: 'STANDARD',
    tagline: 'Dual-screen full entertainment with live sports feeds',
    monthlyPrice: 15.99,
    threeMonthPrice: 39.99,
    sixMonthPrice: 69.99,
    annualPrice: 119.99,
    currency: 'USD',
    connectionLimit: 2,
    deviceLimit: 4,
    vodAvailable: true,
    sportsAvailable: true,
    resolution: '4K Ultra HD',
    trialAvailable: true,
    isPopular: true
  },
  {
    id: 'plan_premium',
    name: 'PREMIUM VIP',
    tagline: 'Triple-screen VIP access with ultra-low latency sports and 4K VOD',
    badge: 'MOST POPULAR',
    monthlyPrice: 21.99,
    threeMonthPrice: 54.99,
    sixMonthPrice: 94.99,
    annualPrice: 159.99,
    currency: 'USD',
    connectionLimit: 3,
    deviceLimit: 6,
    vodAvailable: true,
    sportsAvailable: true,
    resolution: '4K HDR & 60FPS Sports',
    trialAvailable: true,
    isPopular: false
  },
  {
    id: 'plan_family',
    name: 'FAMILY PLUS',
    tagline: 'Maximum 4 simultaneous streams for household multi-room entertainment',
    monthlyPrice: 28.99,
    threeMonthPrice: 69.99,
    sixMonthPrice: 119.99,
    annualPrice: 199.99,
    currency: 'USD',
    connectionLimit: 4,
    deviceLimit: 8,
    vodAvailable: true,
    sportsAvailable: true,
    resolution: '4K Ultra HD & Dolby Atmos',
    trialAvailable: true,
    isPopular: false
  }
];

export const REGISTERED_DEVICES: RegisteredDevice[] = [
  {
    id: 'dev_tv_living',
    name: 'LG OLED 65" (Living Room TiviMate)',
    type: 'Smart TV',
    ip: '192.168.1.140',
    lastSeen: 'Streaming right now (PlayBeat Sports 4K)',
    status: 'ACTIVE'
  },
  {
    id: 'dev_apple_tv',
    name: 'Apple TV 4K (Bedroom)',
    type: 'Apple TV',
    ip: '192.168.1.185',
    lastSeen: '2 hours ago',
    status: 'IDLE'
  },
  {
    id: 'dev_iphone_pro',
    name: 'iPhone 16 Pro (Mobile Streamer)',
    type: 'Mobile',
    ip: '172.56.21.90',
    lastSeen: 'Yesterday at 19:40',
    status: 'IDLE'
  }
];

export const SUPPORT_TICKETS: SupportTicket[] = [
  {
    id: 'tkt_8821',
    subject: 'Setting up M3U Plus on Apple TV GSE IPTV app',
    category: 'Device Setup',
    priority: 'NORMAL',
    status: 'RESOLVED',
    createdAt: '2026-10-02T14:00:00Z',
    updatedAt: '2026-10-02T15:30:00Z',
    messages: [
      {
        id: 'msg_1',
        sender: 'CUSTOMER',
        senderName: 'Alex Mercer',
        text: 'Hi, where do I paste my EPG XMLTV URL inside the Apple TV app to get channel guides?',
        time: 'Oct 2, 14:00'
      },
      {
        id: 'msg_2',
        sender: 'SUPPORT',
        senderName: 'PlayBeat Care Desk',
        text: 'Hello Alex! In GSE IPTV, go to EPG Program Guide -> Remote EPG -> Add New URL, and paste the EPG link from your PlayBeat dashboard: https://tv.playbeat.digital/xmltv.php. Let us know if you need anything else!',
        time: 'Oct 2, 15:30'
      }
    ]
  }
];
