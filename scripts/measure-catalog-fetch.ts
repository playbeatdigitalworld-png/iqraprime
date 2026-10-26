/**
 * Measure the provider full-list fetch (search-index cold path).
 * Uses the vault line from server config (same as production).
 */
import { starIptvProvider } from '../server/starIptvProvider.js';

async function main() {
  const vault = starIptvProvider.getVaultLine();
  if (!vault) {
    console.log('no vault line configured');
    return;
  }
  console.log('host:', new URL(vault.serverUrl).host);
  for (const action of ['get_vod_streams', 'get_series']) {
    const url = `${vault.serverUrl.replace(/\/+$/, '')}/player_api.php?username=${encodeURIComponent(vault.username)}&password=${encodeURIComponent(vault.password)}&action=${action}`;
    const t0 = Date.now();
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'AetherStream-PrivatePilot/1.0' } });
      const text = await res.text();
      const fetchedMs = Date.now() - t0;
      const t1 = Date.now();
      const parsed = JSON.parse(text);
      const count = Array.isArray(parsed) ? parsed.length : 0;
      console.log(`${action}: bytes=${text.length} fetch=${fetchedMs}ms parse=${Date.now() - t1}ms items=${count} total=${Date.now() - t0}ms`);
    } catch (e: any) {
      console.log(`${action}: ERR after ${Date.now() - t0}ms — ${e.message}`);
    }
  }
}
main();
