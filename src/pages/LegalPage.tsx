import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Send, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.js';

interface LegalPageProps {
  section: 'copyright' | 'takedown' | 'terms' | 'privacy' | 'refund' | 'disclaimer' | 'contact';
  onNavigate: (tab: string) => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({ section, onNavigate }) => {
  const { showToast } = useToast();

  // DMCA form states
  const [claimantName, setClaimantName] = useState('');
  const [claimantEmail, setClaimantEmail] = useState('');
  const [copyrightOwner, setCopyrightOwner] = useState('');
  const [infringementUrl, setInfringementUrl] = useState('');
  const [contentTitle, setContentTitle] = useState('');
  const [statement, setStatement] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(null);

  const handleSubmitTakedown = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimantName || !claimantEmail || !statement) {
      showToast('Please fill out all required fields', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.submitTakedownReport({
        claimantName,
        claimantEmail,
        copyrightOwner,
        allegedInfringementUrl: infringementUrl,
        contentTitle,
        statement,
      });

      setSubmissionSuccess(res.ticketNumber);
      showToast(res.message, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 min-h-screen">
      {/* Subnav links */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-8 border-b border-white/5 text-xs">
        {[
          { id: 'copyright', label: 'Copyright Policy' },
          { id: 'takedown', label: 'DMCA Takedown Notice' },
          { id: 'terms', label: 'Terms of Service' },
          { id: 'privacy', label: 'Privacy Policy' },
          { id: 'refund', label: 'Refund Policy' },
          { id: 'disclaimer', label: 'Platform Disclaimer' },
          { id: 'contact', label: 'Contact & Concierge' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              section === item.id
                ? 'bg-[#E5093A] text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* SECTION: TAKEDOWN NOTICE & INTERACTIVE FORM */}
      {section === 'takedown' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white font-display">
              Digital Millennium Copyright Act (DMCA) Notice & Takedown Procedure
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              StreamPlay respects the intellectual property rights of creators and copyright holders.
              We maintain a strict zero-tolerance policy against unauthorized transmission and an expedited notice-and-takedown mechanism.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#111A27] border border-white/10 shadow-xl">
            <h2 className="text-base font-bold text-white font-display mb-4">
              Submit an Expedited Takedown Notice
            </h2>

            {submissionSuccess ? (
              <div className="p-6 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <h3 className="text-base font-bold text-white">Notice Successfully Logged</h3>
                <p className="text-xs text-emerald-200">
                  Your reference ticket number is: <strong className="font-mono text-white">{submissionSuccess}</strong>
                </p>
                <p className="text-xs text-slate-300 max-w-md mx-auto pt-2">
                  Our compliance officer team has been notified for immediate review. Any affected content stream will be audited within our statutory response window.
                </p>
                <button
                  onClick={() => setSubmissionSuccess(null)}
                  className="mt-4 px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold hover:bg-white/20"
                >
                  Submit Another Notice
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitTakedown} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Your Full Name *</label>
                    <input
                      type="text"
                      required
                      value={claimantName}
                      onChange={(e) => setClaimantName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                      className="w-full bg-[#080B12] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E5093A]"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Contact Email *</label>
                    <input
                      type="email"
                      required
                      value={claimantEmail}
                      onChange={(e) => setClaimantEmail(e.target.value)}
                      placeholder="e.g. legal@copyrightowner.org"
                      className="w-full bg-[#080B12] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E5093A]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Copyright Owner / Entity</label>
                    <input
                      type="text"
                      value={copyrightOwner}
                      onChange={(e) => setCopyrightOwner(e.target.value)}
                      placeholder="Self or Name of represented entity"
                      className="w-full bg-[#080B12] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E5093A]"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Work / Title in Question</label>
                    <input
                      type="text"
                      value={contentTitle}
                      onChange={(e) => setContentTitle(e.target.value)}
                      placeholder="e.g. Title of film or broadcast feed"
                      className="w-full bg-[#080B12] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E5093A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Location / URL on StreamPlay</label>
                  <input
                    type="text"
                    value={infringementUrl}
                    onChange={(e) => setInfringementUrl(e.target.value)}
                    placeholder="https://stream.playbeatdigital.store/movies/..."
                    className="w-full bg-[#080B12] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E5093A]"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">
                    Statement Under Penalty of Perjury *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={statement}
                    onChange={(e) => setStatement(e.target.value)}
                    placeholder="I have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law..."
                    className="w-full bg-[#080B12] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#E5093A]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E5093A] hover:bg-[#B90732] disabled:opacity-50 text-white font-semibold shadow-lg transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Transmitting Notice...' : 'Submit Formal Notice'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SECTION: COPYRIGHT POLICY */}
      {section === 'copyright' && (
        <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <h1 className="text-3xl font-extrabold text-white font-display mb-4">
            Copyright & Provenance Policy
          </h1>
          <p>
            StreamPlay is designed from first principles around verifiable digital rights.
            We explicitly prohibit piracy, unlicensed scraping, re-broadcasting without statutory permission, or circumventing technological access controls.
          </p>
          <h3 className="text-base font-bold text-white font-display pt-2">Content Classes We Host</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>United States Public Domain Titles:</strong> Works whose copyright terms have expired or which entered the public domain through lack of statutory renewal or missing notice under pre-1978 copyright formalities (e.g. <em>Charade</em>, <em>Night of the Living Dead</em>, <em>His Girl Friday</em>).
            </li>
            <li>
              <strong>Creative Commons & Open-Source Cinema:</strong> Works created and released under open licenses, including the Blender Animation Foundation open-movie series.
            </li>
            <li>
              <strong>Free-to-Air Public Broadcasters:</strong> Legitimate statutory public-service broadcasts (e.g. Deutsche Welle, France 24, NASA TV, PTV Global) delivered via authorized open streaming protocols.
            </li>
            <li>
              <strong>Authorized Star IPTV Reseller Access:</strong> Direct reseller customer provisioning through Star IPTV official infrastructure (store.stariptv.pk).
            </li>
          </ul>
        </div>
      )}

      {/* SECTION: TERMS */}
      {section === 'terms' && (
        <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <h1 className="text-3xl font-extrabold text-white font-display mb-4">Terms of Service</h1>
          <p>
            By accessing or using StreamPlay, you agree to comply with all applicable local, national, and international laws and regulations.
          </p>
          <h3 className="text-base font-bold text-white font-display pt-2">1. Permitted Personal Use</h3>
          <p>
            Our web application and PWA are provided for private, non-commercial household viewing.
            You may not redistribute, sub-license, or publicly rebroadcast the video signals delivered by the platform.
          </p>
          <h3 className="text-base font-bold text-white font-display pt-2">2. Reseller Account Terms</h3>
          <p>
            Subscriptions provisioned through the Star IPTV reseller module remain subject to Star IPTV terms and service availability.
            Sharing generated M3U credentials beyond authorized screen limits will trigger automatic line lock by the reseller panel.
          </p>
        </div>
      )}

      {/* SECTION: PRIVACY */}
      {section === 'privacy' && (
        <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <h1 className="text-3xl font-extrabold text-white font-display mb-4">Privacy Policy</h1>
          <p>
            StreamPlay collects only minimal information necessary to deliver streaming sessions and manage subscription records.
          </p>
          <h3 className="text-base font-bold text-white font-display pt-2">Data We Collect</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>User account credentials (name, email).</li>
            <li>Device identifiers and session timestamps for multi-screen concurrency enforcement.</li>
            <li>Watch progress and watchlist records stored in account profiles.</li>
          </ul>
        </div>
      )}

      {/* SECTION: REFUND */}
      {section === 'refund' && (
        <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <h1 className="text-3xl font-extrabold text-white font-display mb-4">Refund Policy</h1>
          <p>
            We offer a 48-hour satisfaction evaluation period for new IPTV line activations.
            If technical incompatibility prevents line operation on your player hardware, our concierge team will process a full refund or exchange credit.
          </p>
        </div>
      )}

      {/* SECTION: DISCLAIMER */}
      {section === 'disclaimer' && (
        <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <h1 className="text-3xl font-extrabold text-white font-display mb-4">Legal Disclaimer</h1>
          <p>
            StreamPlay operates as an authorized platform and reseller portal.
            All third-party trademarks, broadcaster logos, and registered emblems belong to their respective statutory owners.
            Reference to external brand names does not constitute direct corporate endorsement.
          </p>
        </div>
      )}

      {/* SECTION: CONTACT */}
      {section === 'contact' && (
        <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <h1 className="text-3xl font-extrabold text-white font-display mb-4">Contact & Concierge</h1>
          <div className="p-6 rounded-2xl bg-[#111A27] border border-white/10 space-y-4">
            <p>For inquiries, support, or partnership discussions, reach our direct departments:</p>
            <div className="space-y-2 text-xs">
              <p>General Concierge: <strong className="text-white">concierge@aetherstream.tv</strong></p>
              <p>Legal & DMCA Office: <strong className="text-white">legal@aetherstream.tv</strong></p>
              <p>Reseller Portal: <strong className="text-white">store.stariptv.pk/panel/</strong></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
