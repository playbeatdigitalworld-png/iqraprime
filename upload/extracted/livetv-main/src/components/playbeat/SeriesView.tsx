import React from 'react';
import { Episode, Series } from '../../types/playbeat';
import { Layers } from 'lucide-react';

interface SeriesViewProps {
  seriesList: Series[];
  onPlayEpisode: (episode: Episode, seriesTitle: string) => void;
}

export const SeriesView: React.FC<SeriesViewProps> = () => (
  <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8 lg:py-16">
    <div className="relative overflow-hidden rounded-3xl border border-amber-200/15 bg-gradient-to-br from-[#10192a] via-[#080d18] to-[#080d18] px-6 py-12 text-center sm:px-12">
      <div className="absolute -right-12 -top-24 h-72 w-72 rounded-full border border-amber-200/10" />
      <div className="absolute -right-2 -top-14 h-52 w-52 rounded-full border border-sky-300/10" />
      <div className="relative mx-auto max-w-xl space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-200/[0.07] text-amber-200">
          <Layers className="h-7 w-7" />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200">Catalog setup</div>
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Your series collection will appear here</h1>
        <p className="mx-auto max-w-lg text-sm leading-6 text-slate-400">
          Connect an authorized HTTPS VOD provider to load real series, episodes, artwork, and streams. No sample content is shown.
        </p>
      </div>
    </div>
  </div>
);
