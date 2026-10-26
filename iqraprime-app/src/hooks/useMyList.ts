"use client";

import { useCallback, useEffect, useState } from "react";
import { byId, type Title } from "@/lib/catalog";

const KEY = "iqraprime:mylist";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent("iqraprime:mylist-changed"));
  } catch {
    /* storage unavailable */
  }
}

/** My List persisted in localStorage (per device). */
export function useMyList() {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIds(read());
    setReady(true);
    const onChange = () => setIds(read());
    window.addEventListener("iqraprime:mylist-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("iqraprime:mylist-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const cur = read();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur];
    write(next);
    setIds(next);
  }, []);

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  const titles = ids.map((id) => byId(id)).filter(Boolean) as Title[];

  return { ids, titles, toggle, has, ready };
}
