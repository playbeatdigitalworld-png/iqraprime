import type { Metadata } from "next";
import { Suspense } from "react";
import SearchClient from "@/components/SearchClient";

export const metadata: Metadata = {
  title: "Search",
  description: "Search movies and Pakistani dramas on IQRAPRIME.",
};

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-16">
          <div className="h-9 w-40 animate-pulse rounded-lg bg-navy" />
          <div className="mt-6 h-12 animate-pulse rounded-xl bg-navy" />
        </div>
      }
    >
      <SearchClient />
    </Suspense>
  );
}
