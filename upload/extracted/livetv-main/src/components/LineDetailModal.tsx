import React, { useState } from 'react';
import { CustomerLine, ServerConfig, PlanId, PLANS } from '../types/iptv';
import { generatePlaylistLinks } from '../services/playlist';
import { 
  X, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  Download, 
  Share2, 
  Calendar, 
  Tv, 
  RotateCw, 
  Trash2, 
  AlertTriangle,
  ExternalLink,
  MessageSquare
} from 'lucide-react';

interface LineDetailModalProps {
  line: CustomerLine | null;
  server: ServerConfig;
  isOpen: boolean;
  onClose: () => void;
  onRenew: (line: CustomerLine, planId: PlanId) => Promise<boolean>;
  onEdit: (line: CustomerLine, newValues: { newUser?: string; newPass?: string; notice?: string }) => Promise<boolean>;
  onDelete: (line: CustomerLine, force: boolean) => Promise<boolean>;
  onToggleSuspend: (line: CustomerLine) => void;
}

export const LineDetailModal: React.FC<LineDetailModalProps> = ({
  line,
  server,
  isOpen,
  onClose,
  onRenew,
  onEdit,
  onDelete,
  onToggleSuspend
}) => {
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'RENEW' | 'EDIT' | 'DELETE'>('DETAILS');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Renew tab state
  const [renewPlan, setRenewPlan] = useState<PlanId>(1);
  const [isRenewing, setIsRenewing] = useState(false);

  // Edit tab state
  const [editUser, setEditUser] = useState('');
  const [editPass, setEditPass] = useState('');
  const [editNotice, setEditNotice] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Delete tab state
  const [forceDelete, setForceDelete] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !line) return null;

  const links = generatePlaylistLinks(line, server);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleDownloadM3u = () => {
    const link = document.createElement('a');
    link.href = links.m3uPlusTs;
    link.download = `${line.providerUsername}-playlist.m3u`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExecuteRenew = async () => {
    setIsRenewing(true);
    const success = await onRenew(line, renewPlan);
    setIsRenewing(false);
    if (success) onClose();
  };

  const handleExecuteEdit = async () => {
    setIsEditing(true);
    const success = await onEdit(line, {
      newUser: editUser.trim() || undefined,
      newPass: editPass.trim() || undefined,
      notice: editNotice.trim()
    });
    setIsEditing(false);
    if (success) onClose();
  };

  const handleExecuteDelete = async () => {
    setIsDeleting(true);
    const success = await onDelete(line, forceDelete);
    setIsDeleting(false);
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">{line.name}</h2>
              <span className="font-mono text-[11px] text-slate-400">
                · {line.lineType} · {line.connections} Screen(s)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Valid until: <span className="font-mono text-emerald-400">{line.expiryDate}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center px-6 pt-3 border-b border-slate-800/80 bg-slate-950/40 gap-2">
          <button
            onClick={() => setActiveTab('DETAILS')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'DETAILS'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Credentials &amp; Playlists
          </button>

          <button
            onClick={() => setActiveTab('RENEW')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'RENEW'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Renew / Extend
          </button>

          <button
            onClick={() => {
              setActiveTab('EDIT');
              setEditUser(line.providerUsername);
              setEditPass(line.providerPassword || '');
              setEditNotice(line.notice || '');
            }}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'EDIT'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Edit Line
          </button>

          <button
            onClick={() => setActiveTab('DELETE')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'DELETE'
                ? 'border-rose-500 text-rose-300'
                : 'border-transparent text-slate-400 hover:text-rose-400'
            }`}
          >
            Delete
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {/* TAB 1: DETAILS & PLAYLISTS */}
          {activeTab === 'DETAILS' && (
            <div className="space-y-5">
              {/* Credentials Card */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <span>Subscriber Access Credentials</span>
                  <span>Server: {server.name}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Host */}
                  <div className="p-2.5 bg-slate-900 border border-slate-800/80 rounded-md">
                    <span className="text-[11px] text-slate-400 block mb-0.5">Server / Host URL</span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-white truncate mr-2">
                        {server.hostUrl}
                      </span>
                      <button
                        onClick={() => handleCopy(server.hostUrl, 'host')}
                        className="text-slate-400 hover:text-white"
                        title="Copy Host"
                      >
                        {copiedKey === 'host' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Username / MAC */}
                  <div className="p-2.5 bg-slate-900 border border-slate-800/80 rounded-md">
                    <span className="text-[11px] text-slate-400 block mb-0.5">
                      {line.lineType === 'MAC' ? 'Registered MAC Address' : 'Username / Code'}
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-white truncate mr-2">
                        {line.providerUsername}
                      </span>
                      <button
                        onClick={() => handleCopy(line.providerUsername, 'user')}
                        className="text-slate-400 hover:text-white"
                        title="Copy Username"
                      >
                        {copiedKey === 'user' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Password (if Xtream) */}
                  {line.lineType === 'XTREAM' && (
                    <div className="p-2.5 bg-slate-900 border border-slate-800/80 rounded-md sm:col-span-2">
                      <span className="text-[11px] text-slate-400 block mb-0.5">Password</span>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-white">
                          {showPassword ? line.providerPassword : '••••••••••••'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-slate-400 hover:text-white"
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleCopy(line.providerPassword || '', 'pass')}
                            className="text-slate-400 hover:text-white"
                          >
                            {copiedKey === 'pass' ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* M3U & EPG Links (for Xtream lines) */}
              {line.lineType === 'XTREAM' && (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-300">Playlist Stream Links</div>

                  {/* M3U Plus TS */}
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-md space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-300">M3U Plus (TS Streams - Recommended)</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleDownloadM3u}
                          className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download .m3u</span>
                        </button>
                        <button
                          onClick={() => handleCopy(links.m3uPlusTs, 'm3u_ts')}
                          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                        >
                          {copiedKey === 'm3u_ts' ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>Copy URL</span>
                        </button>
                      </div>
                    </div>
                    <div className="font-mono text-[11px] text-slate-400 truncate bg-slate-900 p-1.5 rounded">
                      {links.m3uPlusTs}
                    </div>
                  </div>

                  {/* EPG XMLTV */}
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-md space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-300">Electronic Program Guide (EPG XMLTV)</span>
                      <button
                        onClick={() => handleCopy(links.epgXmltv, 'epg')}
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                      >
                        {copiedKey === 'epg' ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>Copy EPG</span>
                      </button>
                    </div>
                    <div className="font-mono text-[11px] text-slate-400 truncate bg-slate-900 p-1.5 rounded">
                      {links.epgXmltv}
                    </div>
                  </div>
                </div>
              )}

              {/* Ready-to-Send WhatsApp Message */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp / Telegram Dispatch Message</span>
                  </span>
                  <button
                    onClick={() => handleCopy(links.whatsappMessage, 'wa_msg')}
                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold transition-colors"
                  >
                    {copiedKey === 'wa_msg' ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Message</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="font-mono text-[11px] text-slate-300 whitespace-pre-wrap bg-slate-900 p-3 rounded-md border border-slate-800/80 max-h-48 overflow-y-auto">
                  {links.whatsappMessage}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 2: RENEW / EXTEND */}
          {activeTab === 'RENEW' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-md">
                <div className="text-slate-300 font-medium">Extend Subscriber Expiration</div>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Extends this line directly with the IPTV provider. Debits reseller credits immediately.
                </p>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-2">Select Extension Plan</label>
                <div className="grid grid-cols-2 gap-2">
                  {([1, 2, 3, 4] as PlanId[]).map((pid) => {
                    const p = PLANS[pid];
                    const cost = p.baseCredits * line.connections;
                    return (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => setRenewPlan(pid)}
                        className={`p-3 rounded-md border text-left transition-colors ${
                          renewPlan === pid
                            ? 'bg-indigo-600/20 border-indigo-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="font-semibold text-white">{p.name}</div>
                        <div className="text-[11px] font-mono text-emerald-400 mt-1">
                          {cost} Credits ({p.baseCredits} x {line.connections} conx)
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-indigo-950/30 border border-indigo-800/40 rounded-md text-indigo-300">
                <span>New estimated expiry: </span>
                <span className="font-mono font-bold text-white">
                  {new Date(
                    new Date(line.expiryDate).setMonth(
                      new Date(line.expiryDate).getMonth() +
                        (renewPlan === 1 ? 1 : renewPlan === 2 ? 3 : renewPlan === 3 ? 6 : 12)
                    )
                  )
                    .toISOString()
                    .split('T')[0]}
                </span>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteRenew}
                  disabled={isRenewing}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-md flex items-center gap-1.5"
                >
                  {isRenewing ? 'Extending...' : 'Confirm Extension'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: EDIT LINE */}
          {activeTab === 'EDIT' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-md">
                <div className="text-slate-300 font-medium">Modify Line Credentials &amp; Notice</div>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Sends edit command to provider endpoint ({line.lineType === 'MAC' ? 'editmac' : 'edit'}).
                </p>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  {line.lineType === 'MAC' ? 'New MAC Address' : 'New Username'}
                </label>
                <input
                  type="text"
                  value={editUser}
                  onChange={(e) => setEditUser(e.target.value)}
                  className="w-full font-mono bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {line.lineType === 'XTREAM' && (
                <div>
                  <label className="block font-medium text-slate-300 mb-1">New Password</label>
                  <input
                    type="text"
                    value={editPass}
                    onChange={(e) => setEditPass(e.target.value)}
                    className="w-full font-mono bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-300 mb-1">Notice / Internal Note</label>
                <input
                  type="text"
                  value={editNotice}
                  onChange={(e) => setEditNotice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteEdit}
                  disabled={isEditing}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-md flex items-center gap-1.5"
                >
                  {isEditing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: DELETE */}
          {activeTab === 'DELETE' && (
            <div className="space-y-4">
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-rose-300 font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Permanent Line Deletion</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Are you sure you want to delete line <strong className="font-mono text-white">{line.providerUsername}</strong>? This action terminates streaming access.
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-md">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceDelete}
                    onChange={(e) => setForceDelete(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-rose-600 focus:ring-0"
                  />
                  <div>
                    <span className="font-semibold text-slate-200">Force Deletion &amp; Credit Refund (force=1)</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Per provider specification: forcing deletion automatically refunds rest days credits back to your reseller API credit balance.
                    </p>
                  </div>
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDelete}
                  disabled={isDeleting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-md flex items-center gap-1.5"
                >
                  {isDeleting ? 'Deleting...' : 'Confirm Deletion'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
