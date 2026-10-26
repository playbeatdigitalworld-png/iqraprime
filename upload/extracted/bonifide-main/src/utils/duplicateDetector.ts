import { Channel, DuplicateGroup } from '../types/iptv';

export function findDuplicates(channels: Channel[]): {
  groups: DuplicateGroup[];
  duplicateChannelIds: Set<string>;
  totalDuplicates: number;
} {
  const urlMap = new Map<string, Channel[]>();
  const nameMap = new Map<string, Channel[]>();
  const duplicateIds = new Set<string>();
  const groups: DuplicateGroup[] = [];

  channels.forEach((ch) => {
    // Normalize URL
    const cleanUrl = ch.streamUrl.trim();
    if (cleanUrl) {
      const existing = urlMap.get(cleanUrl) || [];
      existing.push(ch);
      urlMap.set(cleanUrl, existing);
    }

    // Normalize Name
    const cleanName = ch.name.trim().toLowerCase();
    if (cleanName) {
      const existing = nameMap.get(cleanName) || [];
      existing.push(ch);
      nameMap.set(cleanName, existing);
    }
  });

  // URL duplicates (highest confidence)
  urlMap.forEach((matched, url) => {
    if (matched.length > 1) {
      groups.push({
        key: `URL: ${url.length > 40 ? url.substring(0, 40) + '...' : url}`,
        type: 'streamUrl',
        channels: matched,
      });
      // Mark all except first as duplicates
      matched.slice(1).forEach((c) => duplicateIds.add(c.id));
    }
  });

  // Name duplicates (if not already grouped by url)
  nameMap.forEach((matched, name) => {
    if (matched.length > 1) {
      // Check if this pair is already in url duplicates
      const ids = matched.map((m) => m.id);
      const isAlreadyCovered = groups.some(
        (g) => g.type === 'streamUrl' && matched.every((m) => g.channels.some((gc) => gc.id === m.id))
      );
      if (!isAlreadyCovered) {
        groups.push({
          key: `Name: ${matched[0].name}`,
          type: 'name',
          channels: matched,
        });
        matched.slice(1).forEach((c) => duplicateIds.add(c.id));
      }
    }
  });

  return {
    groups,
    duplicateChannelIds: duplicateIds,
    totalDuplicates: duplicateIds.size,
  };
}

/**
 * Automatically removes duplicates, keeping the highest quality / active channel
 */
export function deduplicateChannels(channels: Channel[]): {
  cleanedChannels: Channel[];
  removedCount: number;
} {
  const seenUrls = new Set<string>();
  const seenNames = new Set<string>();
  const cleaned: Channel[] = [];
  let removedCount = 0;

  // Sort channels so that Active and 4K channels are prioritized first
  const sorted = [...channels].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (b.status === 'active' && a.status !== 'active') return 1;
    if (a.isFeatured && !b.isFeatured) return -1;
    if (b.isFeatured && !a.isFeatured) return 1;
    return 0;
  });

  sorted.forEach((ch) => {
    const urlKey = ch.streamUrl.trim();
    const nameKey = ch.name.trim().toLowerCase();

    if (seenUrls.has(urlKey) || seenNames.has(nameKey)) {
      removedCount++;
    } else {
      seenUrls.add(urlKey);
      seenNames.add(nameKey);
      cleaned.push(ch);
    }
  });

  return {
    cleanedChannels: cleaned,
    removedCount,
  };
}
