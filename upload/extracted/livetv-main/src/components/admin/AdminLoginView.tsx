import React, { useState } from 'react';
import { Shield, ArrowLeft, Loader2 } from 'lucide-react';
import { PlayBeatLogo } from '../common/PlayBeatLogo';

interface AdminLoginViewProps {
  onBackToStorefront: () => void;
  onAuthenticated: (token: string) => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  onBackToStorefront,
  onAuthenticated
}) => {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsVerifying(true);
    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Admin sign-in failed.');
      }
      onAuthenticated(token);
      setToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin sign-in failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-950/40 via-slate-950/80 to-[#050811] pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <button
          onClick={onBackToStorefront}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-cyan-300 transition-colors px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Open Storefront</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
          <Shield className="w-4 h-4" />
          <span>PORTAL: /admin</span>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Logo & Header */}
          <div className="text-center space-y-3 flex flex-col items-center">
            <PlayBeatLogo size="lg" />
            <p className="text-xs text-slate-400">
              Sign in with the admin token configured as a secret in Cloudflare Worker settings.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-2 text-xs text-slate-300">
              <span>Admin token</span>
              <input
                type="password"
                autoComplete="current-password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                required
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-white outline-none focus:border-cyan-500"
                placeholder="Enter the ADMIN_TOKEN Worker secret"
              />
            </label>
            {error && (
              <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-200">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={isVerifying || !token}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isVerifying && <Loader2 className="h-4 w-4 animate-spin" />}
              {isVerifying ? 'Verifying…' : 'Sign in securely'}
            </button>
          </form>

          {/* Storefront return */}
          <div className="pt-2 text-center">
            <button
              onClick={onBackToStorefront}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Return to Public Storefront
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-6 py-4 text-center text-xs text-slate-500 font-mono">
        PlayBeat Entertainment Network · Enterprise IPTV Core · Secure Gateway
      </div>
    </div>
  );
};
