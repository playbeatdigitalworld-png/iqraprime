import React from 'react';
import { Tv, Plus, Key, ShieldCheck, Activity, ShieldAlert, UserCheck } from 'lucide-react';
import { Role } from '../types/iptv';
import { can } from '../worker/auth/rbac';
import { PlayBeatLogo } from './common/PlayBeatLogo';

interface TopNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  balanceCenti: number;
  isSimulation: boolean;
  currentRole: Role;
  onOpenCreateModal: () => void;
  onOpenSettings: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onTabChange,
  balanceCenti,
  isSimulation,
  currentRole,
  onOpenCreateModal,
  onOpenSettings
}) => {
  const creditsFormatted = (balanceCenti / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const canCreateLine = can({ role: currentRole }, 'line:create');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'operations', label: 'PlayBeat Ops Robot' },
    { id: 'cloudflare', label: 'Cloudflare & GeoTV Hub' },
    { id: 'lines', label: 'Line Manager' },
    { id: 'playlists', label: 'Playlist Links' },
    { id: 'ledger', label: 'Credit Ledger' },
    { id: 'api-console', label: 'API Console' },
    { id: 'webhook', label: 'ActiveCode Webhook' },
    { id: 'rbac', label: 'RBAC & Audit' }
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => onTabChange('dashboard')}
            className="hover:opacity-90 transition-opacity text-left"
            title="PlayBeat Admin Dashboard"
          >
            <PlayBeatLogo size="sm" />
          </button>
        </div>

        {/* Zone 2: Clean text navigation links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                  isActive
                    ? 'text-white bg-slate-800/90 shadow-sm border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Reseller Balance & Primary Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Active Role Indicator */}
          <button
            onClick={() => onTabChange('rbac')}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-indigo-300 font-mono transition-colors"
            title="Current RBAC role (click to switch)"
          >
            <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] font-semibold">{currentRole}</span>
          </button>

          <button
            onClick={onOpenSettings}
            title={isSimulation ? 'Sandbox Simulation Active' : 'Live Provider Connected'}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 transition-colors"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isSimulation ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span className="font-mono text-[11px] text-slate-400">
              {isSimulation ? 'SANDBOX' : 'V3 ONLINE'}
            </span>
          </button>

          <div
            onClick={() => onTabChange('ledger')}
            className="cursor-pointer px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-md flex items-center gap-2 text-xs transition-colors"
            title="Click to view full transaction ledger"
          >
            <span className="text-slate-400 font-medium">Credits:</span>
            <span className="font-mono tabular-nums font-semibold text-emerald-400">
              {creditsFormatted}
            </span>
          </div>

          <button
            onClick={onOpenCreateModal}
            disabled={!canCreateLine}
            title={canCreateLine ? 'Create new line' : `Role ${currentRole} cannot create lines`}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-all whitespace-nowrap ${
              canCreateLine
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-[0.98]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Line</span>
          </button>
        </div>
      </div>

      {/* Mobile nav row */}
      <div className="flex md:hidden items-center gap-1 overflow-x-auto pt-2.5 pb-0.5 border-t border-slate-900 mt-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
              activeTab === item.id
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
};
