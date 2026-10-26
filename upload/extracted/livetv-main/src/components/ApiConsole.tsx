import React, { useState } from 'react';
import { ApiCallLog } from '../types/iptv';
import { executeProviderCall, generateCurlCommands } from '../services/api';
import { adminFetch } from '../services/adminAuth';
import { 
  Terminal, 
  Send, 
  Copy, 
  Check, 
  RefreshCw, 
  History, 
  Trash2, 
  Code,
  ShieldAlert
} from 'lucide-react';

interface ApiConsoleProps {
  apiLogs: ApiCallLog[];
  onLogAdded: (log: ApiCallLog) => void;
  onClearLogs: () => void;
  isSimulation: boolean;
}

export const ApiConsole: React.FC<ApiConsoleProps> = ({
  apiLogs,
  onLogAdded,
  onClearLogs,
  isSimulation
}) => {
  const [selectedOperation, setSelectedOperation] = useState<string>('infoapi');
  const [gatewayTarget, setGatewayTarget] = useState<'PROVIDER_DIRECT' | 'PLAYBEAT_WORKER'>('PLAYBEAT_WORKER');
  const [adminToken, setAdminToken] = useState<string>('');
  const [params, setParams] = useState<Record<string, string>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const operations = [
    { id: 'infoapi', label: 'infoapi — Account Status & Trial Quota' },
    { id: 'credit_logs', label: 'credit_logs — Credit History Records' },
    { id: 'add', label: 'add — Generate Xtream User (Trial or Paid)' },
    { id: 'edit', label: 'edit — Modify Xtream Username / Password' },
    { id: 'extend', label: 'extend — Extend Xtream Subscription' },
    { id: 'del', label: 'del — Delete Xtream Subscription' },
    { id: 'activecode', label: 'activecode — Generate ActiveCode Line' },
    { id: 'extendac', label: 'extendac — Extend ActiveCode' },
    { id: 'delac', label: 'delac — Delete ActiveCode' },
    { id: 'addmac', label: 'addmac — Register MAC Address Line' },
    { id: 'editmac', label: 'editmac — Edit MAC Address Line' },
    { id: 'extendmac', label: 'extendmac — Extend MAC Address' },
    { id: 'delmac', label: 'delmac — Delete MAC Address Line' }
  ];

  // Set default parameters when changing operation
  const handleSelectOperation = (op: string) => {
    setSelectedOperation(op);
    if (op === 'infoapi' || op === 'credit_logs') {
      setParams({});
    } else if (op === 'add') {
      setParams({
        user: 'demo_user_123',
        pass: 'SecretPass_456',
        conx: '1',
        bid: '[5,11]',
        plan: '11',
        addch: '1',
        addvods: '1',
        adults: '',
        notice: 'API Test Trial Line',
        ch: ''
      });
    } else if (op === 'edit') {
      setParams({
        user: 'demo_user_123',
        newuser: 'new_demo_user_123',
        pass: 'UpdatedPass_789',
        notice: 'Updated notice',
        ch: ''
      });
    } else if (op === 'extend') {
      setParams({
        user: 'demo_user_123',
        plan: '1'
      });
    } else if (op === 'del') {
      setParams({
        user: 'demo_user_123',
        force: '1'
      });
    } else if (op === 'activecode') {
      setParams({
        bid: '[5,11]',
        conx: '1',
        plan: '11',
        addch: '1',
        addvods: '1',
        adults: '',
        notice: 'ActiveCode Test',
        callback: 'aHR0cHM6Ly95b3Vyc2VydmVyZG9tYWluLnRsZC9BcGlMb2NhdGlvbi8',
        ch: ''
      });
    } else if (op === 'extendac') {
      setParams({
        user: '01234567891011',
        plan: '1'
      });
    } else if (op === 'delac') {
      setParams({
        user: '01234567891011',
        force: '1'
      });
    } else if (op === 'addmac') {
      setParams({
        address: '00:AA:BB:CC:DD:11',
        mac: '1',
        bid: '[5,11]',
        plan: '11',
        addch: '1',
        addvods: '1',
        adults: '',
        notice: 'MAC trial test',
        ch: ''
      });
    } else if (op === 'editmac') {
      setParams({
        user: '00:AA:BB:CC:DD:11',
        newuser: '00:AA:BB:CC:DD:22',
        notice: 'Changed MAC device',
        ch: ''
      });
    } else if (op === 'extendmac') {
      setParams({
        user: '00:AA:BB:CC:DD:11',
        plan: '1'
      });
    } else if (op === 'delmac') {
      setParams({
        user: '00:AA:BB:CC:DD:11',
        force: '1'
      });
    }
  };

  const actionName = selectedOperation === 'infoapi' ? 'info' : selectedOperation;

  const playbeatCurl = `curl -X POST "${typeof window !== 'undefined' ? window.location.origin : 'https://playbeat.tv'}/api/${actionName}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(params, null, 2)}'`;

  const curls = generateCurlCommands(
    selectedOperation,
    params
  );

  const activeCurl = gatewayTarget === 'PLAYBEAT_WORKER' ? playbeatCurl : curls.post;

  const handleExecute = async () => {
    setIsExecuting(true);
    setLastResponse(null);
    setLastDuration(null);

    const startTime = Date.now();

    if (gatewayTarget === 'PLAYBEAT_WORKER') {
      try {
        const res = await adminFetch(`/api/${actionName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {})
          },
          body: JSON.stringify({ ...params, simulateFallback: isSimulation })
        });
        const durationMs = Date.now() - startTime;
        const data = await res.json();
        setLastDuration(durationMs);
        setLastResponse(data);

        onLogAdded({
          id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          operation: actionName,
          method: 'POST',
          endpoint: `/api/${actionName}`,
          status: res.ok && data.status !== 'error' ? 'SUCCESS' : 'ERROR',
          durationMs,
          maskedPayload: { ...params, token: '••••••••' },
          response: data,
          source: isSimulation ? 'sandbox_simulation' : 'live_provider'
        });
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        setLastDuration(durationMs);
        setLastResponse({ error: err.message || 'Worker fetch failed' });
      } finally {
        setIsExecuting(false);
      }
      return;
    }

    const result = await executeProviderCall(
      selectedOperation,
      params,
      {
        simulateFallback: isSimulation,
        onLog: onLogAdded
      }
    );

    setLastDuration(result.durationMs);
    setLastResponse(result.data || result.rawResponse || result.error);
    setIsExecuting(false);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span>IPTV API v3 &amp; Cloudflare Worker Console</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Target:{' '}
              <code className="text-indigo-300">
                {gatewayTarget === 'PLAYBEAT_WORKER'
                  ? `/api/${actionName} (PlayBeat TV Worker)`
                  : 'Server-side provider API'}
              </code>
            </p>
          </div>

          {/* Gateway Switcher */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
              <button
                type="button"
                onClick={() => setGatewayTarget('PLAYBEAT_WORKER')}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  gatewayTarget === 'PLAYBEAT_WORKER'
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                PlayBeat Worker (/api/...)
              </button>
              <button
                type="button"
                onClick={() => setGatewayTarget('PROVIDER_DIRECT')}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  gatewayTarget === 'PROVIDER_DIRECT'
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Server-side provider API
              </button>
            </div>

            <span
              className={`text-xs px-2.5 py-1 rounded border font-mono ${
                isSimulation
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}
            >
              {isSimulation ? 'Sandbox' : 'Live'}
            </span>
          </div>
        </div>
      </div>

      {/* Main 2-Column: Operation & Form vs Response & cURL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Parameter Configuration */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select API Operation (type parameter)
            </label>
            <select
              value={selectedOperation}
              onChange={(e) => handleSelectOperation(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {operations.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Parameters List */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="text-xs font-medium text-slate-400">Request Parameters</div>

            {Object.keys(params).length === 0 ? (
              <div className="p-3 bg-slate-950 border border-slate-800/60 rounded text-xs text-slate-400">
                Operation takes no additional parameters other than <code className="text-indigo-300">apikey</code> and <code className="text-indigo-300">type</code>.
              </div>
            ) : (
              Object.entries(params).map(([key, val]) => (
                <div key={key}>
                  <label className="block font-mono text-[11px] text-slate-300 mb-0.5">
                    {key}
                  </label>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) =>
                      setParams({ ...params, [key]: e.target.value })
                    }
                    className="w-full font-mono bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ))
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching Request...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Execute API Call</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column (7 cols): cURL Commands & Live Response */}
        <div className="lg:col-span-7 space-y-4">
          {/* Generated cURL Box */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-indigo-400" />
                <span>Exact cURL POST Command</span>
              </span>
              <button
                onClick={() => handleCopy(activeCurl, 'curl_post')}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
              >
                {copiedKey === 'curl_post' ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>Copy cURL</span>
              </button>
            </div>
            <pre className="font-mono text-[11px] text-slate-300 bg-slate-950 p-3 rounded-md border border-slate-800/80 overflow-x-auto whitespace-pre-wrap">
              {activeCurl}
            </pre>
          </div>

          {/* Response Inspector */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">
                Execution Response
              </span>
              {lastDuration !== null && (
                <span className="font-mono text-[11px] text-emerald-400">
                  Latency: {lastDuration}ms
                </span>
              )}
            </div>

            <div className="bg-slate-950 p-3 rounded-md border border-slate-800/80 min-h-[160px] max-h-[300px] overflow-y-auto">
              {lastResponse ? (
                <pre className="font-mono text-xs text-indigo-300 whitespace-pre-wrap">
                  {typeof lastResponse === 'object'
                    ? JSON.stringify(lastResponse, null, 2)
                    : String(lastResponse)}
                </pre>
              ) : (
                <div className="text-slate-400 text-xs py-8 text-center">
                  Press &quot;Execute API Call&quot; to send request and inspect upstream provider response.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* API Session Log Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Session Call History</h3>
          </div>
          <button
            onClick={onClearLogs}
            className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-4">Method / Op</th>
                <th className="py-2.5 px-4">Latency</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Source</th>
                <th className="py-2.5 px-4">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {apiLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No requests dispatched in this session yet.
                  </td>
                </tr>
              ) : (
                apiLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-400">
                      {log.timestamp.substring(11, 19)}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-white">
                      POST {log.operation}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-300">
                      {log.durationMs}ms
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-[11px] font-mono ${
                          log.status === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">
                      {log.source}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 truncate max-w-xs font-mono text-[11px]">
                      {JSON.stringify(log.response)}
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
