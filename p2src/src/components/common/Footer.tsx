import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { StreamPlayLogo } from './StreamPlayLogo.js';

interface FooterProps {
  onNavigate: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="relative border-t border-white/[0.07] bg-[#070B12]/85 backdrop-blur-sm text-[#8993A3] text-xs pt-12 pb-24 md:pb-12 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 pb-10 border-b border-white/[0.05]">
          {/* Brand info */}
          <div className="md:col-span-2">
            <div className="mb-4">
              <StreamPlayLogo
                iconClassName="w-8 h-8"
                textClassName="text-base font-extrabold tracking-tight text-white"
                showTagline={false}
              />
            </div>
            <p className="text-xs text-[#C6CBD4]/70 leading-relaxed max-w-sm mb-4">
              Premium international OTT platform — verified public-domain cinema,
              licensed free-to-air live TV with full EPG, and secure member-only
              streaming infrastructure.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Strict Anti-Piracy Architecture & Rights Audit Enforcement</span>
            </div>
          </div>

          {/* Platform Navigation */}
          <div>
            <h4 className="text-xs font-semibold text-white tracking-wider uppercase mb-3 font-display">
              Catalog
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => onNavigate('home')}
                  className="hover:text-white transition-colors"
                >
                  Featured Cinema
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('live-tv')}
                  className="hover:text-white transition-colors"
                >
                  Free-to-Air Live TV
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('free-cinema')}
                  className="hover:text-white transition-colors"
                >
                  Public Domain Archives
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('devices')}
                  className="hover:text-white transition-colors"
                >
                  Watch on Your Device
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('pricing')}
                  className="hover:text-white transition-colors"
                >
                  Private Pilot Access
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('my-list')}
                  className="hover:text-white transition-colors"
                >
                  Universal Watchlist
                </button>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance */}
          <div>
            <h4 className="text-xs font-semibold text-white tracking-wider uppercase mb-3 font-display">
              Rights & Policies
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => onNavigate('copyright')}
                  className="hover:text-white transition-colors"
                >
                  Copyright Policy
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('takedown')}
                  className="hover:text-[#E5093A] transition-colors font-medium"
                >
                  DMCA Takedown Notice
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('terms')}
                  className="hover:text-white transition-colors"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('privacy')}
                  className="hover:text-white transition-colors"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('refund-policy')}
                  className="hover:text-white transition-colors"
                >
                  Refund Policy
                </button>
              </li>
            </ul>
          </div>

          {/* SECP Registration & Pilot Disclosure */}
          <div>
            <h4 className="text-xs font-semibold text-white tracking-wider uppercase mb-3 font-display">
              Pre-Launch Status
            </h4>
            <p className="text-[11px] text-[#C6CBD4]/70 leading-relaxed mb-3">
              StreamPlay is currently in a <strong className="text-white">private closed-beta pilot for authorized household members</strong>.
              Commercial service launch will follow SECP corporate registration and regulatory approvals in Pakistan.
            </p>
            <div className="pt-2 border-t border-white/5">
              <span className="text-[10px] text-slate-500 block">
                Compliance Concierge: legal@aetherstream.tv
              </span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <p>© {new Date().getFullYear()} StreamPlay. All rights reserved.</p>
          <p>
            All displayed video works adhere to USA Public Domain, Creative Commons, or authorized public-service broadcast syndication.
          </p>
        </div>
      </div>
    </footer>
  );
};
