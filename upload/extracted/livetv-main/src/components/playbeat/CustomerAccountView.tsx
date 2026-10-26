import React, { useState } from 'react';
import { RegisteredDevice, REGISTERED_DEVICES, SUPPORT_TICKETS, SupportTicket } from '../../services/catalogData';
import { 
  User, 
  CreditCard, 
  Tv, 
  Smartphone, 
  Copy, 
  Check, 
  Download, 
  ShieldCheck, 
  Trash2, 
  Edit2, 
  Plus, 
  HelpCircle,
  ExternalLink,
  Clock,
  Sparkles
} from 'lucide-react';

interface CustomerAccountViewProps {
  subscription: {
    planName: string;
    status: 'ACTIVE' | 'TRIAL' | 'EXPIRED';
    expiryDate: string;
    daysRemaining: number;
    connectionsAllowed: number;
  };
  onRenew: () => void;
  myList: string[];
}

export const CustomerAccountView: React.FC<CustomerAccountViewProps> = ({
  subscription,
  onRenew,
  myList
}) => {
  const [activeTab, setActiveTab] = useState<'DEVICES' | 'INVOICES' | 'SUPPORT' | 'SAVED'>('DEVICES');
  const [devices, setDevices] = useState<RegisteredDevice[]>(REGISTERED_DEVICES);

  // Support tickets
  const [tickets, setTickets] = useState<SupportTicket[]>(SUPPORT_TICKETS);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);

  const handleRemoveDevice = (id: string) => {
    setDevices(devices.filter((d) => d.id !== id));
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketSubject.trim()) return;

    const newTicket: SupportTicket = {
      id: `tkt_${Date.now().toString().slice(-4)}`,
      subject: newTicketSubject.trim(),
      category: 'Streaming',
      priority: 'NORMAL',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: `msg_${Date.now()}`,
          sender: 'CUSTOMER',
          senderName: 'Support',
          text: newTicketMessage.trim() || newTicketSubject.trim(),
          time: 'Just now'
        }
      ]
    };

    setTickets([newTicket, ...tickets]);
    setNewTicketSubject('');
    setNewTicketMessage('');
    setShowNewTicketModal(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">
      {/* Top Header Card */}
      <div className="p-6 bg-gradient-to-r from-[#0c1326] via-[#111b33] to-[#0c1326] border border-white/10 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white text-2xl font-black font-display shadow-lg shadow-cyan-500/20">
            PB
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white font-display">Your account</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {subscription.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Plan: <strong className="text-white">{subscription.planName}</strong> · Valid until{' '}
              <span className="text-cyan-400 font-mono font-semibold">{subscription.expiryDate}</span> ({subscription.daysRemaining} days remaining)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRenew}
            className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs uppercase shadow-md shadow-cyan-500/20 transition-all"
          >
            Renew / Upgrade Plan
          </button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'DEVICES', label: `Active Devices (${devices.length}/${subscription.connectionsAllowed})` },
          { id: 'INVOICES', label: 'Billing Invoices' },
          { id: 'SAVED', label: `Saved List (${myList.length})` },
          { id: 'SUPPORT', label: `Support Tickets (${tickets.length})` }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 2: ACTIVE DEVICES */}
      {activeTab === 'DEVICES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Connected Devices: <strong className="text-white">{devices.length}</strong> of{' '}
              <strong className="text-cyan-400">{subscription.connectionsAllowed} Max Allowed</strong>
            </span>
            <span>Concurrent Session Guardian Active</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {devices.map((dev) => (
              <div
                key={dev.id}
                className="p-4 bg-[#0c1326]/80 border border-white/10 rounded-2xl space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-white/10 text-cyan-400">
                      {dev.type === 'Smart TV' || dev.type === 'Apple TV' ? <Tv className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{dev.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{dev.type} · {dev.ip}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveDevice(dev.id)}
                    className="text-slate-400 hover:text-rose-400 p-1"
                    title="Remove device"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${dev.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                    <span>{dev.status}</span>
                  </span>
                  <span className="truncate max-w-[150px]">{dev.lastSeen}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: INVOICES */}
      {activeTab === 'INVOICES' && (
        <div className="p-5 bg-[#0c1326]/80 border border-white/10 rounded-3xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px]">
                <th className="py-2.5 px-3">Invoice #</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Plan</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              <tr className="hover:bg-white/[0.02]">
                <td className="py-3 px-3 font-mono text-cyan-300">INV-PB-99410</td>
                <td className="py-3 px-3 text-slate-400">2026-10-01</td>
                <td className="py-3 px-3 font-bold text-white">STANDARD (2 Screens)</td>
                <td className="py-3 px-3 font-mono text-emerald-400 font-bold">$15.99 USD</td>
                <td className="py-3 px-3 text-slate-300">JazzCash Auto-Pay</td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">
                    PAID
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-white/[0.02]">
                <td className="py-3 px-3 font-mono text-cyan-300">INV-PB-88204</td>
                <td className="py-3 px-3 text-slate-400">2026-09-01</td>
                <td className="py-3 px-3 font-bold text-white">STANDARD (2 Screens)</td>
                <td className="py-3 px-3 font-mono text-emerald-400 font-bold">$15.99 USD</td>
                <td className="py-3 px-3 text-slate-300">JazzCash Auto-Pay</td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">
                    PAID
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: SUPPORT TICKETS */}
      {activeTab === 'SUPPORT' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Customer Support Desk</h3>
            <button
              onClick={() => setShowNewTicketModal(true)}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Open New Ticket</span>
            </button>
          </div>

          <div className="space-y-3">
            {tickets.map((tkt) => (
              <div
                key={tkt.id}
                className="p-4 bg-[#0c1326]/80 border border-white/10 rounded-2xl space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{tkt.subject}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300">
                    {tkt.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Ticket #{tkt.id} · Category: {tkt.category} · Priority: {tkt.priority}
                </div>
                <div className="p-3 bg-[#050811] rounded-xl text-slate-300 text-[11px] space-y-1">
                  <strong>Latest response:</strong> {tkt.messages[tkt.messages.length - 1]?.text}
                </div>
              </div>
            ))}
          </div>

          {showNewTicketModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
              <form
                onSubmit={handleCreateTicket}
                className="bg-[#0c1326] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs"
              >
                <h3 className="text-base font-bold text-white">Open Support Request</h3>
                <div>
                  <label className="block text-slate-400 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Issue buffering on Smart TV"
                    value={newTicketSubject}
                    onChange={(e) => setNewTicketSubject(e.target.value)}
                    className="w-full bg-[#050811] border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Detailed Message</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Provide details about device and error..."
                    value={newTicketMessage}
                    onChange={(e) => setNewTicketMessage(e.target.value)}
                    className="w-full bg-[#050811] border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowNewTicketModal(false)}
                    className="px-4 py-2 bg-white/10 text-white rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-cyan-500 text-slate-950 font-bold rounded-xl"
                  >
                    Submit Ticket
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SAVED LIST */}
      {activeTab === 'SAVED' && (
        <div className="p-6 bg-[#0c1326]/80 border border-white/10 rounded-3xl space-y-3">
          <h3 className="text-sm font-bold text-white">My Saved Bookmarks</h3>
          {myList.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Your saved list is empty. Click the bookmark icon on any movie, show, or channel to add it here.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {myList.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#050811] border border-white/10 rounded-xl text-xs font-semibold text-white flex items-center justify-between"
                >
                  <span className="truncate">{item}</span>
                  <span className="text-cyan-400 text-[10px]">Saved</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
