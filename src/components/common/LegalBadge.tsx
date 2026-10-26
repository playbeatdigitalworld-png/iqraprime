import React from 'react';
import type { ContentRightsStatus } from '../../types/index.js';

interface LegalBadgeProps {
  status: ContentRightsStatus;
  licenseText?: string;
  className?: string;
}

/**
 * Renders verified legal rights according to the Zero-Pill & Metadata Discipline:
 * Clean, unboxed text metadata with subtle typographic separators and refined tone.
 */
export const LegalBadge: React.FC<LegalBadgeProps> = ({ status, licenseText, className = '' }) => {
  const getLabel = () => {
    switch (status) {
      case 'PUBLIC_DOMAIN':
        return 'Public Domain';
      case 'OPEN_LICENSE':
        return licenseText || 'Open Creative License';
      case 'PUBLIC_BROADCAST':
        return 'Public Broadcaster (FTA)';
      case 'FREE_TO_AIR':
        return 'Free-To-Air Official Stream';
      case 'AUTHORIZED_RESELLER':
        return 'Authorized Reseller Tier';
      case 'TRAILER_ONLY':
        return 'Official Studio Trailer';
      default:
        return 'Verified Legal Stream';
    }
  };

  const getColor = () => {
    switch (status) {
      case 'PUBLIC_DOMAIN':
        return 'text-emerald-400';
      case 'OPEN_LICENSE':
        return 'text-cyan-400';
      case 'PUBLIC_BROADCAST':
      case 'FREE_TO_AIR':
        return 'text-amber-300';
      case 'AUTHORIZED_RESELLER':
        return 'text-rose-400';
      case 'TRAILER_ONLY':
        return 'text-slate-400';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase ${getColor()} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75" />
      <span>{getLabel()}</span>
    </span>
  );
};
