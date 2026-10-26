/** Probe the provider's Xtream catalog surface for one line (masked output). */
const HOST = 'http://advance.playbeat.live:8880';
const USER = process.env.P_USER || '';
const PASS = process.env.P_PASS || '';
const UA = 'AetherStream-PrivatePilot/1.0';

async function api(action: string, extra = ''): Promise<any> {
  const url = `${HOST}/player_api.php?username=${encodeURIComponent(USER)}&password=${encodeURIComponent(PASS)}&action=${action}${extra}`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 60000);
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
  clearTimeout(to);
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${action}`);
  return res.json();
}

const ADULT = /xxx|adult|18\s*\+|porn|erotic|playboy|brazzers|venus|hustler|nubile|private\s*\(18|red\s*light/i;

function summarizeCats(cats: any[], label: string) {
  const adult = cats.filter(c => ADULT.test(c.category_name));
  console.log(`${label}: ${cats.length} categories (${adult.length} adult-excluded) -> ${cats.length - adult.length} safe`);
  return cats.filter(c => !ADULT.test(c.category_name));
}

async function main() {
  console.log('== probing line', USER.slice(0, 4) + '**** ==');
  const liveCats = summarizeCats(await api('get_live_categories'), 'LIVE ');
  const vodCats = summarizeCats(await api('get_vod_categories'), 'VOD  ');
  const seriesCats = summarizeCats(await api('get_series_categories'), 'SERIES');

  // sample one category per type to see item shapes + sizes
  const liveSample = await api('get_live_streams', `&category_id=${liveCats[0].category_id}`);
  console.log(`LIVE sample category "${liveCats[0].category_name}": ${liveSample.length} streams; item keys: ${Object.keys(liveSample[0] || {}).join(',')}`);
  const vodSample = await api('get_vod_streams', `&category_id=${vodCats[0].category_id}`);
  console.log(`VOD  sample category "${vodCats[0].category_name}": ${vodSample.length} streams; item keys: ${Object.keys(vodSample[0] || {}).join(',')}`);
  const serSample = await api('get_series', `&category_id=${seriesCats[0].category_id}`);
  console.log(`SERIES sample category "${seriesCats[0].category_name}": ${serSample.length} items; item keys: ${Object.keys(serSample[0] || {}).join(',')}`);

  // totals (uncached) — measure only counts of one more category to gauge payload
  const t0 = Date.now();
  const vodSample2 = await api('get_vod_streams', `&category_id=${vodCats[1].category_id}`);
  console.log(`VOD  category 2 "${vodCats[1].category_name}": ${vodSample2.length} items in ${Date.now() - t0}ms`);

  // VOD info + series info shapes
  if (vodSample.length) {
    const id = vodSample[0].stream_id;
    const info = await api('get_vod_info', `&vod_id=${id}`);
    const mi = info?.info || {};
    console.log(`VOD info keys: ${Object.keys(mi).join(',')}`);
    console.log(`VOD movie_data: ${JSON.stringify(info?.movie_data || {}).slice(0, 200)}`);
    console.log(`VOD sample: name="${String(mi.name || '').slice(0, 40)}", container=${mi.container_extension}, duration=${mi.duration}, video=${String(mi.video || {}).slice(0, 60)}`);
  }
  if (serSample.length) {
    const sid = serSample[0].series_id;
    const sinfo = await api('get_series_info', `&series_id=${sid}`);
    console.log(`SERIES info keys: ${Object.keys(sinfo || {}).join(',')}`);
    const seasons = sinfo?.episodes ? Object.keys(sinfo.episodes) : [];
    console.log(`SERIES seasons: ${seasons.join(',')}`);
    if (seasons.length) {
      const ep = sinfo.episodes[seasons[0]][0];
      console.log(`EPISODE keys: ${Object.keys(ep).join(',')}`);
      console.log(`EPISODE sample: title="${String(ep.title || '').slice(0, 40)}", ext=${ep.container_extension}, id=${ep.id}`);
    }
  }
}
main().catch(e => { console.error('FATAL', e.message || e); process.exit(1); });
