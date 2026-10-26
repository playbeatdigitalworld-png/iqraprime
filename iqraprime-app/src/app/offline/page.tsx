import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-gold to-gold-deep text-ink font-black text-2xl">
        I
      </span>
      <h1 className="mt-6 font-display text-3xl font-bold text-white">You&apos;re offline</h1>
      <p className="mt-3 text-sm leading-relaxed text-mist">
        IQRAPRIME can&apos;t reach the network right now. Pages and artwork you&apos;ve already
        visited are still available — and your My List is saved on this device.
      </p>
      <Link href="/" className="btn-gold mt-8 inline-block rounded-lg px-6 py-2.5 text-sm">
        Try Home
      </Link>
    </div>
  );
}
