/**
 * Aether Stream Resilient Data Store
 *
 * NOTE: seed accounts below are bootstrap defaults only. For the private
 * pilot, rotate admin/member passwords from the admin console after first
 * login; do not rely on them for production access control.
 *
 * Mirrors PostgreSQL / Supabase Schema specifications:
 * - users & profiles
 * - subscriptions & subscription_plans
 * - iptv_customers & iptv_packages
 * - channels & channel_sources
 * - movies & movie_sources
 * - watch_history, watchlist, favorites, devices
 * - reports & takedown_requests
 * - admin_logs, site_settings
 */

import type {
  AdminStats,
  Channel,
  DeviceInfo,
  M3UChannel,
  MemberAccount,
  MemberIptvLine,
  Movie,
  PilotSettings,
  Subscription,
  TakedownRequest,
  User,
  WatchProgress,
} from '../../src/types/index.js';

class DataStore {
  public users: Map<string, User> = new Map();
  public userPasswords: Map<string, string> = new Map();
  public userStatus: Map<string, 'active' | 'disabled'> = new Map();
  public subscriptions: Map<string, Subscription> = new Map();
  public channels: Map<string, Channel> = new Map();
  public m3uChannels: Map<string, M3UChannel> = new Map();
  public movies: Map<string, Movie> = new Map();
  public watchlist: Map<string, Set<string>> = new Map(); // userId -> Set of contentIds
  public watchHistory: Map<string, Map<string, WatchProgress>> = new Map(); // userId -> Map of contentId -> progress
  public devices: Map<string, DeviceInfo[]> = new Map(); // userId -> devices
  // Per-member Star IPTV line assignments (server-side only — never sent raw to clients)
  public memberIptvLines: Map<string, MemberIptvLine> = new Map(); // userId -> line
  public takedownRequests: TakedownRequest[] = [];
  public adminLogs: Array<{ id: string; timestamp: string; action: string; details: string }> = [];

  public pilotSettings: PilotSettings = {
    privateMode: true,
    commercialMode: false,
    publicRegistration: false,
    paymentsEnabled: false,
    maxPrivateUsers: 5,
    maxDevicesPerUser: 2,
    currentMembers: 3,
    activeMembers: 3,
    remainingSlots: 2,
  };

  public siteSettings: Record<string, unknown> = {
    platformName: 'Aether Stream',
    platformMotto: 'Private Member Pilot & Star IPTV Testing Portal',
    contactEmail: 'concierge@aetherstream.tv',
    supportEmail: 'concierge@aetherstream.tv',
    allowRegistration: false,
    requireSubscriptionForLiveChannels: true,
    maintenanceMode: false,
    resellerModeEnabled: true,
  };

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // 1. Seed 3 Approved Pilot Members (out of 5 Maximum)
    const adminUser: User = {
      id: 'usr-admin-01',
      email: 'admin@aetherstream.tv',
      name: 'System Director (Admin)',
      role: 'admin',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    this.users.set(adminUser.id, adminUser);
    // SECURITY (pre-merge review): the old hard-coded seed passwords
    // ("admin123"/"member123") shipped in the client bundle and git history —
    // treat them as compromised. Seeded pilot sign-in now works ONLY when a
    // password is provisioned via server environment (min 8 chars):
    //   PILOT_PASSWORD_ADMIN  — Director console (admin@aetherstream.tv)
    //   PILOT_PASSWORD_MEMBER — household member seed accounts
    // Unset => the seeded account accepts NO password (login returns 401)
    // until the owner provisions one. Rotation: set the env var and restart.
    const pilotAdminPassword = (process.env.PILOT_PASSWORD_ADMIN || '').trim();
    this.userPasswords.set(adminUser.email.toLowerCase(), pilotAdminPassword.length >= 8 ? pilotAdminPassword : '');
    this.userStatus.set(adminUser.id, 'active');

    const member1: User = {
      id: 'usr-member-01',
      email: 'julian@aetherstream.tv',
      name: 'Julian Vance (Family Member)',
      role: 'customer',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      createdAt: '2026-02-14T10:30:00.000Z',
    };
    this.users.set(member1.id, member1);
    const pilotMemberPassword = (process.env.PILOT_PASSWORD_MEMBER || '').trim();
    this.userPasswords.set(member1.email.toLowerCase(), pilotMemberPassword.length >= 8 ? pilotMemberPassword : '');
    this.userStatus.set(member1.id, 'active');

    const member2: User = {
      id: 'usr-member-02',
      email: 'elena@aetherstream.tv',
      name: 'Elena Rostova (Family Member)',
      role: 'customer',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      createdAt: '2026-03-01T12:00:00.000Z',
    };
    this.users.set(member2.id, member2);
    this.userPasswords.set(member2.email.toLowerCase(), pilotMemberPassword.length >= 8 ? pilotMemberPassword : '');
    this.userStatus.set(member2.id, 'active');

    // Update pilot slots count
    this.recalculatePilotSlots();

    // 2. Seed Customer Active Pilot Pass
    const vipSub: Subscription = {
      id: 'sub-vip-8901',
      userId: member1.id,
      tier: 'iptv_vip',
      status: 'active',
      packageName: 'Private Pilot Member Access Pass',
      activationDate: '2026-03-01T00:00:00.000Z',
      expiryDate: '2027-03-01T00:00:00.000Z',
      maxDevices: this.pilotSettings.maxDevicesPerUser,
      activeDevices: 2,
      autoRenew: true,
      iptvCredentials: {
        username: 'star_pilot_julian',
        serverHost: 'vip.stariptv.pk',
        m3uUrlMasked: 'http://vip.stariptv.pk:8080/get.php?username=star_pilot_julian&password=••••••••&type=m3u_plus',
        epgUrl: 'http://vip.stariptv.pk:8080/xmltv.php?username=star_pilot_julian&password=••••••••',
      },
    };
    this.subscriptions.set(member1.id, vipSub);

    // 3. Seed Devices for Julian (at limit of 2 devices)
    this.devices.set(member1.id, [
      {
        id: 'dev-01',
        name: 'Living Room Sony Bravia 4K TV',
        deviceType: 'smart_tv',
        browser: 'Android TV WebKit',
        os: 'Google TV 14',
        lastActive: '2026-10-07T03:40:00.000Z',
        isCurrent: false,
      },
      {
        id: 'dev-02',
        name: 'MacBook Pro 16" (Studio)',
        deviceType: 'desktop',
        browser: 'Chrome 138',
        os: 'macOS Sequoia',
        lastActive: 'Just now',
        isCurrent: true,
      },
    ]);

    // Seed device for Elena
    this.devices.set(member2.id, [
      {
        id: 'dev-03',
        name: 'Elena iPad Air',
        deviceType: 'tablet',
        browser: 'Mobile Safari',
        os: 'iPadOS 18',
        lastActive: 'Yesterday',
        isCurrent: false,
      },
    ]);

    // 4. Seed Legal Free Live TV Channels
    // Strictly Free-to-Air, Official Public Feeds, Public Broadcasters
    const initialChannels: Channel[] = [
      {
        id: 'ch-dw-english',
        channelName: 'DW News English',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/320px-Deutsche_Welle_symbol_2012.svg.png',
        country: 'Germany / International',
        language: 'English',
        category: 'News',
        streamUrl: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
        sourceUrl: 'https://www.dw.com/en/live-tv/s-100825',
        sourceName: 'Deutsche Welle (Public Broadcaster)',
        rightsStatus: 'PUBLIC_BROADCAST',
        commercialUse: true,
        attributionRequired: true,
        attribution: 'Deutsche Welle Germany public statutory broadcast.',
        lastVerified: '2026-10-06T12:00:00.000Z',
        enabled: true,
        epgProgram: {
          current: 'DW News Global Perspective',
          next: 'The Day: International In-Depth',
          startTime: '04:00',
          endTime: '05:00',
        },
      },
      {
        id: 'ch-france24-en',
        channelName: 'France 24 English',
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/65/France_24_logo.svg/320px-France_24_logo.svg.png',
        country: 'France / Global',
        language: 'English',
        category: 'News',
        streamUrl: 'https://static.france24.com/live/F24_EN_LO_HLS/live_tv.m3u8',
        sourceUrl: 'https://www.france24.com/en/live',
        sourceName: 'France Médias Monde (Public Service)',
        rightsStatus: 'PUBLIC_BROADCAST',
        commercialUse: true,
        attributionRequired: true,
        attribution: 'Official open public streaming feed from France Médias Monde.',
        lastVerified: '2026-10-06T12:00:00.000Z',
        enabled: true,
        epgProgram: {
          current: 'Eye on Europe & Africa',
          next: 'World News Bulletin & Business',
          startTime: '04:30',
          endTime: '05:00',
        },
      },
      {
        id: 'ch-nasa-public',
        channelName: 'NASA TV Space Operations',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/320px-NASA_logo.svg.png',
        country: 'United States',
        language: 'English',
        category: 'Science & Tech',
        streamUrl: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
        sourceUrl: 'https://www.nasa.gov/live',
        sourceName: 'NASA Public Domain Broadcast',
        rightsStatus: 'PUBLIC_DOMAIN',
        commercialUse: true,
        attributionRequired: false,
        attribution: 'US Federal Government work, Public Domain worldwide.',
        lastVerified: '2026-10-06T12:00:00.000Z',
        enabled: true,
        epgProgram: {
          current: 'ISS Live Downlink & Earth Views',
          next: 'Artemis Deep Space Briefing',
          startTime: '04:00',
          endTime: '06:00',
        },
      },
      {
        id: 'ch-bloomberg-open',
        channelName: 'Bloomberg TV Markets',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Bloomberg_Television_logo.svg/320px-Bloomberg_Television_logo.svg.png',
        country: 'United States / Global',
        language: 'English',
        category: 'News',
        streamUrl: 'https://liveprodupm.global.ssl.fastly.net/us/Channel-us-fast-1/source.m3u8',
        sourceUrl: 'https://www.bloomberg.com/live',
        sourceName: 'Bloomberg FAST Free Streaming',
        rightsStatus: 'FREE_TO_AIR',
        commercialUse: false,
        attributionRequired: true,
        attribution: 'Free-to-air ad-supported syndication feed.',
        lastVerified: '2026-10-06T12:00:00.000Z',
        enabled: true,
        epgProgram: {
          current: 'Bloomberg Surveillance Live',
          next: 'The Close: Markets Wrap',
          startTime: '04:00',
          endTime: '05:30',
        },
      },
      {
        id: 'ch-aljazeera-en',
        channelName: 'Al Jazeera English Live',
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Al_Jazeera_English_logo.svg/320px-Al_Jazeera_English_logo.svg.png',
        country: 'Qatar / Global',
        language: 'English',
        category: 'News',
        streamUrl: 'https://live-hls-web-aje.getaj.net/AJE/01.m3u8',
        sourceUrl: 'https://www.aljazeera.com/live',
        sourceName: 'Al Jazeera Media Network (Free Web Stream)',
        rightsStatus: 'PUBLIC_BROADCAST',
        commercialUse: true,
        attributionRequired: true,
        attribution: 'Official free live stream authorized by Al Jazeera Media Network.',
        lastVerified: '2026-10-06T12:00:00.000Z',
        enabled: true,
        epgProgram: {
          current: 'Newshour International',
          next: 'Counting the Cost: Economics',
          startTime: '04:00',
          endTime: '05:00',
        },
      },
      {
        id: 'ch-euronews-en',
        channelName: 'Euronews International',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Euronews_2016_logo.svg/320px-Euronews_2016_logo.svg.png',
        country: 'European Union',
        language: 'English',
        category: 'News',
        streamUrl: 'https://euronews-euronews-world-1-us.samsung.wurl.com/manifest/playlist.m3u8',
        sourceUrl: 'https://www.euronews.com/live',
        sourceName: 'Euronews Public FAST Stream',
        rightsStatus: 'FREE_TO_AIR',
        commercialUse: true,
        attributionRequired: true,
        attribution: 'Free-to-air authorized stream distribution.',
        lastVerified: '2026-10-06T12:00:00.000Z',
        enabled: true,
        epgProgram: {
          current: 'Euronews Now & Markets',
          next: 'State of the Union',
          startTime: '04:15',
          endTime: '05:15',
        },
      },
      {
        id: 'ch-redbull-tv',
        channelName: 'Red Bull TV Extreme Sports',
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/Red_Bull_TV_logo.svg/320px-Red_Bull_TV_logo.svg.png',
        country: 'Austria / Global',
        language: 'English',
        category: 'Sports',
        streamUrl: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
        sourceUrl: 'https://www.redbull.com/int-en/live-tv',
        sourceName: 'Red Bull Media House (Free Web Broadcast)',
        rightsStatus: 'FREE_TO_AIR',
        commercialUse: false,
        attributionRequired: true,
        attribution: 'Official open FAST feed provided by Red Bull Media House.',
        lastVerified: '2026-10-06T12:00:00.000Z',
        enabled: true,
        epgProgram: {
          current: 'UCI Mountain Bike World Cup Highlights',
          next: 'Cliff Diving World Championship Series',
          startTime: '04:00',
          endTime: '05:30',
        },
      },
      {
        id: 'ch-ptv-global',
        channelName: 'PTV Global Official',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/PTV_Global_Logo.png/320px-PTV_Global_Logo.png',
        country: 'Pakistan',
        language: 'Urdu',
        category: 'Culture',
        streamUrl: 'https://linear-143.frequency.stream/mt/studio/143/hls/master/playlist.m3u8',
        sourceUrl: 'https://www.ptv.com.pk/',
        sourceName: 'Pakistan Television Corporation (State Broadcaster)',
        rightsStatus: 'PUBLIC_BROADCAST',
        commercialUse: true,
        attributionRequired: true,
        attribution: 'National public broadcaster of Pakistan, international satellite stream.',
        lastVerified: '2026-10-06T12:00:00.000Z',
        enabled: true,
        epgProgram: {
          current: 'Khabarnama & National Bulletin',
          next: 'Heritage of the Indus Valley',
          startTime: '04:00',
          endTime: '05:00',
        },
      },
    ];

    initialChannels.forEach((ch) => this.channels.set(ch.id, ch));

    // 5. Seed Legal Free / Public Domain / Open Cinema Movies
    // Strictly verified public domain or Creative Commons attribution
    const initialMovies: Movie[] = [
      {
        id: 'mov-charade-1963',
        title: 'Charade',
        description: 'A suspenseful romantic comedy thriller directed by Stanley Donen. A glamorous widow is pursued in Paris by mysterious men seeking her late husband’s stolen fortune, aided by a charming stranger who keeps changing identities.',
        poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Charade_1963_poster.jpg/440px-Charade_1963_poster.jpg',
        backdrop: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Charade_trailer_Grant_Hepburn.jpg/1280px-Charade_trailer_Grant_Hepburn.jpg',
        year: 1963,
        genre: ['Mystery', 'Romantic Comedy', 'Thriller'],
        duration: '1h 53m',
        language: 'English',
        rating: '7.9/10',
        videoUrl: 'https://archive.org/download/Charade1963_201608/Charade1963.mp4',
        trailerUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        source: 'Internet Archive Public Domain Feature Collection',
        license: 'Public Domain (USA)',
        licenseUrl: 'https://archive.org/details/Charade1963_201608',
        attribution: 'Entered USA Public Domain due to release without valid statutory copyright notice.',
        rightsStatus: 'PUBLIC_DOMAIN',
        featured: true,
        trending: true,
        enabled: true,
      },
      {
        id: 'mov-night-living-dead-1968',
        title: 'Night of the Living Dead',
        description: 'George A. Romero’s iconic cinematic masterpiece. A disparate group of individuals seeks refuge in an abandoned farmhouse as reanimated corpses rise from cemeteries, creating an indelible landmark in psychological suspense.',
        poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Night_of_the_Living_Dead_theatrical_poster.jpg/440px-Night_of_the_Living_Dead_theatrical_poster.jpg',
        backdrop: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Night_of_the_Living_Dead_-_trailer_screencap.jpg/1280px-Night_of_the_Living_Dead_-_trailer_screencap.jpg',
        year: 1968,
        genre: ['Horror', 'Cult Classic', 'Sci-Fi'],
        duration: '1h 36m',
        language: 'English',
        rating: '7.8/10',
        videoUrl: 'https://archive.org/download/night_of_the_living_dead_1968_restored/night_of_the_living_dead_1968_restored_512kb.mp4',
        trailerUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        source: 'Internet Archive Restored Cinema Collection',
        license: 'Public Domain (USA)',
        licenseUrl: 'https://archive.org/details/night_of_the_living_dead_1968_restored',
        attribution: 'Immediate public domain status upon 1968 release due to distributor title-change omission.',
        rightsStatus: 'PUBLIC_DOMAIN',
        featured: true,
        trending: true,
        enabled: true,
      },
      {
        id: 'mov-his-girl-friday-1940',
        title: 'His Girl Friday',
        description: 'Howard Hawks directs Cary Grant and Rosalind Russell in one of the most razor-sharp, rapid-fire screwball comedies ever filmed. A newspaper editor attempts to keep his star reporter and ex-wife from leaving the press room.',
        poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/His_Girl_Friday_poster.jpg/440px-His_Girl_Friday_poster.jpg',
        backdrop: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/His_Girl_Friday_title.jpg/1280px-His_Girl_Friday_title.jpg',
        year: 1940,
        genre: ['Comedy', 'Classic Cinema', 'Romance'],
        duration: '1h 32m',
        language: 'English',
        rating: '7.8/10',
        videoUrl: 'https://archive.org/download/HisGirlFriday_201509/HisGirlFriday.mp4',
        trailerUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        source: 'Library of Congress National Film Registry / Internet Archive',
        license: 'Public Domain (USA)',
        licenseUrl: 'https://archive.org/details/HisGirlFriday_201509',
        attribution: 'Copyright was not renewed in the 28th year; entered the public domain in 1968.',
        rightsStatus: 'PUBLIC_DOMAIN',
        featured: false,
        trending: true,
        enabled: true,
      },
      {
        id: 'mov-tears-of-steel-2012',
        title: 'Tears of Steel',
        description: 'Set in a dystopian future Amsterdam, a group of scientists and soldiers attempt to stage a crucial memory recreation from the past in a desperate attempt to rescue humanity from an impending mechanical singularity.',
        poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Tears_of_Steel_poster.jpg/440px-Tears_of_Steel_poster.jpg',
        backdrop: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Tears_of_Steel_crowd.jpg/1280px-Tears_of_Steel_crowd.jpg',
        year: 2012,
        genre: ['Sci-Fi', 'Action', 'VFX Showcase'],
        duration: '12m',
        language: 'English',
        rating: '7.2/10',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        trailerUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        source: 'Blender Foundation Open Movie Project',
        license: 'Creative Commons Attribution 3.0 (CC BY 3.0)',
        licenseUrl: 'https://mango.blender.org/sharing/',
        attribution: '(CC) Blender Foundation | mango.blender.org',
        rightsStatus: 'OPEN_LICENSE',
        featured: true,
        trending: true,
        enabled: true,
      },
      {
        id: 'mov-the-general-1926',
        title: 'The General',
        description: 'Buster Keaton’s silent screen epic, regarded by critics as one of the greatest motion pictures of all time. Spectacular physical choreography, authentic locomotive chases, and timeless visual genius.',
        poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/The_General_1926.jpg/440px-The_General_1926.jpg',
        backdrop: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Keaton_The_General_1.jpg/1280px-Keaton_The_General_1.jpg',
        year: 1926,
        genre: ['Silent Era', 'Action', 'Comedy'],
        duration: '1h 19m',
        language: 'Silent / English Cards',
        rating: '8.1/10',
        videoUrl: 'https://archive.org/download/TheGeneralBusterKeaton/TheGeneral.mp4',
        trailerUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        source: 'Internet Archive Motion Picture Archive',
        license: 'Public Domain Worldwide',
        licenseUrl: 'https://archive.org/details/TheGeneralBusterKeaton',
        attribution: 'Expired term copyright; worldwide public domain archive.',
        rightsStatus: 'PUBLIC_DOMAIN',
        featured: false,
        trending: false,
        enabled: true,
      },
      {
        id: 'mov-carnival-souls-1962',
        title: 'Carnival of Souls',
        description: 'After surviving a miraculous car plunge off a bridge, Mary Henry moves to Utah to take a church organist post, only to find herself magnetically drawn to a shadowy deserted lakeside pavilion.',
        poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Carnival_of_Souls_1962_Poster.jpg/440px-Carnival_of_Souls_1962_Poster.jpg',
        backdrop: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Carnival_of_souls_trailer.jpg/1280px-Carnival_of_souls_trailer.jpg',
        year: 1962,
        genre: ['Psychological Horror', 'Mystery', 'Film Noir'],
        duration: '1h 18m',
        language: 'English',
        rating: '7.1/10',
        videoUrl: 'https://archive.org/download/Carnival_of_Souls_1962/Carnival_of_Souls_1962_512kb.mp4',
        trailerUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        source: 'Internet Archive Public Domain Feature Collection',
        license: 'Public Domain (USA)',
        licenseUrl: 'https://archive.org/details/Carnival_of_Souls_1962',
        attribution: 'Released without copyright notice, permanently in public domain.',
        rightsStatus: 'PUBLIC_DOMAIN',
        featured: false,
        trending: false,
        enabled: true,
      },
      {
        id: 'mov-big-buck-bunny-2008',
        title: 'Big Buck Bunny',
        description: 'A cheerful giant rabbit endures the unruly forest antics of mischievous bullies Frank the flying squirrel, Rinky, and Gamera, before crafting an elaborate, hilarious payback mechanism.',
        poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/440px-Big_buck_bunny_poster_big.jpg',
        backdrop: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Big_Buck_Bunny_first_23_seconds_1080p.ogv/1280px--Big_Buck_Bunny_first_23_seconds_1080p.ogv.jpg',
        year: 2008,
        genre: ['Animation', 'Comedy', 'Family'],
        duration: '10m',
        language: 'English',
        rating: '7.5/10',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        trailerUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        source: 'Blender Foundation Open Movie Project',
        license: 'Creative Commons Attribution 3.0 (CC BY 3.0)',
        licenseUrl: 'https://peach.blender.org/',
        attribution: '(CC) Blender Foundation | peach.blender.org',
        rightsStatus: 'OPEN_LICENSE',
        featured: false,
        trending: true,
        enabled: true,
      },
      {
        id: 'mov-chronicles-solaris-2026',
        title: 'Solaris Drift: Deep Horizon',
        description: 'Acclaimed futuristic cinematic study of long-range solar expedition telemetry. Full feature streaming rights pending festival distribution window; official 4K preview trailer available for public streaming.',
        poster: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80',
        backdrop: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1280&auto=format&fit=crop&q=80',
        year: 2026,
        genre: ['Sci-Fi', 'Documentary', 'Space'],
        duration: '1h 48m',
        language: 'English',
        rating: '8.4/10',
        // Notice videoUrl is undefined, enforcing TRAILER_ONLY requirement!
        trailerUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        source: 'Authorized Festival Syndicate Trailer Distribution',
        license: 'Promotional Trailer Rights Authorized',
        licenseUrl: 'https://aetherstream.tv/licenses/trailer-syndicate',
        attribution: 'Official studio trailer provided under promotional media distribution agreement.',
        rightsStatus: 'TRAILER_ONLY',
        featured: true,
        trending: false,
        enabled: true,
      },
    ];

    initialMovies.forEach((m) => this.movies.set(m.id, m));

    // 6. Seed Watchlist & Continue Watching for customer
    const userWatchlist = new Set<string>();
    userWatchlist.add('mov-charade-1963');
    userWatchlist.add('ch-dw-english');
    userWatchlist.add('mov-tears-of-steel-2012');
    this.watchlist.set(member1.id, userWatchlist);

    const historyMap = new Map<string, WatchProgress>();
    historyMap.set('mov-charade-1963', {
      contentId: 'mov-charade-1963',
      contentType: 'movie',
      positionSeconds: 2840,
      durationSeconds: 6780,
      completed: false,
      lastWatchedAt: '2026-10-06T20:15:00.000Z',
      title: 'Charade',
      poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Charade_1963_poster.jpg/440px-Charade_1963_poster.jpg',
    });
    historyMap.set('mov-tears-of-steel-2012', {
      contentId: 'mov-tears-of-steel-2012',
      contentType: 'movie',
      positionSeconds: 710,
      durationSeconds: 720,
      completed: true,
      lastWatchedAt: '2026-10-05T14:22:00.000Z',
      title: 'Tears of Steel',
      poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Tears_of_Steel_poster.jpg/440px-Tears_of_Steel_poster.jpg',
    });
    this.watchHistory.set(member1.id, historyMap);

    // 7. Seed Sample Takedown / DMCA Item for Admin Takedown Review Queue
    this.takedownRequests.push({
      id: 'tk-101',
      contentId: 'mov-sample-archived',
      contentTitle: 'Legacy Archive Reel 1941 (Audited)',
      claimantName: 'Elena Rostova',
      claimantEmail: 'rights-inquiry@heritagefilm.org',
      copyrightOwner: 'Heritage Cinema Foundation',
      allegedInfringementUrl: 'https://aetherstream.tv/movies/sample-archived',
      statement: 'Clarification requested regarding international distribution territory rights.',
      status: 'UNDER_REVIEW',
      createdAt: '2026-10-04T09:12:00.000Z',
      notes: 'Item temporarily disabled pending copyright certificate cross-verification.',
    });

    this.logAdminAction('SYSTEM_BOOT', 'Aether Stream core relational in-memory database initialized successfully.');
  }

  public recalculatePilotSlots() {
    this.pilotSettings.currentMembers = this.users.size;
    let active = 0;
    this.userStatus.forEach((status) => {
      if (status === 'active') active++;
    });
    this.pilotSettings.activeMembers = active;
    this.pilotSettings.remainingSlots = Math.max(0, this.pilotSettings.maxPrivateUsers - this.users.size);
  }

  public getMembers(): MemberAccount[] {
    return Array.from(this.users.values()).map((u) => {
      const devList = this.devices.get(u.id) || [];
      const status = this.userStatus.get(u.id) || 'active';
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        status,
        role: u.role === 'admin' ? 'admin' : 'member',
        devicesCount: devList.length,
        createdAt: u.createdAt,
        lastActiveAt: devList[0]?.lastActive || 'Recently',
      };
    });
  }

  public createMember(name: string, email: string, password: string): { success: boolean; member?: MemberAccount; error?: string } {
    if (this.users.size >= this.pilotSettings.maxPrivateUsers) {
      return {
        success: false,
        error: `Pilot member limit reached (${this.users.size}/${this.pilotSettings.maxPrivateUsers} members). Increase MAX_PRIVATE_USERS in Settings to invite more.`,
      };
    }

    const emailNorm = email.toLowerCase().trim();
    const existing = Array.from(this.users.values()).find((u) => u.email.toLowerCase() === emailNorm);
    if (existing) {
      return { success: false, error: 'A member with this email already exists.' };
    }

    const newId = `usr-member-${Date.now().toString(36)}`;
    const newMember: User = {
      id: newId,
      email: emailNorm,
      name: name.trim(),
      role: 'customer',
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=111722&textColor=F5F7FA`,
      createdAt: new Date().toISOString(),
    };

    this.users.set(newId, newMember);
    this.userPasswords.set(emailNorm, password);
    this.userStatus.set(newId, 'active');
    this.devices.set(newId, []);

    // Create private pilot pass
    this.subscriptions.set(newId, {
      id: `sub-pilot-${newId}`,
      userId: newId,
      tier: 'iptv_vip',
      status: 'active',
      packageName: 'Private Pilot Member Access Pass',
      activationDate: new Date().toISOString(),
      expiryDate: '2027-03-01T00:00:00.000Z',
      maxDevices: this.pilotSettings.maxDevicesPerUser,
      activeDevices: 0,
      autoRenew: true,
    });

    this.recalculatePilotSlots();
    this.logAdminAction('CREATE_MEMBER', `Created private pilot member: ${newMember.name} (${newMember.email})`);

    return {
      success: true,
      member: {
        id: newId,
        email: newMember.email,
        name: newMember.name,
        status: 'active',
        role: 'member',
        devicesCount: 0,
        createdAt: newMember.createdAt,
      },
    };
  }

  public toggleMemberStatus(userId: string): { success: boolean; status?: 'active' | 'disabled'; error?: string } {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: 'Member not found' };
    if (user.role === 'admin') return { success: false, error: 'Cannot disable primary Administrator' };

    const currentStatus = this.userStatus.get(userId) || 'active';
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    this.userStatus.set(userId, newStatus);
    this.recalculatePilotSlots();
    this.logAdminAction('TOGGLE_MEMBER_STATUS', `Member ${user.name} status updated to ${newStatus}`);
    return { success: true, status: newStatus };
  }

  public deleteMember(userId: string): { success: boolean; error?: string } {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: 'Member not found' };
    if (user.role === 'admin') return { success: false, error: 'Cannot delete primary Administrator' };

    this.users.delete(userId);
    this.userPasswords.delete(user.email.toLowerCase());
    this.userStatus.delete(userId);
    this.subscriptions.delete(userId);
    this.devices.delete(userId);
    this.watchlist.delete(userId);
    this.watchHistory.delete(userId);
    this.memberIptvLines.delete(userId);

    this.recalculatePilotSlots();
    this.logAdminAction('DELETE_MEMBER', `Removed private pilot member: ${user.name}`);
    return { success: true };
  }

  public resetMemberPassword(userId: string, newPass: string): { success: boolean; error?: string } {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: 'Member not found' };

    this.userPasswords.set(user.email.toLowerCase(), newPass);
    this.logAdminAction('RESET_MEMBER_PASSWORD', `Password reset for member ${user.name}`);
    return { success: true };
  }

  // ==========================================================================
  // PER-MEMBER STAR IPTV LINE VAULT (server-side only)
  // ==========================================================================

  public assignIptvLine(userId: string, line: MemberIptvLine): { success: boolean; error?: string } {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: 'Member not found' };
    this.memberIptvLines.set(userId, line);
    this.logAdminAction('ASSIGN_IPTV_LINE', `Star IPTV line assigned to member ${user.name} (${maskLineUser(line.username)})`);
    return { success: true };
  }

  public getIptvLine(userId: string): MemberIptvLine | undefined {
    return this.memberIptvLines.get(userId);
  }

  public clearIptvLine(userId: string): { success: boolean; error?: string } {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: 'Member not found' };
    if (!this.memberIptvLines.has(userId)) return { success: false, error: 'No IPTV line assigned' };
    this.memberIptvLines.delete(userId);
    this.logAdminAction('CLEAR_IPTV_LINE', `Star IPTV line unassigned from member ${user.name}`);
    return { success: true };
  }

  public getIptvLines(): MemberIptvLine[] {
    return Array.from(this.memberIptvLines.values());
  }

  public revokeDevice(userId: string, deviceId: string): boolean {
    const currentList = this.devices.get(userId) || [];
    const filtered = currentList.filter((d) => d.id !== deviceId);
    this.devices.set(userId, filtered);
    this.logAdminAction('REVOKE_DEVICE', `Revoked device ${deviceId} for user ${userId}`);
    return true;
  }

  public getAllDevices(): Array<{
    userId: string;
    userName: string;
    userEmail: string;
    device: DeviceInfo;
  }> {
    const list: Array<{ userId: string; userName: string; userEmail: string; device: DeviceInfo }> = [];
    this.devices.forEach((devs, userId) => {
      const u = this.users.get(userId);
      devs.forEach((d) => {
        list.push({
          userId,
          userName: u ? u.name : 'Pilot Member',
          userEmail: u ? u.email : '',
          device: d,
        });
      });
    });
    return list;
  }

  public getAllWatchHistory(): Array<{
    id: string;
    userId: string;
    userName: string;
    contentId: string;
    contentTitle: string;
    contentType: 'channel' | 'movie';
    watchedAt: string;
    progressPercentage: number;
  }> {
    const list: Array<{
      id: string;
      userId: string;
      userName: string;
      contentId: string;
      contentTitle: string;
      contentType: 'channel' | 'movie';
      watchedAt: string;
      progressPercentage: number;
    }> = [];

    this.watchHistory.forEach((histMap, userId) => {
      const u = this.users.get(userId);
      histMap.forEach((p, contentId) => {
        const pct = p.durationSeconds > 0 ? Math.round((p.positionSeconds / p.durationSeconds) * 100) : 100;
        list.push({
          id: `${userId}-${contentId}`,
          userId,
          userName: u ? u.name : 'Pilot Member',
          contentId,
          contentTitle: p.title,
          contentType: p.contentType,
          watchedAt: p.lastWatchedAt,
          progressPercentage: pct,
        });
      });
    });

    return list.sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime());
  }

  public logAdminAction(action: string, details: string) {
    // eslint-disable-next-line no-use-before-define
    this.adminLogs.unshift({
      id: `adm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
    });
    if (this.adminLogs.length > 200) {
      this.adminLogs.pop();
    }
  }

  public getAdminStats(): AdminStats {
    const activeSubs = Array.from(this.subscriptions.values()).filter((s) => s.status === 'active').length;
    const channelsList = Array.from(this.channels.values());
    const moviesList = Array.from(this.movies.values());

    this.recalculatePilotSlots();

    return {
      totalUsers: this.users.size,
      maxPrivateUsers: this.pilotSettings.maxPrivateUsers,
      activeMembers: this.pilotSettings.activeMembers,
      remainingSlots: this.pilotSettings.remainingSlots,
      activeSubscriptions: activeSubs,
      expiringSubscriptions: 0,
      totalChannels: channelsList.length,
      activeChannels: channelsList.filter((c) => c.enabled).length,
      m3uImportedCount: this.m3uChannels.size,
      totalMovies: moviesList.length,
      activeMovies: moviesList.filter((m) => m.enabled).length,
      pendingTakedowns: this.takedownRequests.filter((t) => t.status === 'PENDING' || t.status === 'UNDER_REVIEW').length,
      starIptvStatus: 'Ready for Credentials',
      epgStatus: 'Cached & Active',
      systemHealth: 'optimal',
    };
  }
}

/** Mask a line username for safe display/logs: keep first 4 chars only. */
function maskLineUser(username: string): string {
  const u = (username || '').trim();
  if (!u) return '••••';
  return u.length <= 4 ? `${u}••••` : `${u.slice(0, 4)}••••`;
}

export const db = new DataStore();
