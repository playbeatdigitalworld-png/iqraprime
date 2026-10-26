import React, { useState } from 'react';
import { 
  HelpCircle, 
  MessageSquare, 
  Send, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Zap, 
  CheckCircle2, 
  LifeBuoy, 
  Smartphone, 
  Wifi, 
  Clock,
  Sparkles
} from 'lucide-react';
import { SupportTicket, SUPPORT_TICKETS } from '../../services/catalogData';

interface SupportViewProps {
  onOpenPlans: () => void;
}

export const SupportView: React.FC<SupportViewProps> = ({ onOpenPlans }) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [tickets, setTickets] = useState<SupportTicket[]>(SUPPORT_TICKETS);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<'Streaming' | 'Account' | 'Payment' | 'Device Setup' | 'Technical Issue'>('Streaming');
  const [message, setMessage] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const faqs = [
    {
      q: 'Which internet speed is recommended for 4K Ultra HD streaming?',
      a: 'For butter-smooth 4K 60FPS sports and cinema feeds, we recommend a stable internet connection of at least 25-30 Mbps. For 1080p Full HD, 10-15 Mbps is sufficient. Connecting your TV or streaming box via an Ethernet LAN cable delivers the lowest latency and zero buffering.'
    },
    {
      q: 'Can I watch on multiple devices simultaneously?',
      a: 'Multi-device access depends on provider and account configuration. PlayBeat checkout and subscription provisioning are currently unavailable.'
    },
    {
      q: 'Do I need a VPN to use PlayBeat Entertainment?',
      a: 'Network behavior depends on your provider and ISP. DNS-over-HTTPS does not bypass ISP restrictions or guarantee playback.'
    },
    {
      q: 'How fast is subscription activation after payment?',
      a: 'Checkout and subscription provisioning are unavailable. No payment will be collected and no IPTV credentials will be created through PlayBeat.'
    },
    {
      q: 'What if a channel experiences buffering or audio desync?',
      a: 'Playback troubleshooting is unavailable until a secure provider is configured. The in-site player can only play streams returned by an authorized provider.'
    },
    {
      q: 'What is PlayBeat’s content authorization policy?',
      a: 'Only connect content sources you are authorized to use. Live channels remain unavailable until a secure provider is configured.'
    }
  ];

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    const newTicket: SupportTicket = {
      id: `tkt_pb_${Date.now().toString().slice(-5)}`,
      subject,
      category,
      priority: 'NORMAL',
      status: 'OPEN',
      createdAt: 'Just now',
      updatedAt: 'Just now',
      messages: [
        {
          id: `m_${Date.now()}`,
          sender: 'CUSTOMER',
          senderName: 'Customer',
          text: message,
          time: 'Just now'
        }
      ]
    };

    setTickets([newTicket, ...tickets]);
    setSubject('');
    setMessage('');
    setSubmittedSuccess(true);
    setTimeout(() => setSubmittedSuccess(false), 5000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-12">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
          <LifeBuoy className="w-3.5 h-3.5" />
          <span>24/7 VIP Customer Care &amp; Technical Desk</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white font-display tracking-tight">
          How Can We Help You Today?
        </h1>
        <p className="text-sm text-slate-400">
          Find instant answers to common streaming questions or submit a ticket directly to our network operations team.
        </p>
      </div>

      {/* Quick Contact Banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0c1326] border border-white/[0.08] p-5 rounded-2xl space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            <Smartphone className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">WhatsApp VIP Support</h3>
          <p className="text-xs text-slate-400">Instant setup help, renewal assistance, and bill validation.</p>
          <div className="pt-2">
            <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-md inline-block">
              +92 300 1234567
            </span>
          </div>
        </div>

        <div className="bg-[#0c1326] border border-white/[0.08] p-5 rounded-2xl space-y-2">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold">
            <Wifi className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Stream Uptime 99.98%</h3>
          <p className="text-xs text-slate-400">Load-balanced edge relays across Europe, US, Asia &amp; Middle East.</p>
          <div className="pt-2 flex items-center gap-1.5 text-xs text-cyan-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>All 48 Nodes Operational</span>
          </div>
        </div>

        <div className="bg-[#0c1326] border border-white/[0.08] p-5 rounded-2xl space-y-2">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Average Response Time</h3>
          <p className="text-xs text-slate-400">Under 8 minutes for priority ticket resolution.</p>
          <div className="pt-2">
            <span className="text-xs font-semibold text-purple-300 bg-purple-950/60 border border-purple-500/30 px-2.5 py-1 rounded-md inline-block">
              Priority Escalation 24/7
            </span>
          </div>
        </div>
      </div>

      {/* FAQs Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-white/[0.08]">
            <HelpCircle className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white font-display">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="bg-[#0c1326] border border-white/[0.06] rounded-xl overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between gap-3 text-sm font-semibold text-white hover:text-cyan-300"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-cyan-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-xs text-slate-300 leading-relaxed border-t border-white/[0.04] pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Ticket Submission Form */}
        <div className="lg:col-span-5 bg-[#0c1326] border border-white/[0.08] p-6 rounded-2xl space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-white/[0.08]">
            <MessageSquare className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white font-display">Open Support Ticket</h2>
          </div>

          {submittedSuccess ? (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs space-y-2 text-center animate-in fade-in">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="font-bold text-sm">Ticket Submitted Successfully!</p>
              <p className="text-slate-300">
                Ticket reference #TKT-{Date.now().toString().slice(-4)} has been assigned. Our technician is reviewing your request.
              </p>
            </div>
          ) : (
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Issue Category</label>
                <select
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                  className="w-full bg-[#050811] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Streaming">Streaming / Buffering Issue</option>
                  <option value="Device Setup">Device Setup &amp; Configuration</option>
                  <option value="Payment">Payment &amp; Billing Inquiry</option>
                  <option value="Account">Account &amp; Password Renewal</option>
                  <option value="Technical Issue">General Technical Assistance</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Subject / Headline</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., TiviMate connection timeout on sports channel"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-[#050811] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Describe Your Issue</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide device model, app name, and any error message you receive..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-[#050811] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-cyan-500/20 flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Ticket</span>
              </button>
            </form>
          )}

          {/* Recent Tickets List */}
          <div className="pt-2 border-t border-white/[0.06] space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Your Open Tickets ({tickets.length}):
            </span>
            <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
              {tickets.map((t) => (
                <div key={t.id} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-white block truncate max-w-[200px]">{t.subject}</span>
                    <span className="text-[10px] text-slate-400">{t.category} · {t.updatedAt}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    t.status === 'OPEN' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
