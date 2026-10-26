import { Channel, Category, Playlist } from '../types/iptv';
import { DEFAULT_PREMIUM_CATEGORIES } from '../data/categories';

/**
 * Parses raw M3U / M3U8 playlist text into structured Channels and Categories
 */
export function parseM3U(
  rawContent: string,
  playlistName: string = 'Imported Playlist',
  sourceUrl?: string
): { channels: Channel[]; categories: Category[] } {
  const lines = rawContent.split(/\r?\n/);
  const channels: Channel[] = [];
  const categoryMap = new Map<string, Category>();

  // Initialize with standard categories
  DEFAULT_PREMIUM_CATEGORIES.forEach((cat) => {
    categoryMap.set(cat.id, { ...cat });
    categoryMap.set(cat.name.toLowerCase(), { ...cat });
  });

  let currentExtinf: string | null = null;
  let lineCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      currentExtinf = line;
      continue;
    }

    // Skip other comment tags like #EXTVLCOPT, #EXTGRP, etc. but capture #EXTGRP if present
    if (line.startsWith('#')) {
      continue;
    }

    // If we have a URL line and a preceding #EXTINF
    if (currentExtinf && (line.startsWith('http://') || line.startsWith('https://') || line.startsWith('rtmp://') || line.includes('://') || line.endsWith('.ts') || line.endsWith('.m3u8'))) {
      lineCount++;
      const channel = parseExtinfLine(currentExtinf, line, lineCount, categoryMap);
      channels.push(channel);
      currentExtinf = null;
    }
  }

  // Extract unique categories found in channels
  const usedCategories = new Map<string, Category>();
  DEFAULT_PREMIUM_CATEGORIES.forEach((c) => usedCategories.set(c.id, c));

  channels.forEach((ch) => {
    const cat = categoryMap.get(ch.category);
    if (cat && !usedCategories.has(cat.id)) {
      usedCategories.set(cat.id, cat);
    }
  });

  return {
    channels,
    categories: Array.from(usedCategories.values()).sort((a, b) => a.order - b.order),
  };
}

function parseExtinfLine(
  extinf: string,
  streamUrl: string,
  index: number,
  categoryMap: Map<string, Category>
): Channel {
  // Regex to extract key="value" or key=value attributes
  const getAttr = (key: string): string => {
    const regex = new RegExp(`${key}=(?:"([^"]*)"|'([^']*)'|([^\\s,]+))`, 'i');
    const match = extinf.match(regex);
    return match ? (match[1] ?? match[2] ?? match[3] ?? '').trim() : '';
  };

  // Channel title is after the last comma
  const commaIndex = extinf.lastIndexOf(',');
  let rawTitle = commaIndex !== -1 ? extinf.substring(commaIndex + 1).trim() : '';
  if (!rawTitle) {
    rawTitle = getAttr('tvg-name') || `Channel ${index}`;
  }

  const tvgId = getAttr('tvg-id') || getAttr('id') || `ch_${index}`;
  const tvgName = getAttr('tvg-name') || rawTitle;
  const tvgLogo = getAttr('tvg-logo') || getAttr('logo') || '';
  const groupTitle = getAttr('group-title') || getAttr('group') || '';
  const tvgCountry = getAttr('tvg-country') || '';
  const tvgLang = getAttr('tvg-language') || '';
  const tvgChno = getAttr('tvg-chno') || getAttr('channel-id') || index;

  // Infer Category
  const categoryId = resolveCategory(groupTitle, rawTitle, categoryMap);

  // Infer Country
  const country = resolveCountry(tvgCountry, groupTitle, rawTitle);

  // Infer Language
  const language = resolveLanguage(tvgLang, country, rawTitle);

  // Infer Resolution
  const resolution = detectResolution(rawTitle, streamUrl);

  const isFeatured = /VIP|4K|PREMIUM|UHD|GOLD/i.test(rawTitle) || /premium|featured/i.test(groupTitle);

  return {
    id: `ch_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`,
    name: rawTitle,
    logo: tvgLogo,
    streamUrl,
    category: categoryId,
    country,
    language,
    epgId: tvgId,
    channelNumber: tvgChno,
    status: 'active',
    isFeatured,
    isFavorite: false,
    resolution,
    fps: resolution?.includes('4K') ? 60 : 50,
    bitrate: resolution?.includes('4K') ? '18.4 Mbps' : '8.2 Mbps',
    addedAt: new Date().toISOString(),
  };
}

function resolveCategory(
  group: string,
  title: string,
  categoryMap: Map<string, Category>
): string {
  const g = group.toLowerCase();
  const t = title.toLowerCase();

  if (g.includes('sport') || t.includes('sport') || t.includes('espn') || t.includes('super sport') || t.includes('arena sport')) {
    return 'sports';
  }
  if (g.includes('movie') || g.includes('cinema') || t.includes('cinema') || t.includes('hbo') || t.includes('film')) {
    return 'movies';
  }
  if (g.includes('news') || t.includes('news') || t.includes('cnn') || t.includes('bbc') || t.includes('al jazeera')) {
    return 'news';
  }
  if (g.includes('kid') || g.includes('cartoon') || t.includes('cartoon') || t.includes('disney') || t.includes('nickelodeon')) {
    return 'kids';
  }
  if (g.includes('music') || t.includes('mtv') || t.includes('radio') || t.includes('hits')) {
    return 'music';
  }
  if (g.includes('usa') || g.includes('us ') || t.startsWith('us:') || t.includes('[us]')) {
    return 'usa';
  }
  if (g.includes('uk') || t.startsWith('uk:') || t.includes('[uk]')) {
    return 'uk';
  }
  if (g.includes('canada') || t.startsWith('ca:') || t.includes('[ca]')) {
    return 'canada';
  }
  if (g.includes('australia') || t.startsWith('au:') || t.includes('[au]')) {
    return 'australia';
  }
  if (g.includes('pakistan') || t.startsWith('pk:') || t.includes('[pk]')) {
    return 'pakistan';
  }
  if (g.includes('india') || t.startsWith('in:') || t.includes('[in]')) {
    return 'india';
  }
  if (g.includes('uae') || g.includes('arabic') || t.startsWith('ar:') || t.includes('[ae]')) {
    return 'uae';
  }
  if (g.includes('relig') || g.includes('islam') || g.includes('quran') || t.includes('quran') || t.includes('makkah')) {
    return 'religious';
  }
  if (g.includes('business') || t.includes('bloomberg') || t.includes('cnbc')) {
    return 'business';
  }
  if (g.includes('family') || t.includes('family')) {
    return 'family';
  }
  if (g.includes('entertain') || t.includes('drama') || t.includes('comedy')) {
    return 'entertainment';
  }
  if (g.includes('premium') || g.includes('vip') || t.includes('vip') || t.includes('4k raw')) {
    return 'premium-featured';
  }

  // If group title is non-empty and not matching, check if we need to register a custom category
  if (group && group.trim().length > 1) {
    const safeGroupId = group.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 24);
    if (!categoryMap.has(safeGroupId)) {
      categoryMap.set(safeGroupId, {
        id: safeGroupId,
        name: group.trim(),
        icon: '📺',
        order: categoryMap.size + 1,
      });
    }
    return safeGroupId;
  }

  return 'live-tv';
}

function resolveCountry(countryAttr: string, group: string, title: string): string {
  if (countryAttr && countryAttr.trim()) return countryAttr.toUpperCase();

  const combined = `${group} ${title}`.toUpperCase();
  if (combined.includes('USA') || combined.includes('UNITED STATES') || combined.includes('[US]') || combined.startsWith('US:')) return 'USA';
  if (combined.includes('UK') || combined.includes('UNITED KINGDOM') || combined.includes('[UK]') || combined.startsWith('UK:')) return 'UK';
  if (combined.includes('CANADA') || combined.includes('[CA]') || combined.startsWith('CA:')) return 'Canada';
  if (combined.includes('AUSTRALIA') || combined.includes('[AU]') || combined.startsWith('AU:')) return 'Australia';
  if (combined.includes('PAKISTAN') || combined.includes('[PK]') || combined.startsWith('PK:')) return 'Pakistan';
  if (combined.includes('INDIA') || combined.includes('[IN]') || combined.startsWith('IN:')) return 'India';
  if (combined.includes('UAE') || combined.includes('DUBAI') || combined.includes('ARABIC')) return 'UAE';
  if (combined.includes('FRANCE') || combined.includes('[FR]')) return 'France';
  if (combined.includes('GERMANY') || combined.includes('[DE]')) return 'Germany';
  if (combined.includes('SPAIN') || combined.includes('[ES]')) return 'Spain';
  if (combined.includes('ITALY') || combined.includes('[IT]')) return 'Italy';
  return 'International';
}

function resolveLanguage(langAttr: string, country: string, title: string): string {
  if (langAttr && langAttr.trim()) return langAttr;
  if (country === 'USA' || country === 'UK' || country === 'Canada' || country === 'Australia') return 'English';
  if (country === 'Pakistan') return 'Urdu';
  if (country === 'India') return 'Hindi / Multi';
  if (country === 'UAE') return 'Arabic';
  if (country === 'France') return 'French';
  if (country === 'Germany') return 'German';
  if (country === 'Spain') return 'Spanish';
  if (country === 'Italy') return 'Italian';
  return 'English';
}

function detectResolution(title: string, url: string): Channel['resolution'] {
  const t = `${title} ${url}`.toUpperCase();
  if (t.includes('4K HDR') || t.includes('4K-HDR')) return '4K HDR';
  if (t.includes('4K') || t.includes('UHD') || t.includes('2160P')) return '4K UHD';
  if (t.includes('1080P') || t.includes('FHD') || t.includes('FULL HD')) return 'FHD 1080p';
  if (t.includes('720P') || t.includes('HD')) return 'HD 720p';
  return 'FHD 1080p';
}

/**
 * Serializes a playlist into standard M3U / M3U8 string
 */
export function exportToM3U(
  playlist: Playlist,
  categories: Category[],
  options: { includePlusTags?: boolean; filterCategory?: string } = {}
): string {
  const { includePlusTags = true, filterCategory } = options;

  const catMap = new Map<string, string>();
  categories.forEach((c) => catMap.set(c.id, c.name));

  let out = '#EXTM3U\n';
  if (playlist.name) {
    out += `## Playlist: ${playlist.name}\n`;
    out += `## Generated by IPTV Studio Pro on ${new Date().toISOString()}\n\n`;
  }

  const channelsToExport = filterCategory && filterCategory !== 'all'
    ? playlist.channels.filter((c) => c.category === filterCategory)
    : playlist.channels;

  channelsToExport.forEach((ch) => {
    const groupName = catMap.get(ch.category) || 'General';
    if (includePlusTags) {
      out += `#EXTINF:-1 tvg-id="${ch.epgId}" tvg-name="${ch.name}" tvg-logo="${ch.logo}" group-title="${groupName}" tvg-country="${ch.country}" tvg-language="${ch.language}" tvg-chno="${ch.channelNumber}",${ch.name}\n`;
    } else {
      out += `#EXTINF:-1,${ch.name}\n`;
    }
    out += `${ch.streamUrl}\n`;
  });

  return out;
}
