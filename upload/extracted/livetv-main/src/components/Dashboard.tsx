import React from 'react';
import { CustomerLine, ProviderCreditLog, ProviderInfo } from '../types/iptv';
import { 
  Users, 
  Clock, 
  Coins, 
  Server, 
  ShieldCheck, 
  RefreshCw, 
  ArrowUpRight, 
  AlertCircle,
  Tv,
  Smartphone,
  Radio,
  ExternalLink
} from 'lucide-react';

interface DashboardProps {
  lines: CustomerLine[];
  balanceCenti: number;
  providerInfo: ProviderInfo | null;
  creditLogs: ProviderCreditLog[];
  isLoadingProvider: boolean;
  onRefreshProvider: () => void;
  onOpenCreateModal: (type?: 'XTREAM' | 'ACTIVECODE' | 'MAC', isTrial?: boolean) => void;
  onSelectLine: (line: CustomerLine) => void;
  onViewAllLines: () => void;
  onViewLedger: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  lines,
  balanceCenti,
  providerInfo,
  creditLogs,
  isLoadingProvider,
  onRefreshProvider,
  onOpenCreateModal,
  onSelectLine,
  onViewAllLines,
  onViewLedger
}) => {
  const activeLines = lines.filter(l => l.status === 'ACTIVE').length;
  const trialLines = lines.filter(l => l.status === 'TRIAL').length;
  const expiredLines = lines.filter(l => l.status === 'EXPIRED').length;

  const creditsFormatted = (balanceCenti / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  // Calculate upcoming expirations (next 7 days)
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiringSoon = lines.filter(line => {
    if (line.status === 'EXPIRED') return false;
    const exp = new Date(line.expiryDate);
    return exp >= now && exp <= nextWeek;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Credit Balance */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 transition-colors hover:border-slate-700">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Reseller Balance</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            {creditsFormatted} <span className="text-xs font-normal text-slate-400">Credits</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Provider sync</span>
            <span className="text-emerald-400 font-mono">
              {providerInfo?.user_credit || '1,088.73'} upstream
            </span>
          </div>
        </div>

        {/* Metric 2: Active Lines */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 transition-colors hover:border-slate-700">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Active Subscriptions</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            {activeLines} <span className="text-xs font-normal text-slate-400">Total lines</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <span>{trialLines} trials</span>
            <span aria-hidden="true">·</span>
            <span>{expiredLines} expired</span>
          </div>
        </div>

        {/* Metric 3: Trial Quota */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 transition-colors hover:border-slate-700">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>24h Trial Quota</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            {providerInfo?.used_trial ?? '7'} / {providerInfo?.allow_trial ?? '50'}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            <span className="text-amber-400 font-mono">
              {parseInt(providerInfo?.allow_trial || '50', 10) - parseInt(providerInfo?.used_trial || '7', 10)}
            </span>{' '}
            trials remaining today
          </div>
        </div>

        {/* Metric 4: Upstream API Health */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 transition-colors hover:border-slate-700">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Provider Gateway</span>
            <button
              onClick={onRefreshProvider}
              disabled={isLoadingProvider}
              className="text-slate-400 hover:text-white transition-colors"
              title="Refresh provider info"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingProvider ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex items-center gap-2 text-base font-semibold text-white">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span>API v3 Operational</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 font-mono truncate">
            User: {providerInfo?.api_username || 'star_reseller_master'}
          </div>
        </div>
      </div>

      {/* Quick Line Creation Action Row */}
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-lg p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Quick Generation Actions
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => onOpenCreateModal('XTREAM', true)}
            className="flex items-center gap-3 p-3 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-md text-left transition-all group"
          >
            <div className="w-9 h-9 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors">
                24h Free Trial
              </div>
              <div className="text-[11px] text-slate-400">0 credits · Xtream Codes</div>
            </div>
          </button>

          <button
            onClick={() => onOpenCreateModal('XTREAM', false)}
            className="flex items-center gap-3 p-3 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-md text-left transition-all group"
          >
            <div className="w-9 h-9 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Tv className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors">
                Xtream Line
              </div>
              <div className="text-[11px] text-slate-400">Multi-screen · 1-12 Mo</div>
            </div>
          </button>

          <button
            onClick={() => onOpenCreateModal('MAC', false)}
            className="flex items-center gap-3 p-3 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-md text-left transition-all group"
          >
            <div className="w-9 h-9 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                MAG / STB Portal
              </div>
              <div className="text-[11px] text-slate-400">MAC hardware binding</div>
            </div>
          </button>

          <button
            onClick={() => onOpenCreateModal('ACTIVECODE', false)}
            className="flex items-center gap-3 p-3 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-md text-left transition-all group"
          >
            <div className="w-9 h-9 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors">
                ActiveCode User
              </div>
              <div className="text-[11px] text-slate-400">Numeric code for APK</div>
            </div>
          </button>
        </div>
      </div>

      {/* Main 2-column layout: Expiring Lines + Provider Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Expiring Soon or Recent Lines */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Attention Required: Expirations</h2>
              <p className="text-xs text-slate-400">Subscriptions expiring within 7 days</p>
            </div>
            <button
              onClick={onViewAllLines}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
            >
              <span>View all lines</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {expiringSoon.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              <ShieldCheck className="w-6 h-6 text-emerald-400 mx-auto mb-2 opacity-80" />
              <span>All active client subscriptions are nominal. None expiring in the next 7 days.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {expiringSoon.map((line) => (
                <div
                  key={line.id}
                  onClick={() => onSelectLine(line)}
                  className="cursor-pointer p-3 rounded-md bg-slate-950/60 border border-slate-800/70 hover:border-slate-700 flex items-center justify-between transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{line.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">({line.lineType})</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      User: {line.providerUsername}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono text-amber-400 tabular-nums">
                      {line.expiryDate}
                    </span>
                    <div className="text-[10px] text-slate-400">
                      {line.connections} Screen(s)
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Upstream Provider Activity */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Upstream Credit Activity</h2>
              <p className="text-xs text-slate-400">Synchronized via provider credit_logs API</p>
            </div>
            <button
              onClick={onViewLedger}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
            >
              <span>Full ledger</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {creditLogs.slice(0, 5).map((log) => {
              const isCredit = log.credits_charge.startsWith('+');
              return (
                <div
                  key={log.log_id}
                  className="p-3 rounded-md bg-slate-950/60 border border-slate-800/70 flex items-center justify-between"
                >
                  <div className="min-w-0 pr-3">
                    <div className="text-xs font-medium text-slate-200 truncate">
                      {log.info}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Log #{log.log_id} · {log.date}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-mono tabular-nums font-semibold ${
                        isCredit ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {log.credits_charge} cr
                    </span>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Left: {log.credits_left}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
