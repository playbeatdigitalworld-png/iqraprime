import React, { useMemo } from 'react';

/**
 * CinematicBackdrop — the fixed "premium cinema environment" behind the app.
 *
 * Pure CSS/original visuals only (no copyrighted artwork):
 * - obsidian base gradients + deep navy atmospheric lighting
 * - faint crimson / magenta stage glows
 * - cinematic vignette
 * - fine film-grain (SVG turbulence tile)
 * - slow drifting particle bloom (desktop only, reduced-motion aware)
 *
 * Layers are pointer-inert and sit behind all content (z-0).
 */
export const CinematicBackdrop: React.FC = () => {
  // Deterministic pseudo-random particle field (stable across renders)
  const particles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const seed = (i * 137.508) % 100; // golden-angle spread
        return {
          left: `${(seed * 0.97 + 4) % 96}%`,
          top: `${(seed * 1.31 + 8) % 88}%`,
          size: 2 + ((i * 7) % 4),
          delay: `${(i * 2.7) % 20}s`,
          duration: `${22 + ((i * 5) % 14)}s`,
        };
      }),
    []
  );

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
    >
      {/* Layer 1 — obsidian base + navy/crimson atmosphere */}
      <div className="absolute inset-0 cine-atmosphere" />

      {/* Layer 2 — soft light bloom accents (desktop only) */}
      <div className="hidden md:block absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full bg-[#1B2D4A]/20 blur-[120px]" />
      <div className="hidden md:block absolute top-1/3 -right-40 w-[520px] h-[520px] rounded-full bg-[#E5093A]/[0.05] blur-[130px]" />

      {/* Layer 3 — drifting particle bloom (desktop only) */}
      <div className="hidden md:block absolute inset-0">
        {particles.map((p, i) => (
          <span
            key={i}
            className="cine-particle"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>

      {/* Layer 4 — cinematic vignette frame */}
      <div className="absolute inset-0 cine-vignette" />

      {/* Layer 5 — fine film grain */}
      <div className="absolute inset-0 cine-grain" />
    </div>
  );
};
