/**
 * Region & country classification for the "Explore by Country & Region" home
 * section — FRONTEND-ONLY normalization of the provider's own category names.
 *
 * Honesty rules (Phase 2 spec §13 + pre-merge review fix):
 *  - A category is only attributed to a country/region when its PROVIDER-GIVEN
 *    name carries an explicit, well-known prefix ("UK - Entertainment - Live",
 *    "IN: Bollywood", "USA - Sports - Live"). Country is NEVER inferred from
 *    titles, cast, posters, language or popularity.
 *  - LANGUAGES ARE NOT COUNTRIES. Language collection prefixes ("Arabic",
 *    "Kurdish", "French", "Deutsch", "Latino", "Filipino", "Bangla",
 *    "Persian", …) are deliberately NOT mapped to any country — such
 *    categories simply stay unattributed instead of claiming a homeland.
 *  - Ambiguous codes that could mean several things (e.g. "AF", "SW", "PR",
 *    "EN") are deliberately NOT mapped.
 *  - Regions/countries with zero matching categories never render.
 *  - No backend or schema changes: this consumes the existing public
 *    /api/catalog/categories endpoint per type (live / vod / series).
 */

import type { CatalogCategory } from '../../types/index.js';

export type RegionKey =
  | 'south-asia'
  | 'middle-east'
  | 'east-asia'
  | 'europe'
  | 'north-america'
  | 'south-america'
  | 'africa';

export interface RegionDef {
  key: RegionKey;
  name: string;
  tagline: string;
  /** Two accent glows for the cinematic region card art (official palette family). */
  glow: string;
  glow2: string;
}

export interface CountryDef {
  /** Stable key, e.g. "uk". */
  key: string;
  label: string;
  region: RegionKey;
  /** Case-insensitive anchored prefixes that identify this country in provider category names. */
  match: string[];
}

export const REGIONS: RegionDef[] = [
  { key: 'south-asia', name: 'South Asia', tagline: 'Dramas, cricket & color', glow: 'rgba(255,94,58,0.4)', glow2: 'rgba(229,9,58,0.3)' },
  { key: 'middle-east', name: 'Middle East', tagline: 'Series, news & faith', glow: 'rgba(194,10,66,0.42)', glow2: 'rgba(255,140,66,0.22)' },
  { key: 'east-asia', name: 'East Asia', tagline: 'Bold new storytelling', glow: 'rgba(229,9,58,0.4)', glow2: 'rgba(192,21,127,0.26)' },
  { key: 'europe', name: 'Europe', tagline: 'Cinema without borders', glow: 'rgba(86,168,255,0.24)', glow2: 'rgba(229,9,58,0.3)' },
  { key: 'north-america', name: 'North America', tagline: 'Hits & premieres', glow: 'rgba(229,9,58,0.44)', glow2: 'rgba(192,21,127,0.24)' },
  { key: 'south-america', name: 'South America', tagline: 'Passion on screen', glow: 'rgba(255,140,66,0.34)', glow2: 'rgba(194,10,66,0.3)' },
  { key: 'africa', name: 'Africa', tagline: 'Stories from the continent', glow: 'rgba(255,166,58,0.3)', glow2: 'rgba(194,10,66,0.26)' },
];

/**
 * Conservative country table. Only prefixes that are unambiguous in this
 * provider's naming scheme are listed. Extend carefully — every entry here
 * becomes user-visible truth.
 */
export const COUNTRIES: CountryDef[] = [
  { key: 'in', label: 'India', region: 'south-asia', match: ['IN', 'INDIA'] },
  { key: 'pk', label: 'Pakistan', region: 'south-asia', match: ['PK', 'PAKISTAN'] },
  { key: 'bd', label: 'Bangladesh', region: 'south-asia', match: ['BD', 'BANGLADESH'] }, // "BANGLA" is the Bengali language — not mapped
  { key: 'np', label: 'Nepal', region: 'south-asia', match: ['NEPAL', 'NP'] },
  { key: 'lk', label: 'Sri Lanka', region: 'south-asia', match: ['SRI LANKA'] },
  // "Arabic" / "Kurdish" removed: languages, not countries (pre-merge review fix).
  // "AR", "ARABIC", "MENA", "KU", "KURD" prefixes intentionally stay unattributed.
  { key: 'tr', label: 'Türkiye', region: 'middle-east', match: ['TR', 'TURKIYE'] }, // "TURK" (Türkçe) not mapped
  { key: 'il', label: 'Israel', region: 'middle-east', match: ['ISRAEL'] },
  { key: 'ir', label: 'Iran', region: 'middle-east', match: ['IR', 'IRAN'] }, // "PERSIAN" (Farsi) not mapped
  { key: 'ph', label: 'Philippines', region: 'east-asia', match: ['PH', 'PILIPINAS'] }, // "FILIPINO"/"PINAY" (language) not mapped
  { key: 'uk', label: 'United Kingdom', region: 'europe', match: ['UK'] },
  { key: 'ie', label: 'Ireland', region: 'europe', match: ['IRELAND'] },
  { key: 'fr', label: 'France', region: 'europe', match: ['FR', 'FRANCE'] }, // "FRENCH" (language) not mapped
  { key: 'de', label: 'Germany', region: 'europe', match: ['DE', 'GERMANY'] }, // "DEUTSCH" (language) not mapped
  { key: 'nl', label: 'Netherlands', region: 'europe', match: ['NL', 'NEDERLAND'] }, // "DUTCH" (language) not mapped
  { key: 'pt', label: 'Portugal', region: 'europe', match: ['PT', 'PORTUGAL'] },
  { key: 'es', label: 'Spain', region: 'europe', match: ['ES', 'SPAIN'] }, // "ESPAN(OL)"/"LATINO" (Spanish-language) not mapped
  { key: 'it', label: 'Italy', region: 'europe', match: ['IT', 'ITALIA'] }, // "ITALIAN" (language) not mapped
  { key: 'pl', label: 'Poland', region: 'europe', match: ['PL', 'POLSKA', 'POLAND'] },
  { key: 'hu', label: 'Hungary', region: 'europe', match: ['HU', 'HUNGARY'] }, // "MAGYAR" (language) not mapped
  { key: 'gr', label: 'Greece', region: 'europe', match: ['GR', 'HELLAS'] }, // "GREEK" (language) not mapped
  { key: 'ro', label: 'Romania', region: 'europe', match: ['RO', 'ROMANIA'] },
  { key: 'al', label: 'Albania', region: 'europe', match: ['AL', 'ALBANIA'] }, // "SHQIP" (language) not mapped
  { key: 'lt', label: 'Lithuania', region: 'europe', match: ['LT', 'LIETUVA'] },
  { key: 'ru', label: 'Russia', region: 'europe', match: ['RU', 'RUSSIA'] },
  { key: 'exyu', label: 'Ex-Yugoslavia', region: 'europe', match: ['EXYU'] },
  { key: 'us', label: 'United States', region: 'north-america', match: ['USA', 'US ', 'U.S.'] },
  { key: 'ca', label: 'Canada', region: 'north-america', match: ['CANADA'] },
  { key: 'br', label: 'Brazil', region: 'south-america', match: ['BR', 'BRAZIL', 'BRASIL'] },
  { key: 'dstv', label: 'Sub-Saharan Africa', region: 'africa', match: ['DSTV'] },
];

/** Strip provider decoration from a category name for display. */
export function cleanCategoryName(name: string): string {
  return name
    .replace(/^[-:|=\s]+|[-:|=\s]+$/g, '')
    .replace(/^[-:|=\s]{2,}/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Attribute a provider category to a country using an ANCHORED prefix match.
 * Returns null when the name carries no explicit, unambiguous country prefix.
 */
export function classifyCategory(name: string): CountryDef | null {
  const n = name.trim().toUpperCase();
  for (const c of COUNTRIES) {
    for (const m of c.match) {
      const mm = m.trim().toUpperCase();
      if (mm === 'US ') {
        if (n.startsWith('US ') || n.startsWith('US-') || n.startsWith('US:') || n.startsWith('US|')) return c;
        continue;
      }
      if (n.startsWith(mm)) {
        // Guard: "IT:" vs "ITALY…" both fine; but "IN" must not catch "INDIA…"
        // (both map to India anyway). Require a separator OR an exact word-ish
        // boundary so e.g. "INTER..." never matches "IT".
        const next = n.charAt(mm.length);
        if (next === '' || /[\s\-:|./]/.test(next)) return c;
      }
    }
  }
  return null;
}

export interface CountryBucket {
  country: CountryDef;
  /** Category ids per catalog type attributed to this country. */
  categories: { live: CatalogCategory[]; vod: CatalogCategory[]; series: CatalogCategory[] };
  total: number;
}

export interface RegionBucket {
  region: RegionDef;
  countries: CountryBucket[];
  total: number;
}

export type CatalogType = 'live' | 'vod' | 'series';

/**
 * Build region/country buckets from the three real category lists.
 * Categories that carry no explicit country prefix are intentionally ignored.
 */
export function buildRegionBuckets(
  cats: { live: CatalogCategory[]; vod: CatalogCategory[]; series: CatalogCategory[] }
): RegionBucket[] {
  const map = new Map<string, CountryBucket>();
  const getBucket = (c: CountryDef): CountryBucket => {
    let b = map.get(c.key);
    if (!b) {
      b = { country: c, categories: { live: [], vod: [], series: [] }, total: 0 };
      map.set(c.key, b);
    }
    return b;
  };

  (['live', 'vod', 'series'] as CatalogType[]).forEach((type) => {
    for (const cat of cats[type] ?? []) {
      const country = classifyCategory(cat.name);
      if (!country) continue;
      const bucket = getBucket(country);
      bucket.categories[type].push(cat);
      bucket.total += 1;
    }
  });

  const buckets: RegionBucket[] = [];
  for (const region of REGIONS) {
    const countries = [...map.values()]
      .filter((b) => b.country.region === region.key && b.total > 0)
      .sort((a, b) => b.total - a.total);
    if (!countries.length) continue;
    buckets.push({
      region,
      countries,
      total: countries.reduce((n, b) => n + b.total, 0),
    });
  }
  buckets.sort((a, b) => b.total - a.total);
  return buckets;
}

export const REGION_CACHE_KEY = 'sp_region_buckets_v1';
export const REGION_CACHE_TTL = 30 * 60_000;

/** Fetch all three category lists (public endpoints) with a session cache. */
export async function fetchRegionBuckets(): Promise<RegionBucket[] | null> {
  try {
    const raw = sessionStorage.getItem(REGION_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.at && Date.now() - parsed.at < REGION_CACHE_TTL && Array.isArray(parsed.payload)) {
        return parsed.payload as RegionBucket[];
      }
    }
  } catch { /* cache unavailable */ }

  const { api } = await import('../../services/api.js');
  try {
    const [live, vod, series] = await Promise.all([
      api.getCatalogCategories('live'),
      api.getCatalogCategories('vod'),
      api.getCatalogCategories('series'),
    ]);
    const buckets = buildRegionBuckets({
      live: live.categories ?? [],
      vod: vod.categories ?? [],
      series: series.categories ?? [],
    });
    try {
      sessionStorage.setItem(REGION_CACHE_KEY, JSON.stringify({ at: Date.now(), payload: buckets }));
    } catch { /* storage full — non-fatal */ }
    return buckets;
  } catch {
    // Catalog unavailable (e.g. anonymous visitor with no line configured yet).
    return null;
  }
}
