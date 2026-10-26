import React from "react";

type Props = {
  compact?: boolean;
};

export default function StreamPlayBrand({ compact = false }: Props) {
  return (
    <div className="sp-brand" aria-label="StreamPlay">
      <svg
        className="sp-brand-icon"
        viewBox="0 0 64 64"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="spGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff315e" />
            <stop offset="100%" stopColor="#a80739" />
          </linearGradient>
        </defs>

        <path
          d="M10 8h27.5C49 8 56 14.5 56 24c0 8.8-6.5 15.5-16.5 15.5H28v16H10V8Z"
          fill="none"
          stroke="url(#spGradient)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M31 19.5 46 28 31 36.5v-17Z"
          fill="url(#spGradient)"
        />
      </svg>

      {!compact && (
        <span className="sp-brand-text">
          Stream<span>Play</span>
        </span>
      )}
    </div>
  );
}
