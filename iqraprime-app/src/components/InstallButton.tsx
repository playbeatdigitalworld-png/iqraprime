"use client";

import { usePwaInstall } from "@/hooks/usePwaInstall";
import IosInstallModal from "./IosInstallModal";

interface Props {
  className?: string;
  label?: string;
  compact?: boolean;
}

/** Shared install button used in Header ("Install App") and Footer ("Install Our App"). */
export default function InstallButton({ className = "", label = "Install App", compact = false }: Props) {
  const { available, installed, iosGuided, install, dismissGuided } = usePwaInstall();

  if (installed) {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold ${className}`}
        title="IQRAPRIME is installed"
      >
        ✓ {compact ? "Installed" : "App Installed"}
      </span>
    );
  }

  return (
    <>
      <button
        onClick={install}
        className={`btn-gold inline-flex items-center gap-2 rounded-lg ${compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} ${className}`}
        aria-label={`Install IQRAPRIME app${available ? " (install prompt ready)" : " (guided steps)"}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3v12m0 0 4-4m-4 4-4-4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        {label}
      </button>
      {iosGuided && <IosInstallModal />}
    </>
  );
}
