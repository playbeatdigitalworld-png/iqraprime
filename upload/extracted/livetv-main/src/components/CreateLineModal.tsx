import React, { useState, useEffect } from 'react';
import { 
  BouquetDefinition, 
  BOUQUETS, 
  CustomerLine, 
  LineType, 
  PlanId, 
  PLANS, 
  ServerConfig 
} from '../types/iptv';
import { X, Tv, Smartphone, Radio, AlertCircle, Sparkles, Check } from 'lucide-react';

interface CreateLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  servers: ServerConfig[];
  balanceCenti: number;
  initialType?: LineType;
  initialIsTrial?: boolean;
  onSubmit: (lineData: Partial<CustomerLine>) => Promise<boolean>;
}

export const CreateLineModal: React.FC<CreateLineModalProps> = ({
  isOpen,
  onClose,
  servers,
  balanceCenti,
  initialType = 'XTREAM',
  initialIsTrial = false,
  onSubmit
}) => {
  const [lineType, setLineType] = useState<LineType>(initialType);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [planId, setPlanId] = useState<PlanId>(initialIsTrial ? 11 : 1);
  const [connections, setConnections] = useState<number>(1);
  const [selectedBid, setSelectedBid] = useState<string>('[5,11]');
  const [serverId, setServerId] = useState<string>(servers[0]?.id || 'srv_primary_01');
  const [addChannels, setAddChannels] = useState<boolean>(true);
  const [addVods, setAddVods] = useState<boolean>(true);
  const [adults, setAdults] = useState<boolean>(false);
  const [notice, setNotice] = useState<string>('');
  const [macAddress, setMacAddress] = useState<string>('00:1A:79:');
  const [activeCode, setActiveCode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLineType(initialType);
      setPlanId(initialIsTrial ? 11 : 1);
      setErrorMsg(null);
      if (initialType === 'XTREAM' && !username) {
        generateRandomXtream();
      } else if (initialType === 'ACTIVECODE' && !activeCode) {
        generateRandomActiveCode();
      } else if (initialType === 'MAC' && macAddress === '00:1A:79:') {
        generateRandomMac();
      }
    }
  }, [isOpen, initialType, initialIsTrial]);

  if (!isOpen) return null;

  const currentPlan = PLANS[planId];
  const requiredCredits = currentPlan.baseCredits * connections;
  const hasSufficientCredits = planId === 11 || (balanceCenti >= requiredCredits * 100);

  const generateRandomXtream = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let u = 'user_';
    for (let i = 0; i < 6; i++) {
      u += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const p = Math.random().toString(36).slice(-8) + 'X9';
    setUsername(u);
    setPassword(p);
  };

  const generateRandomActiveCode = () => {
    let code = '';
    for (let i = 0; i < 14; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    setActiveCode(code);
  };

  const generateRandomMac = () => {
    const hex = '0123456789ABCDEF';
    let mac = '00:1A:79';
    for (let i = 0; i < 3; i++) {
      mac += ':' + hex.charAt(Math.floor(Math.random() * 16)) + hex.charAt(Math.floor(Math.random() * 16));
    }
    setMacAddress(mac);
  };

  const validate = (): boolean => {
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Please specify subscriber / customer name.');
      return false;
    }

    if (!hasSufficientCredits) {
      setErrorMsg(
        `Insufficient credit balance. Required: ${requiredCredits} Credits. Current: ${(balanceCenti / 100).toFixed(2)} Credits.`
      );
      return false;
    }

    if (lineType === 'XTREAM') {
      const u = username.trim().toLowerCase();
      const p = password.trim();

      if (u.length < 6 || u.length > 23) {
        setErrorMsg('Xtream username must be between 6 and 23 characters.');
        return false;
      }
      if (p.length < 6 || p.length > 23) {
        setErrorMsg('Xtream password must be between 6 and 23 characters.');
        return false;
      }
      if (u === p) {
        setErrorMsg('Username and password cannot be identical (prohibited by provider).');
        return false;
      }
      const validChars = /^[a-z0-9._-]+$/;
      if (!validChars.test(u) || !validChars.test(p)) {
        setErrorMsg('Only characters a-z, 0-9, dot (.), underscore (_), and hyphen (-) are allowed.');
        return false;
      }
    } else if (lineType === 'ACTIVECODE') {
      const cleanCode = activeCode.trim();
      if (!/^\d{12,18}$/.test(cleanCode)) {
        setErrorMsg('ActiveCode must contain between 12 and 18 numeric digits only.');
        return false;
      }
    } else if (lineType === 'MAC') {
      const cleanMac = macAddress.trim().toUpperCase();
      if (!/^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/.test(cleanMac)) {
        setErrorMsg('MAC address must be in format 00:1A:79:XX:XX:XX.');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const providerUser =
        lineType === 'XTREAM'
          ? username.trim().toLowerCase()
          : lineType === 'ACTIVECODE'
          ? activeCode.trim()
          : macAddress.trim().toUpperCase();

      const providerPass = lineType === 'XTREAM' ? password.trim() : 'TVSTARIPTV';

      const lineData: Partial<CustomerLine> = {
        name: name.trim(),
        lineType,
        providerUsername: providerUser,
        providerPassword: providerPass,
        serverId,
        plan: planId,
        bid: selectedBid,
        connections,
        addch: addChannels ? 1 : 0,
        addvods: addVods ? 1 : 0,
        adults: adults ? 1 : 0,
        notice: notice.trim(),
        creditCost: requiredCredits
      };

      const success = await onSubmit(lineData);
      if (success) {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create line.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-sm font-semibold text-white">Generate IPTV Subscription Line</h2>
            <p className="text-xs text-slate-400">Issues line directly to upstream IPTV Provider v3</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Line Type Selector */}
          <div>
            <label className="block font-medium text-slate-300 mb-2">Protocol Architecture</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setLineType('XTREAM')}
                className={`flex items-center gap-2 p-2.5 rounded-md border text-left transition-colors ${
                  lineType === 'XTREAM'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Tv className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <div className="font-semibold text-white">Xtream Codes</div>
                  <div className="text-[10px] text-slate-400">User / Password M3U</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setLineType('ACTIVECODE')}
                className={`flex items-center gap-2 p-2.5 rounded-md border text-left transition-colors ${
                  lineType === 'ACTIVECODE'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-white">ActiveCode</div>
                  <div className="text-[10px] text-slate-400">Numeric APK activation</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setLineType('MAC')}
                className={`flex items-center gap-2 p-2.5 rounded-md border text-left transition-colors ${
                  lineType === 'MAC'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Radio className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <div className="font-semibold text-white">STB / MAG MAC</div>
                  <div className="text-[10px] text-slate-400">Hardware Portal link</div>
                </div>
              </button>
            </div>
          </div>

          {/* Subscriber Name */}
          <div>
            <label className="block font-medium text-slate-300 mb-1">Subscriber / Customer Label</label>
            <input
              type="text"
              required
              placeholder="e.g. John Doe (Living Room TV)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Xtream Credentials Inputs */}
          {lineType === 'XTREAM' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-slate-300">Username (6-23 chars)</label>
                  <button
                    type="button"
                    onClick={generateRandomXtream}
                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  className="w-full font-mono bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Password (6-23 chars)</label>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full font-mono bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* ActiveCode Input */}
          {lineType === 'ACTIVECODE' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-medium text-slate-300">Numeric ActiveCode (12-18 digits)</label>
                <button
                  type="button"
                  onClick={generateRandomActiveCode}
                  className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Generate code</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={activeCode}
                onChange={(e) => setActiveCode(e.target.value.replace(/\D/g, ''))}
                placeholder="01234567891011"
                className="w-full font-mono bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* MAC Address Input */}
          {lineType === 'MAC' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-medium text-slate-300">Device MAC Address</label>
                <button
                  type="button"
                  onClick={generateRandomMac}
                  className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Generate random MAC</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={macAddress}
                onChange={(e) => setMacAddress(e.target.value.toUpperCase())}
                placeholder="00:1A:79:AA:BB:CC"
                className="w-full font-mono bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* Plan Duration & Connection Count */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-300 mb-1">Subscription Plan</label>
              <select
                value={planId}
                onChange={(e) => setPlanId(Number(e.target.value) as PlanId)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value={11}>24h Free Trial (0 Credits)</option>
                <option value={1}>1 Month Subscription (1 Credit / conx)</option>
                <option value={2}>3 Months Subscription (3 Credits / conx)</option>
                <option value={3}>6 Months Subscription (5 Credits / conx)</option>
                <option value={4}>12 Months Subscription (10 Credits / conx)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Screens (CONX)
              </label>
              <select
                value={connections}
                onChange={(e) => setConnections(Number(e.target.value))}
                disabled={planId === 11}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              >
                <option value={1}>1 Screen</option>
                <option value={2}>2 Screens (2x)</option>
                <option value={3}>3 Screens (3x)</option>
                <option value={4}>4 Screens (4x)</option>
              </select>
            </div>
          </div>

          {/* Bouquet Selection */}
          <div>
            <label className="block font-medium text-slate-300 mb-1">Bouquet Package (BID)</label>
            <select
              value={selectedBid}
              onChange={(e) => {
                setSelectedBid(e.target.value);
                const b = BOUQUETS.find(x => x.bid === e.target.value);
                if (b) setAdults(b.hasAdult);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            >
              {BOUQUETS.map((b) => (
                <option key={b.bid} value={b.bid}>
                  {b.name} — {b.bid}
                </option>
              ))}
            </select>
          </div>

          {/* Content Flags (addch, addvods, adults) */}
          <div>
            <label className="block font-medium text-slate-300 mb-2">Content Parameters</label>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-md cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={addChannels}
                  onChange={(e) => setAddChannels(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span className="text-slate-300">Live TV Channels</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-md cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={addVods}
                  onChange={(e) => setAddVods(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span className="text-slate-300">Movies & Series</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-md cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={adults}
                  onChange={(e) => setAdults(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span className="text-slate-300">Adult Content</span>
              </label>
            </div>
          </div>

          {/* Notice note */}
          <div>
            <label className="block font-medium text-slate-300 mb-1">Notice (Optional)</label>
            <input
              type="text"
              value={notice}
              onChange={(e) => setNotice(e.target.value)}
              placeholder="e.g. VIP client - Renew before Oct 15"
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Cost Summary Box */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-slate-400">Total Provider Charge:</span>
              <div className="font-mono text-sm font-bold text-white tabular-nums">
                {planId === 11 ? (
                  <span className="text-amber-400">0.00 Credits (Trial)</span>
                ) : (
                  <span className="text-emerald-400">{requiredCredits}.00 Credits</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-slate-400">Balance after order:</span>
              <div className="font-mono text-xs tabular-nums text-slate-300">
                {((balanceCenti - requiredCredits * 100) / 100).toFixed(2)} Credits
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !hasSufficientCredits}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md font-semibold transition-all shadow-sm flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Issuing Line...</span>
                </>
              ) : (
                <span>Confirm &amp; Create Line</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
