import React from 'react';

/**
 * EmptyState — truthful, branded empty state (Phase 2 spec §24).
 * Never fabricates media. Offers the next useful action when one exists.
 */
export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}> = ({ icon, title, body, action, className = '' }) => (
  <div className={`sp2-empty ${className}`} role="status">
    {icon}
    <h3>{title}</h3>
    {body && <p>{body}</p>}
    {action && (
      <button type="button" className="sp2-btn sp2-btn--glass mt-2 !min-h-[38px] !text-xs" onClick={action.onClick}>
        {action.label}
      </button>
    )}
  </div>
);

/**
 * ContentSkeleton — stable-layout shimmer placeholders for rails/grids (§24).
 * Preserves card dimensions so nothing shifts when real artwork arrives.
 */
export const ContentSkeleton: React.FC<{
  count?: number;
  variant?: 'portrait' | 'landscape';
  className?: string;
}> = ({ count = 6, variant = 'portrait', className = '' }) => (
  <div
    className={`grid gap-3 sm:gap-4 ${className}`}
    style={{
      gridTemplateColumns: 'repeat(auto-fill, minmax(min(170px, 100%), 1fr))',
      gridAutoFlow: 'dense',
    }}
    aria-hidden="true"
  >
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-white/[0.05] bg-surface-700/50 p-2 pb-3">
        <div
          className="sp2-skeleton rounded-xl"
          style={{ aspectRatio: variant === 'portrait' ? '2 / 3' : '16 / 9' }}
        />
        <div className="sp2-skeleton h-3 rounded mt-2.5 w-3/4" />
        <div className="sp2-skeleton h-2.5 rounded mt-1.5 w-1/2" />
      </div>
    ))}
  </div>
);

/**
 * ErrorBar — human-readable retryable error strip (§24). No stack traces.
 */
export const ErrorBar: React.FC<{
  message: string;
  onRetry?: () => void;
  className?: string;
}> = ({ message, onRetry, className = '' }) => (
  <div className={`sp2-errorbar ${className}`} role="alert">
    <span>{message}</span>
    {onRetry && (
      <button type="button" className="sp2-btn sp2-btn--primary !min-h-[34px] !px-4 !text-[11px]" onClick={onRetry}>
        Retry
      </button>
    )}
  </div>
);
