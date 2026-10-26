export interface Env {
  STAR_IPTV_API_KEY: string;
  STAR_IPTV_API_URL: string;
  APP_URL: string;
  ENVIRONMENT?: string;
  TURNSTILE_SECRET?: string;
  JWT_SECRET?: string;
  ENCRYPTION_KEY?: string;
  ADMIN_TOKEN?: string;
  ALLOWED_ORIGIN?: string;
  PLAYBACK_BASE_URL: string;
  GEOTV_HOST?: string;
  GEOTV_ALLOWED_ORIGIN?: string;
  ALLOW_INSECURE_GEOTV?: string;
  GEOTV_USER?: string;
  GEOTV_PASS?: string;
  M3U_PLAYLIST_URL?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  DB?: any;
  CATALOG?: {
    fetch(request: Request): Promise<Response>;
  };
  CATALOG_DB?: {
    prepare(query: string): {
      all<T>(): Promise<{ results: T[] }>;
      first<T>(): Promise<T | null>;
      bind(...values: (string | number | null)[]): {
        run(): Promise<unknown>;
        all<T>(): Promise<{ results: T[] }>;
        first<T>(): Promise<T | null>;
      };
    };
    batch(statements: { run(): Promise<unknown> }[]): Promise<unknown[]>;
  };
  BUCKET?: {
    get(key: string): Promise<{ json<T>(): Promise<T> } | null>;
    put(
      key: string,
      value: string,
      options?: { httpMetadata?: { contentType?: string } }
    ): Promise<unknown>;
  };
  CACHE?: any;
  ACTIVATIONS?: any;
}
