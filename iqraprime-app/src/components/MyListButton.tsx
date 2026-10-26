"use client";

import { useMyList } from "@/hooks/useMyList";

interface Props {
  id: string;
  className?: string;
  showLabel?: boolean;
}

export default function MyListButton({ id, className = "", showLabel = true }: Props) {
  const { has, toggle, ready } = useMyList();
  const inList = ready && has(id);

  return (
    <button
      onClick={() => toggle(id)}
      className={`btn-ghost inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${className}`}
      aria-pressed={inList}
      aria-label={inList ? "Remove from My List" : "Add to My List"}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={inList ? "currentColor" : "none"} aria-hidden="true">
        <path
          d="m12 20.5-8.2-8.4a5.4 5.4 0 1 1 7.6-7.6l.6.6.6-.6a5.4 5.4 0 1 1 7.6 7.6Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      {showLabel ? (inList ? "In My List" : "My List") : null}
    </button>
  );
}
