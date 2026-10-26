import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall.js';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running inside standalone PWA shell, hide
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-2 rounded-lg bg-[#E5093A] hover:bg-[#B90732] text-white font-medium shadow-lg crimson-glow-sm transition-all duration-200 active:scale-95 ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-xs md:text-sm'
        }`}
        title="Install StreamPlay on this device"
      >
        <Download className="w-4 h-4" />
        <span className="whitespace-nowrap">Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 rounded-lg border border-white/20 hover:border-white/40 bg-white/5 text-slate-200 text-xs font-medium transition-colors ${
            compact ? 'px-2.5 py-1.5' : 'px-3 py-1.5'
          }`}
          title="Install on iPhone or iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#E5093A]" />
          <span className="whitespace-nowrap">Install PWA</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl bg-[#111A27] border border-white/10 p-6 shadow-2xl relative">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-12 h-12 rounded-xl bg-[#E5093A]/10 border border-[#E5093A]/30 flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6 text-[#E5093A]" />
              </div>
              <h3 className="text-base font-semibold text-white">Install StreamPlay on iOS</h3>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Enjoy full-screen cinematic playback with zero browser URL bar:
              </p>
              <div className="mt-4 space-y-2.5 text-xs text-slate-300">
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#E5093A]/20 text-[#E5093A] font-bold text-[10px]">1</span>
                  <span>Tap the <strong>Share</strong> button in Safari toolbar.</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#E5093A]/20 text-[#E5093A] font-bold text-[10px]">2</span>
                  <span>Scroll down and select <strong>Add to Home Screen</strong>.</span>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-[#192231] hover:bg-[#232E40] text-slate-200 py-2.5 text-xs font-semibold transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
