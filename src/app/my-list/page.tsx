import type { Metadata } from "next";
import MyListClient from "@/components/MyListClient";

export const metadata: Metadata = {
  title: "My List",
  description: "Your saved movies and dramas on IQRAPRIME.",
};

export default function MyListPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-16">
      <header>
        <p className="text-xs font-bold tracking-[0.3em] text-gold">YOUR LIBRARY</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-white">My List</h1>
      </header>
      <MyListClient />
    </div>
  );
}
