import React, { useState } from 'react';
import { ArrowLeft, Save, ShieldCheck, Zap } from 'lucide-react';

interface ProviderStatus {
  configured: boolean;
}

interface SyncResult {
  live: number;
  movies: number;
  series: number;
  healthChecked: number;
}

async function adminRequest<T>(
  path: string,
  password: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${password}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null &&
      'error' in payload && typeof payload.error === 'string'
      ? payload.error.replaceAll('_', ' ')
      : `Request failed with HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export function ProviderAdmin() {
  const [adminPassword, setAdminPassword] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [acceptInsecureHttp, setAcceptInsecureHttp] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const unlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const status = await adminRequest<ProviderStatus>('/api/admin/provider', adminPassword);
      setConfigured(status.configured);
      setMessage(status.configured
        ? 'Provider is configured. Credentials are never displayed after saving.'
        : 'Admin unlocked. Enter the provider details below.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to unlock provider settings.');
    } finally {
      setBusy(false);
    }
  };

  const saveProvider = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const baseUrlValue = baseUrl.trim();
      let providerUrl: URL;
      try {
        providerUrl = new URL(baseUrlValue);
      } catch {
        throw new Error('Enter a valid provider URL, including http:// or https://.');
      }
      if (!['http:', 'https:'].includes(providerUrl.protocol)) {
        throw new Error('Provider URL must begin with http:// or https://.');
      }
      if (providerUrl.protocol === 'http:' && !acceptInsecureHttp) {
        throw new Error('Acknowledge the HTTP connection warning before saving.');
      }
      await adminRequest('/api/admin/provider', adminPassword, {
        method: 'POST',
        body: JSON.stringify({ baseUrl: providerUrl.origin, username, password, acceptInsecureHttp }),
      });
      setConfigured(true);
      setPassword('');
      setMessage('Provider credentials saved encrypted. Starting catalog sync…');
      const result = await adminRequest<SyncResult>('/api/admin/sync', adminPassword, { method: 'POST' });
      setMessage(`Sync complete: ${result.live.toLocaleString()} live channels, ${result.movies.toLocaleString()} movies, ${result.series.toLocaleString()} series; checked ${result.healthChecked.toLocaleString()} channels.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save provider settings.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl bg-[#07090f] px-4 py-8 text-slate-100 sm:px-6">
      <a href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Back to Playbeat IPTV
      </a>
      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold">Provider settings</h1>
            <p className="mt-1 text-sm text-slate-400">Configure and sync your provider catalog.</p>
          </div>
        </div>

        <p className="mt-5 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
          First, add two Worker secrets in Cloudflare Settings → Variables and Secrets: <code>ADMIN_PASSWORD</code> and <code>PROVIDER_ENCRYPTION_KEY</code>. Use unique values with at least 32 characters. Enter the admin password below. Provider credentials are encrypted in the catalog database and are never sent back to this page. Keep the encryption key safe; changing it later prevents decrypting saved credentials.
        </p>

        {configured === null ? (
          <form onSubmit={unlock} className="mt-8 space-y-4">
            <label className="block text-sm font-medium text-slate-200">
              Admin password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-amber-400"
              />
            </label>
            <button disabled={busy} className="rounded-lg bg-amber-400 px-4 py-2.5 font-bold text-slate-950 disabled:opacity-50">
              {busy ? 'Checking…' : 'Unlock settings'}
            </button>
          </form>
        ) : (
          <form onSubmit={saveProvider} className="mt-8 space-y-4">
            <label className="block text-sm font-medium text-slate-200">
              Provider host URL
              <input
                type="url"
                required
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://provider.example:8880"
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-amber-400"
              />
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Username
              <input
                required
                autoComplete="off"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-amber-400"
              />
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Password
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-amber-400"
              />
            </label>

            {baseUrl.trim().toLowerCase().startsWith('http://') && (
              <label className="flex items-start gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                <input
                  type="checkbox"
                  checked={acceptInsecureHttp}
                  onChange={(event) => setAcceptInsecureHttp(event.target.checked)}
                  className="mt-1 accent-amber-400"
                />
                <span>
                  This provider uses HTTP. Credentials and stream traffic between the Worker and provider will not be encrypted. I understand and want to continue.
                </span>
              </label>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                disabled={busy || !username.trim() || !password || (baseUrl.trim().toLowerCase().startsWith('http://') && !acceptInsecureHttp)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 font-bold text-slate-950 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {busy ? 'Saving and syncing…' : 'Save and sync'}
              </button>
              {configured && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setMessage('');
                    try {
                      const result = await adminRequest<SyncResult>('/api/admin/sync', adminPassword, { method: 'POST' });
                      setMessage(`Sync complete: ${result.live.toLocaleString()} live channels, ${result.movies.toLocaleString()} movies, ${result.series.toLocaleString()} series; checked ${result.healthChecked.toLocaleString()} channels.`);
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : 'Unable to sync provider catalog.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 font-semibold text-slate-200 disabled:opacity-50"
                >
                  <Zap className="h-4 w-4" />
                  Sync now
                </button>
              )}
            </div>
          </form>
        )}

        {message && <p role="status" className="mt-5 rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200">{message}</p>}
      </section>
    </main>
  );
}
