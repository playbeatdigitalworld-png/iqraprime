"use client";

import { useEffect, useState } from "react";
import { usePwaInstall } from "@/hooks/usePwaInstall";

/** Guided install modal — iOS Safari (Share → Add to Home Screen) & unsupported browsers. */
export default function IosInstallModal() {
  const { iosGuided, dismissGuided, isIOS } = usePwaInstall();
  const [platform, setPlatform] = useState<"ios" | "other">("other");

  useEffect(() => {
    setPlatform(isIOS() ? "ios" : "other");
  }, [isIOS]);

  if (!iosGuided) return null;

  const stepText =
    platform === "ios"
      ? {
          icon: "􀈂",
          steps: [
            "Tap the Share button in Safari's toolbar (the square with an arrow).",
            "Scroll down and tap Add to Home Screen.",
            "Tap Add — the IQRAPRIME icon appears on your Home Screen.",
          ],
          note: "Install via Safari on iPhone or iPad. The app then runs fullscreen, just like a native app.",
        }
      : {
          icon: "⬇",
          steps: [
            "Open the browser menu (⋮ or ⋯ in the toolbar).",
            "Look for Install app / Add to Home screen.",
            "Confirm — IQRAPRIME installs to your device.",
          ],
          note: "For the best experience, use Chrome, Edge, or Samsung Internet — they support one-tap install.",
        };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
      aria-describedby="ios-install-desc"
      onClick={dismissGuided}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl border border-gold/30 bg-navy p-6 shadow-2xl fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-gold to-gold-deep text-ink text-xl font-black">
            I
          </span>
          <div>
            <h2 id="ios-install-title" className="text-lg font-bold text-white">
              Install IQRAPRIME
            </h2>
            <p id="ios-install-desc" className="text-xs text-mist">
              Kahani Jo Dil Chhoo Jaye
            </p>
          </div>
          <button
            onClick={dismissGuided}
            aria-label="Close install guide"
            className="ml-auto h-9 w-9 rounded-full border border-gold/25 text-mist hover:text-gold hover:border-gold/50 transition"
          >
            ✕
          </button>
        </div>

        <ol className="space-y-3">
          {stepText.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold/15 text-gold text-xs font-bold">
                {i + 1}
              </span>
              <span className="text-sm text-white/90 leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>

        <p className="mt-4 rounded-lg bg-white/5 border border-gold/15 p-3 text-xs text-mist leading-relaxed">
          {stepText.note}
        </p>
      </div>
    </div>
  );
}
