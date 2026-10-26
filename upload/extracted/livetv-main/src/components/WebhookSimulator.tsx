import React, { useState, useEffect } from 'react';
import { CustomerLine } from '../types/iptv';
import { 
  Radio, 
  Check, 
  Copy, 
  Send, 
  RefreshCw, 
  ShieldCheck, 
  History, 
  Trash2, 
  Clock, 
  Activity,
  Tv
} from 'lucide-react';

interface WebhookEvent {
  id: string;
  action: string;
  activecode: string;
  start: number;
  end: number;
  timestamp: string;
}

interface WebhookSimulatorProps {
  lines: CustomerLine[];
  onActiveCodeActivated?: (code: string, start: number, end: number) => void;
}

export const WebhookSimulator: React.FC<WebhookSimulatorProps> = ({ lines }) => {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [handshakeStatus, setHandshakeStatus] = useState<string | null>(null);
  const [isTestingHandshake, setIsTestingHandshake] = useState(false);

  // Simulation form
  const activeCodeLines = lines.filter(l => l.lineType === 'ACTIVECODE');
  const [simCode, setSimCode] = useState(activeCodeLines[0]?.providerUsername || '01234567891011');
  const [isSimulating, setIsSimulating] = useState(false);

  // Compute origin and base64 encoded callback
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://starpanel.tv';
  const callbackUrl = `${origin}/api/activecode/callback`;
  const base64Callback = typeof btoa !== 'undefined' ? btoa(callbackUrl) : '';

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/activecode/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleTestHandshake = async () => {
    setIsTestingHandshake(true);
    setHandshakeStatus(null);
    try {
      const res = await fetch('/api/activecode/callback?handshake=1');
      const text = await res.text();
      if (text.trim() === '1') {
        setHandshakeStatus('Handshake Verified: Endpoint replied with 1');
      } else {
        setHandshakeStatus(`Replied with unexpected response: ${text}`);
      }
    } catch (err: any) {
      setHandshakeStatus(`Handshake error: ${err.message}`);
    } finally {
      setIsTestingHandshake(false);
    }
  };

  const handleSimulateActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);

    const startTs = Math.floor(Date.now() / 1000);
    const endTs = startTs + 30 * 24 * 60 * 60; // +30 days

    try {
      await fetch('/api/activecode/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'active',
          activecode: simCode.trim(),
          start: startTs,
          end: endTs
        })
      });
      await fetchEvents();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleClearEvents = async () => {
    try {
      await fetch('/api/activecode/events/clear', { method: 'POST' });
      setEvents([]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400" />
          <span>ActiveCode Webhook Architecture &amp; Event Receiver</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Receives player activation events when a subscriber launches the Star IPTV APK and activates their numeric code
        </p>
      </div>

      {/* 2-Column: Callback Setup & Test Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Callback URL & Handshake Verification */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Provider Webhook Configuration
          </div>

          {/* Raw URL */}
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400">Callback Endpoint URL</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={callbackUrl}
                className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-300"
              />
              <button
                onClick={() => handleCopy(callbackUrl, 'cb_url')}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
              >
                {copiedKey === 'cb_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Base64 Encoded (Required by provider API parameter 'callback') */}
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400">
              Base64 Encoded Callback (Sent with <code className="text-indigo-300">type=activecode</code>)
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={base64Callback}
                className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-emerald-400 select-all"
              />
              <button
                onClick={() => handleCopy(base64Callback, 'b64')}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
              >
                {copiedKey === 'b64' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Handshake test */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">Provider Handshake Probe</span>
              <button
                onClick={handleTestHandshake}
                disabled={isTestingHandshake}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium transition-colors"
              >
                {isTestingHandshake ? 'Probing...' : 'Test Handshake (?handshake=1)'}
              </button>
            </div>

            {handshakeStatus && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-[11px] text-emerald-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{handshakeStatus}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Simulation Dispatcher */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Player Activation Simulator
          </div>
          <p className="text-xs text-slate-400">
            Simulate an Android TV / FireStick device running TVStar IPTV APK and activating a code.
          </p>

          <form onSubmit={handleSimulateActivation} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 mb-1">Target ActiveCode</label>
              <input
                type="text"
                required
                value={simCode}
                onChange={(e) => setSimCode(e.target.value)}
                placeholder="01234567891011"
                className="w-full font-mono bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-md font-mono text-[11px] text-slate-400">
              Payload: &#123; &quot;action&quot;: &quot;active&quot;, &quot;activecode&quot;: &quot;{simCode}&quot;, &quot;start&quot;: &quot;...&quot;, &quot;end&quot;: &quot;...&quot; &#125;
            </div>

            <button
              type="submit"
              disabled={isSimulating}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSimulating ? 'Sending Event...' : 'Trigger Player Activation Event'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Received Webhook Events Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Received Activation Webhooks</h3>
          </div>
          <button
            onClick={handleClearEvents}
            className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Log</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4">Time Received</th>
                <th className="py-2.5 px-4">ActiveCode</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Start Timestamp</th>
                <th className="py-2.5 px-4">End Timestamp</th>
                <th className="py-2.5 px-4">Expiry Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No webhook activation events captured yet.
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-400">
                      {evt.timestamp.replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-emerald-400">
                      {evt.activecode}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-white">
                      {evt.action}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-300">
                      {evt.start}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-300">
                      {evt.end}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-indigo-300">
                      {evt.end ? new Date(evt.end * 1000).toISOString().split('T')[0] : '—'}
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
