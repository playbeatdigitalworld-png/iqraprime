import React from 'react';

interface PlayBeatLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const PlayBeatLogo: React.FC<PlayBeatLogoProps> = ({
  size = 'md',
  showText = true,
  className = ''
}) => {
  // Height presets
  const sizeMap = {
    xs: { icon: 24, text: 'text-sm', sub: 'text-[7px]' },
    sm: { icon: 32, text: 'text-base', sub: 'text-[8px]' },
    md: { icon: 42, text: 'text-xl', sub: 'text-[9px]' },
    lg: { icon: 60, text: 'text-2xl sm:text-3xl', sub: 'text-[11px]' },
    xl: { icon: 88, text: 'text-4xl sm:text-5xl', sub: 'text-xs tracking-[0.3em]' }
  };

  const { icon, text, sub } = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* 3D Chrome Beveled Play Triangle with Pulse Beat Waveform */}
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-[0_4px_16px_rgba(245,158,11,0.3)]"
      >
        <defs>
          {/* Chrome Bevel Gradient */}
          <linearGradient id="chromeBorder" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="25%" stopColor="#cbd5e1" />
            <stop offset="50%" stopColor="#64748b" />
            <stop offset="75%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>

          {/* Deep Metallic Gold Inner Gradient */}
          <linearGradient id="blueCore" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#fcd34d" />
            <stop offset="40%" stopColor="#f59e0b" />
            <stop offset="80%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>

          {/* Warm Gold Glow for Audio Pulse */}
          <linearGradient id="cyanPulse" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="30%" stopColor="#fff1a8" />
            <stop offset="70%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>

          {/* Chrome Text Metallic Gradients */}
          <linearGradient id="chromeText" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#e2e8f0" />
            <stop offset="70%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>

          <linearGradient id="blueText" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="45%" stopColor="#fbbf24" />
            <stop offset="85%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>

          {/* Drop Glow Filter */}
          <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer Shadow Base */}
        <path
          d="M 38 22 C 31 17 22 22 22 31 L 22 129 C 22 138 31 143 38 138 L 134 89 C 142 85 142 75 134 71 Z"
          fill="#031024"
          opacity="0.8"
        />

        {/* Outer Metallic Chrome Bevel Frame */}
        <path
          d="M 36 20 C 27 15 16 21 16 32 L 16 128 C 16 139 27 145 36 140 L 136 92 C 146 87 146 73 136 68 Z"
          stroke="url(#chromeBorder)"
          strokeWidth="10"
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="url(#blueCore)"
        />

        {/* Inner Dark Depth Inset */}
        <path
          d="M 40 38 C 36 35 32 37 32 42 L 32 118 C 32 123 36 125 40 122 L 118 84 C 122 82 122 78 118 76 Z"
          fill="#06182c"
          opacity="0.6"
        />

        {/* Glowing Audio Pulse Beat Waveform across Triangle */}
        <path
          d="M 16 80 L 46 80 L 54 80 L 62 62 L 72 102 L 82 48 L 92 108 L 102 74 L 110 80 L 138 80"
          stroke="url(#cyanPulse)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#neonGlow)"
        />

        {/* Waveform Central White Core Hotspot */}
        <path
          d="M 16 80 L 46 80 L 54 80 L 62 62 L 72 102 L 82 48 L 92 108 L 102 74 L 110 80 L 138 80"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />

        {/* Metallic Highlight Gloss on Upper Slope */}
        <path
          d="M 28 32 L 80 57"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.45"
        />
      </svg>

      {/* Official 3D Typography: PlayBeat ENTERTAINMENT */}
      {showText && (
        <div className="flex flex-col">
          <div className={`font-display font-black tracking-tight leading-none flex items-center ${text}`}>
            {/* Play in Metallic Chrome */}
            <span className="bg-gradient-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-black">
              Play
            </span>
            {/* Beat in warm gold */}
            <span className="bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(245,158,11,0.35)] font-black ml-0.5">
              Beat
            </span>
          </div>

          {/* ENTERTAINMENT Subtitle with accent lines */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="h-[1px] w-3.5 bg-gradient-to-r from-transparent to-amber-300 opacity-80" />
            <span className={`font-sans uppercase font-bold tracking-[0.28em] text-slate-300 text-center ${sub}`}>
              ENTERTAINMENT
            </span>
            <span className="h-[1px] w-3.5 bg-gradient-to-l from-transparent to-amber-300 opacity-80" />
          </div>
        </div>
      )}
    </div>
  );
};
