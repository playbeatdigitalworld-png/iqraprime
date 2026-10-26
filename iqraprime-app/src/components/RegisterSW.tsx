"use client";

import { useEffect } from "react";

/** Registers the IQRAPRIME service worker in production builds. */
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // Check for updates periodically
          setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
        })
        .catch(() => {});
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
