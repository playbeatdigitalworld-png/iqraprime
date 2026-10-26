import type { Env } from '../env';

function configuredProviderOrigin(source: string, allowedOrigin?: string): string {
  const sourceUrl = new URL(source);
  if (!allowedOrigin) {
    if (sourceUrl.protocol !== 'https:') {
      throw new Error('GeoTV provider must be configured with HTTPS.');
    }
    return sourceUrl.origin;
  }

  const allowedUrl = new URL(allowedOrigin);
  const sameOrigin = sourceUrl.origin === allowedUrl.origin;
  const supportedPortMapping = sourceUrl.protocol === 'http:'
    && allowedUrl.protocol === 'http:'
    && sourceUrl.hostname === allowedUrl.hostname
    && sourceUrl.port === '8880'
    && allowedUrl.port === '';
  if (!sameOrigin && !supportedPortMapping) {
    throw new Error('GeoTV provider origin does not match the configured origin.');
  }
  return allowedUrl.origin;
}

export function withGeoTvProvider(env: Env): Env {
  if (env.GEOTV_HOST && env.GEOTV_USER && env.GEOTV_PASS) {
    const providerOrigin = configuredProviderOrigin(env.GEOTV_HOST, env.GEOTV_ALLOWED_ORIGIN);
    if (new URL(providerOrigin).protocol !== 'https:' && env.ALLOW_INSECURE_GEOTV !== 'true') {
      throw new Error('GeoTV provider must be configured with HTTPS.');
    }
    return { ...env, GEOTV_HOST: providerOrigin };
  }
  if (!env.M3U_PLAYLIST_URL) throw new Error('GeoTV provider is not configured');

  const playlistUrl = new URL(env.M3U_PLAYLIST_URL);
  const providerOrigin = configuredProviderOrigin(playlistUrl.origin, env.GEOTV_ALLOWED_ORIGIN);
  if (new URL(providerOrigin).protocol !== 'https:' && env.ALLOW_INSECURE_GEOTV !== 'true') {
    throw new Error('GeoTV provider must be configured with HTTPS.');
  }

  const user = playlistUrl.searchParams.get('username');
  const pass = playlistUrl.searchParams.get('password');
  if (!user || !pass) throw new Error('GeoTV provider is not configured');

  return {
    ...env,
    GEOTV_HOST: providerOrigin,
    GEOTV_USER: user,
    GEOTV_PASS: pass,
  };
}
