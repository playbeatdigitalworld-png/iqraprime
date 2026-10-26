import React, { useState } from 'react';
import { ServerConfig } from '../types/iptv';
import { X, Server, ShieldAlert, Plus, Trash2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  servers: ServerConfig[];
  onSaveServers: (servers: ServerConfig[]) => void;
  isSimulation: boolean;
  onToggleSimulation: (enabled: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  servers,
  onSaveServers,
  isSimulation,
  onToggleSimulation
}) => {
  const [localServers, setLocalServers] = useState<ServerConfig[]>(servers);
  const [newServerName, setNewServerName] = useState('');
  const [newServerHost, setNewServerHost] = useState('');

  if (!isOpen) return null;

  const handleAddServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerName.trim() || !newServerHost.trim()) return;

    const newSrv: ServerConfig = {
      id: `srv_${Date.now()}`,
      name: newServerName.trim(),
      hostUrl: newServerHost.trim(),
      isDefault: localServers.length === 0
    };
    const updated = [...localServers, newSrv];
    setLocalServers(updated);
    onSaveServers(updated);
    setNewServerName('');
    setNewServerHost('');
  };

  const handleRemoveServer = (id: string) => {
    if (localServers.length <= 1) return;
    const updated = localServers.filter(s => s.id !== id);
    setLocalServers(updated);
    onSaveServers(updated);
  };

  const handleSetDefault = (id: string) => {
    const updated = localServers.map(s => ({
      ...s,
      isDefault: s.id === id
    }));
    setLocalServers(updated);
    onSaveServers(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div>
            <h2 className="text-sm font-semibold text-white">Streaming Server Settings</h2>
            <p className="text-xs text-slate-400">Manage local streaming server entries and simulation mode</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
          {/* Provider Environment Mode */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-white text-xs block">Execution Mode</span>
                <span className="text-[11px] text-slate-400">
                  Toggle between Sandbox Simulation and Live upstream provider calls
                </span>
              </div>
              <button
                type="button"
                onClick={() => onToggleSimulation(!isSimulation)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isSimulation ? 'bg-amber-500' : 'bg-emerald-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isSimulation ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="text-[11px] text-slate-400">
              {isSimulation ? (
                <span className="text-amber-400">
                  Sandbox Active: Requests return simulated responses without consuming real upstream provider credits or needing an active provider account.
                </span>
              ) : (
                <span className="text-emerald-400">
                  Provider calls are unavailable until a server-side integration is configured.
                </span>
              )}
            </div>
          </div>

          {/* Streaming Server Host Nodes */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="font-semibold text-slate-300">
              Streaming Server Nodes (Used for M3U &amp; Web Player URLs)
            </div>

            <div className="space-y-2">
              {localServers.map((s) => (
                <div
                  key={s.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-md flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 font-medium text-white">
                      <span>{s.name}</span>
                      {s.isDefault && (
                        <span className="text-[10px] bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded font-mono">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                      {s.hostUrl}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!s.isDefault && (
                      <button
                        onClick={() => handleSetDefault(s.id)}
                        className="text-[11px] text-indigo-400 hover:underline"
                      >
                        Set default
                      </button>
                    )}
                    {localServers.length > 1 && (
                      <button
                        onClick={() => handleRemoveServer(s.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                        title="Remove server"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Server Form */}
            <form onSubmit={handleAddServer} className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Node Name (e.g. EU Edge 2)"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white placeholder-slate-500"
              />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="http://host:port"
                  value={newServerHost}
                  onChange={(e) => setNewServerHost(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white placeholder-slate-500"
                />
                <button
                  type="submit"
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded shrink-0"
                  title="Add server"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
