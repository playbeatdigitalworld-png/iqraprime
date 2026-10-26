import React, { useState, useMemo } from 'react';
import { CustomerLine, LineType, ServerConfig } from '../types/iptv';
import { 
  Search, 
  Plus, 
  Copy, 
  Check, 
  ExternalLink, 
  MoreVertical, 
  Download, 
  Calendar, 
  Tv, 
  Smartphone, 
  Radio,
  Filter,
  AlertTriangle
} from 'lucide-react';

interface LineManagerProps {
  lines: CustomerLine[];
  servers: ServerConfig[];
  onOpenCreateModal: (type?: LineType) => void;
  onSelectLine: (line: CustomerLine) => void;
  onOpenRenewModal: (line: CustomerLine) => void;
  onOpenEditModal: (line: CustomerLine) => void;
  onOpenDeleteModal: (line: CustomerLine) => void;
  onToggleSuspend: (line: CustomerLine) => void;
  onBulkSuspend?: (ids: string[]) => void;
  onBulkExtend?: (ids: string[]) => void;
  onBulkDelete?: (ids: string[]) => void;
}

export const LineManager: React.FC<LineManagerProps> = ({
  lines,
  servers,
  onOpenCreateModal,
  onSelectLine,
  onOpenRenewModal,
  onOpenEditModal,
  onOpenDeleteModal,
  onToggleSuspend,
  onBulkSuspend,
  onBulkExtend,
  onBulkDelete
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [protocolFilter, setProtocolFilter] = useState<'ALL' | LineType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleCopy = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const filteredLines = useMemo(() => {
    return lines.filter((line) => {
      if (protocolFilter !== 'ALL' && line.lineType !== protocolFilter) return false;
      if (statusFilter !== 'ALL' && line.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = line.name.toLowerCase().includes(q);
        const matchesUser = line.providerUsername.toLowerCase().includes(q);
        const matchesNotice = line.notice.toLowerCase().includes(q);
        return matchesName || matchesUser || matchesNotice;
      }
      return true;
    });
  }, [lines, protocolFilter, statusFilter, searchQuery]);

  const isAllSelected = filteredLines.length > 0 && filteredLines.every(l => selectedIds.includes(l.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLines.map(l => l.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleExportCsv = () => {
    // ... existing implementation
    const headers = ['ID', 'Name', 'Protocol', 'Username', 'Connections', 'Status', 'Expiry Date', 'Notice'];
    const rows = filteredLines.map(l => [
      l.id,
      `"${l.name.replace(/"/g, '""')}"`,
      l.lineType,
      l.providerUsername,
      l.connections,
      l.status,
      l.expiryDate,
      `"${(l.notice || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `star-panel-lines-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Top Controls: Search + Filter Tabs + Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search lines by subscriber, username, notice, MAC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-md pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-md border border-slate-700">
               <span className="text-xs text-indigo-300 font-semibold">{selectedIds.length} selected</span>
               {onBulkSuspend && <button onClick={() => onBulkSuspend(selectedIds)} className="px-2 py-1 bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 rounded text-[10px] font-bold">Suspend</button>}
               {onBulkExtend && <button onClick={() => onBulkExtend(selectedIds)} className="px-2 py-1 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-300 rounded text-[10px] font-bold">Extend</button>}
               {onBulkDelete && <button onClick={() => onBulkDelete(selectedIds)} className="px-2 py-1 bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 rounded text-[10px] font-bold">Delete</button>}
            </div>
          )}
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-md text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => onOpenCreateModal()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Create Line</span>
          </button>
        </div>
      </div>

      {/* Segmented Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-900">
        {/* Protocol tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-800/80 rounded-md">
          {(['ALL', 'XTREAM', 'ACTIVECODE', 'MAC'] as const).map((proto) => (
            <button
              key={proto}
              onClick={() => setProtocolFilter(proto)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                protocolFilter === proto
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {proto === 'ALL' ? 'All Protocols' : proto}
            </button>
          ))}
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-800/80 rounded-md">
          {(['ALL', 'ACTIVE', 'TRIAL', 'EXPIRED', 'SUSPENDED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st === 'ALL' ? 'All Statuses' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-10">
                  <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} className="accent-indigo-500"/>
                </th>
                <th className="py-3 px-4">Subscriber</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Username / ID</th>
                <th className="py-3 px-4 text-center">Screens</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    No IPTV lines match your current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLines.map((line) => {
                  const isExp = line.status === 'EXPIRED';
                  const isTrial = line.status === 'TRIAL';
                  const isSuspended = line.status === 'SUSPENDED' || line.suspendedLocally;
                  const isSelected = selectedIds.includes(line.id);

                  return (
                    <tr
                      key={line.id}
                      onClick={() => onSelectLine(line)}
                      className={`${isSelected ? 'bg-indigo-900/20' : ''} hover:bg-slate-800/40 transition-colors cursor-pointer group`}
                    >
                      <td className="py-3 px-4">
                        <input type="checkbox" checked={isSelected} onChange={(e) => { e.stopPropagation(); toggleSelect(line.id); }} className="accent-indigo-500"/>
                      </td>
                      {/* Subscriber */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                          {line.name}
                        </div>
                        {line.notice && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                            {line.notice}
                          </div>
                        )}
                      </td>

                      {/* Type / Protocol */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] text-slate-300">
                          {line.lineType}
                        </span>
                      </td>

                      {/* Username / Identifier */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-slate-200">
                            {line.providerUsername}
                          </span>
                          <button
                            onClick={(e) => handleCopy(line.providerUsername, line.id, e)}
                            className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                            title="Copy username"
                          >
                            {copiedId === line.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Screens / Conx */}
                      <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-300">
                        {line.connections}
                      </td>

                      {/* Expiry Date */}
                      <td className="py-3 px-4 font-mono tabular-nums">
                        <span
                          className={
                            isExp
                              ? 'text-rose-400'
                              : isTrial
                              ? 'text-amber-400'
                              : 'text-slate-300'
                          }
                        >
                          {line.expiryDate}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSuspended
                                ? 'bg-amber-400'
                                : isExp
                                ? 'bg-rose-400'
                                : isTrial
                                ? 'bg-sky-400'
                                : 'bg-emerald-400'
                            }`}
                          />
                          <span className="text-[11px] font-medium text-slate-300">
                            {isSuspended
                              ? 'Suspended'
                              : isExp
                              ? 'Expired'
                              : isTrial
                              ? 'Trial (24h)'
                              : 'Active'}
                          </span>
                        </div>
                      </td>

                      {/* Action buttons */}
                      <td
                        className="py-3 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onSelectLine(line)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium transition-colors"
                            title="Playlist links & credentials"
                          >
                            Links
                          </button>

                          <button
                            onClick={() => onOpenRenewModal(line)}
                            className="px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded text-[11px] font-medium transition-colors"
                            title="Renew subscription"
                          >
                            Renew
                          </button>

                          <button
                            onClick={() => onOpenEditModal(line)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition-colors"
                            title="Edit username/notice"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => onOpenDeleteModal(line)}
                            className="px-1.5 py-1 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Delete line"
                          >
                            &times;
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer summary */}
        <div className="py-2.5 px-4 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <span className="font-mono text-white">{filteredLines.length}</span> of{' '}
            <span className="font-mono text-white">{lines.length}</span> subscriptions
          </div>
          <div className="text-[11px]">
            Double click or click &quot;Links&quot; to inspect credentials &amp; M3U files
          </div>
        </div>
      </div>
    </div>
  );
};
