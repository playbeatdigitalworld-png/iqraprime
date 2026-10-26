/**
 * Pre-merge review regression test — country/region taxonomy honesty.
 * Verifies: languages are NEVER classified as countries; explicit country
 * prefixes still classify correctly; ambiguous tokens stay unattributed.
 */
import { classifyCategory, buildRegionBuckets } from '../src/components/streamplay/RegionData.js';

let pass = 0, fail = 0;
function expect(name: string, wantKey: string | null) {
  const got = classifyCategory(name);
  const gotKey = got ? got.key : null;
  if (gotKey === wantKey) { pass++; console.log(`  PASS  "${name}" -> ${gotKey ?? 'unattributed'}`); }
  else { fail++; console.log(`  FAIL  "${name}" -> ${gotKey ?? 'unattributed'} (expected ${wantKey ?? 'unattributed'})`); }
}

console.log('Language prefixes must NOT map to countries:');
expect('AR - Movies', null);            // Arabic (was classified as "Arabic" country)
expect('ARABIC - News', null);
expect('MENA - Series', null);
expect('KURD - Drama', null);           // Kurdish
expect('KU - Music', null);
expect('FRENCH - Cinema', null);        // French ≠ France
expect('DEUTSCH - Kino', null);         // Deutsch ≠ Germany
expect('DUTCH - Series', null);         // Dutch ≠ Netherlands
expect('ESPANOL - Novelas', null);      // Español ≠ Spain
expect('LATINO - Mix', null);           // Latino ≠ Spain
expect('ITALIANI - Cinema', null);      // Italian language token
expect('MAGYAR - Film', null);
expect('GREEK TV', null);
expect('SHQIP - Muzik', null);
expect('PERSIAN Movies', null);         // Persian ≠ Iran
expect('FILIPINO - Teleserye', null);   // Filipino ≠ Philippines
expect('PINAY - Shows', null);
expect('BANGLA - Natok', null);         // Bangla ≠ Bangladesh
expect('TURK - Dizi', null);            // Türk (language) ≠ Türkiye

console.log('Explicit country prefixes must still classify:');
expect('UK - Entertainment - Live', 'uk');
expect('USA - Sports - Live', 'us');
expect('IN: Bollywood', 'in');
expect('INDIA Gold', 'in');
expect('PAKISTAN - Dramas', 'pk');
expect('FR - Series', 'fr');
expect('DE - Fussball', 'de');
expect('TR - Dizi', 'tr');
expect('IR - Cinema', 'ir');
expect('PH - Teleserye', 'ph');
expect('NL - Voetbal', 'nl');
expect('POLSKA - Filmy', 'pl');
expect('HELLAS TV', 'gr');
expect('BD - Natok', 'bd');

console.log('Boundary guards still hold:');
expect('INTER National News', null);    // "IN"/"IT" must not match inside words
expect('INVOICE Dashboard', null);
expect('Italian Summer Hits', null);    // word without separator must not match "IT"

console.log('Zero-match countries never render:');
const buckets = buildRegionBuckets({
  live: [{ id: 'c1', name: 'UK - Entertainment', channel_count: 5 } as any],
  vod: [],
  series: [],
});
const africaRendered = buckets.some((b) => b.region.key === 'africa');
if (!africaRendered) { pass++; console.log('  PASS  Africa (DStv) absent with zero matches'); }
else { fail++; console.log('  FAIL  Africa rendered with zero matches'); }

console.log(`\nTAXONOMY RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
