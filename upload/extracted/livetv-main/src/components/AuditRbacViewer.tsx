import React, { useState } from 'react';
import { AuditLog, Role, Permission } from '../types/iptv';
import { MATRIX, can } from '../worker/auth/rbac';
import { 
  ShieldCheck, 
  Lock, 
  Key, 
  UserCheck, 
  Filter, 
  RefreshCw, 
  Check, 
  AlertCircle,
  FileText
} from 'lucide-react';

interface AuditRbacViewerProps {
  currentRole: Role;
  onRoleChange: (role: Role) => void;
  auditLogs: AuditLog[];
  onRefreshAudit: () => void;
}

export const AuditRbacViewer: React.FC<AuditRbacViewerProps> = ({
  currentRole,
  onRoleChange,
  auditLogs,
  onRefreshAudit
}) => {
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [searchAction, setSearchAction] = useState<string>('');

  const allRoles: Role[] = [
    'SUPER_ADMIN',
    'ADMIN',
    'MASTER_RESELLER',
    'RESELLER',
    'SUB_RESELLER',
    'SUPPORT',
    'ACCOUNTANT'
  ];

  const permissionsList: Permission[] = [
    'line:create',
    'line:renew',
    'credits:read:own',
    'credits:read:all',
    'credits:adjust',
    'orders:reconcile',
    'provider:read',
    'audit:read',
    'users:manage'
  ];

  const filteredLogs = auditLogs.filter((log) => {
    if (roleFilter !== 'ALL' && log.actorRole !== roleFilter) return false;
    if (searchAction.trim()) {
      const q = searchAction.toLowerCase();
      return (
        log.action.toLowerCase().includes(q) ||
        log.targetType.toLowerCase().includes(q) ||
        log.targetId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner: Role Selector & Cryptography Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Active Role Switcher */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-400" />
                <span>Role-Based Access Control (RBAC) Switcher</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulate different operator roles and verify security permission enforcement
              </p>
            </div>
            <span className="font-mono text-xs px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
              Active: {currentRole}
            </span>
          </div>

          {/* Role pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {allRoles.map((r) => {
              const isSelected = currentRole === r;
              return (
                <button
                  key={r}
                  onClick={() => onRoleChange(r)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>

          {/* Active Permissions Checklist */}
          <div className="pt-3 border-t border-slate-800/80">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Permissions Granted to {currentRole}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {permissionsList.map((perm) => {
                const isGranted = can({ role: currentRole }, perm);
                return (
                  <div
                    key={perm}
                    className={`flex items-center gap-1.5 p-2 rounded text-xs ${
                      isGranted
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {isGranted ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 text-slate-400 text-center shrink-0">✕</span>
                    )}
                    <span className="font-mono text-[11px] truncate">{perm}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Security & Crypto Overview */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-3">
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Cryptographic Hardening</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-md">
              <div className="font-semibold text-slate-200 mb-0.5">
                AES-256-GCM Field Encryption
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Stored IPTV passwords are encrypted at rest with a 32-byte secret key and AAD binding to the customer row ID.
              </p>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-md">
              <div className="font-semibold text-slate-200 mb-0.5">
                PBKDF2-SHA256 Password Hashing
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                100,000 iterations with 16-byte cryptographically secure salts. Includes dummy hash CPU burning to prevent timing attacks.
              </p>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-md">
              <div className="font-semibold text-slate-200 mb-0.5">
                Anti-Tamper Audit Logging
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Database triggers prevent any UPDATE or DELETE operations on audit_logs and credit_transactions.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Immutable Audit Logs</span>
            </h3>
            <p className="text-xs text-slate-400">
              Tamper-evident system activity trail
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Filter by action..."
              value={searchAction}
              onChange={(e) => setSearchAction(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={onRefreshAudit}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
              title="Refresh audit logs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4">Timestamp (UTC)</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Target</th>
                <th className="py-2.5 px-4">IP Address</th>
                <th className="py-2.5 px-4">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    No audit records match the current filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-400">
                      {log.timestamp.replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-white">
                      {log.actorId}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-mono text-[11px] text-indigo-300">
                        {log.actorRole}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-200">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">
                      {log.targetType}: {log.targetId}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">
                      {log.ip}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 truncate max-w-xs font-mono text-[11px]">
                      {log.metadata ? JSON.stringify(log.metadata) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
